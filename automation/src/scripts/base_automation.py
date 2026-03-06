"""
Bazowa klasa abstrakcyjna dla skryptów automatyzacji subskrypcji.

Każdy skrypt dziedziczący po BaseAutomation implementuje:
  - login(driver)
  - navigate_to_subscription(driver)
  - execute_action(driver, action)
  - detect_captcha(driver) -> bool
"""
from __future__ import annotations

import time
from abc import ABC, abstractmethod
from typing import Optional

from selenium.webdriver.chrome.webdriver import WebDriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, WebDriverException

import json

from src.types import AutomationAction, JobStatus
from src.services.session_service import AutomationJob
from src.utils.screenshot_utils import take_screenshot_base64
from src.utils.audit_logger import audit_logger


# Słowa kluczowe wskazujące na CAPTCHA / 2FA na stronie
_CAPTCHA_HINTS = [
    "captcha",
    "recaptcha",
    "hcaptcha",
    "verify you are human",
    "prove you are not a robot",
    "security check",
    "two-factor",
    "two factor",
    "2fa",
    "authentication code",
    "verification code",
    "kod weryfikacyjny",
    "weryfikacja",
]


class BaseAutomation(ABC):
    """Abstrakcyjna klasa bazowa dla automatyzacji konkretnych serwisów."""

    service_key: str = "unknown"
    service_display_name: str = "Unknown Service"

    # ── Szablonowa metoda – nie nadpisywalny flow ──────────────────────────────

    def run(
        self,
        driver: WebDriver,
        email: str | None,
        password: str | None,
        action: AutomationAction,
        job: AutomationJob,
    ) -> None:
        """
        Główna metoda uruchamiająca automatyzację.

        SCRAPE: otwiera stronę logowania serwisu, czeka aż użytkownik zaloguje się ręcznie,
                następnie wykonuje scraping danych rozliczeniowych.
                Aplikacja NIGDY nie widzi loginu ani hasła użytkownika.

        CANCEL/RESUME: loguje się podanymi poświadczeniami i wykonuje akcję.
        """
        try:
            if action == AutomationAction.SCRAPE:
                self._run_scrape_flow(driver, job)
            else:
                self._run_action_flow(driver, email or "", password or "", action, job)

        except WebDriverException as exc:
            self._fail(job, action, f"Błąd przeglądarki: {exc.msg or str(exc)}", driver)
        except AutomationError as exc:
            self._fail(job, action, str(exc), driver)
        except Exception as exc:
            self._fail(job, action, f"Nieoczekiwany błąd: {str(exc)}", driver)

    # ── SCRAPE: ręczne logowanie przez użytkownika ────────────────────────────

    def _run_scrape_flow(self, driver: WebDriver, job: AutomationJob) -> None:
        """
        Flow dla akcji SCRAPE:
          1. Otwiera stronę logowania serwisu w przeglądarce Selenium
          2. Ustawia status WAITING_FOR_USER z podglądem ekranu
          3. Czeka na sygnał continue() od użytkownika (kliknął "Zalogowałem się")
          4. Weryfikuje zalogowanie; jeśli nie – czeka ponownie
          5. Nawiguje do strony konta i wykonuje scraping
        """
        login_url = self.get_login_url()
        job.update(status=JobStatus.RUNNING, message=f"Otwieranie strony logowania {self.service_display_name}…")
        audit_logger.log(
            action="scrape",
            service_key=self.service_key,
            job_id=job.job_id,
            initiated_by=job.initiated_by,
            status="running",
            message="Otwieram stronę logowania",
            subscription_id=job.subscription_id,
        )

        driver.get(login_url)
        self.sleep(1.5)

        screenshot = take_screenshot_base64(driver)
        job.set_screenshot(screenshot)
        job.update(
            status=JobStatus.WAITING_FOR_USER,
            message=f"Zaloguj sie do {self.service_display_name} w otwartej przegladarce, "
                    f"a nastepnie kliknij 'Zalogovalem sie'.",
        )

        # Pętla oczekiwania: użytkownik loguje się ręcznie
        max_attempts = 3
        for attempt in range(max_attempts):
            timed_out = not job.wait_for_user(timeout=300)
            if timed_out:
                raise AutomationError(
                    "Przekroczono czas oczekiwania na logowanie (5 min). Spróbuj ponownie."
                )

            # Sprawdź czy logowanie zakończone
            job.update(status=JobStatus.RUNNING, message="Weryfikuję zalogowanie…")
            self.sleep(1)
            screenshot = take_screenshot_base64(driver)
            job.set_screenshot(screenshot)

            if self.is_logged_in(driver):
                break

            # Nie zalogowany – czekaj ponownie
            if attempt < max_attempts - 1:
                screenshot = take_screenshot_base64(driver)
                job.set_screenshot(screenshot)
                job.update(
                    status=JobStatus.WAITING_FOR_USER,
                    message="Nie wykryto logowania. Zaloguj się i kliknij ponownie 'Zalogowałem się'.",
                )
            else:
                raise AutomationError(
                    "Nie udało się potwierdzić zalogowania po kilku próbach. Spróbuj ponownie."
                )

        # Zalogowany – nawiguj do strony konta i scrapuj
        job.update(status=JobStatus.RUNNING, message="Nawiguję do strony konta i pobieram dane…")
        self.navigate_to_subscription(driver)
        self.sleep(2)  # poczekaj na załadowanie SPA

        job.update(status=JobStatus.RUNNING, message="Pobieram dane rozliczeniowe…")
        billing_data = self.scrape_billing_info(driver)

        screenshot = take_screenshot_base64(driver)
        job.set_screenshot(screenshot)
        result_json = json.dumps(billing_data, ensure_ascii=False)
        job.set_result(result_json)
        job.update(status=JobStatus.COMPLETED, message="Dane rozliczeniowe pobrane pomyślnie.")
        audit_logger.log(
            action="scrape",
            service_key=self.service_key,
            job_id=job.job_id,
            initiated_by=job.initiated_by,
            status="completed",
            message="Dane rozliczeniowe pobrane (ręczne logowanie).",
            subscription_id=job.subscription_id,
        )

    # ── CANCEL/RESUME: automatyczne logowanie ─────────────────────────────────

    def _run_action_flow(
        self,
        driver: WebDriver,
        email: str,
        password: str,
        action: AutomationAction,
        job: AutomationJob,
    ) -> None:
        """Flow dla CANCEL/RESUME z automatycznym logowaniem."""
        # 1. Logowanie
        job.update(status=JobStatus.RUNNING, message="Logowanie…")
        audit_logger.log(
            action=action.value,
            service_key=self.service_key,
            job_id=job.job_id,
            initiated_by=job.initiated_by,
            status="running",
            message="Rozpoczynam logowanie",
            subscription_id=job.subscription_id,
        )
        self.login(driver, email, password)

        # 2. Sprawdzenie CAPTCHA po logowaniu
        if self.detect_captcha(driver):
            self._handle_captcha(driver, job, action)

        # 3. Nawigacja do zarządzania subskrypcją
        job.update(status=JobStatus.RUNNING, message="Nawiguję do strony konta…")
        self.navigate_to_subscription(driver)

        # 4. Sprawdzenie CAPTCHA po nawigacji
        if self.detect_captcha(driver):
            self._handle_captcha(driver, job, action)

        # 5. Wykonanie akcji (CANCEL / RESUME)
        action_label = "Anulowanie" if action == AutomationAction.CANCEL else "Wznawianie"
        job.update(status=JobStatus.RUNNING, message=f"{action_label} subskrypcji…")
        result = self.execute_action(driver, action)

        # 6. Sukces
        screenshot = take_screenshot_base64(driver)
        job.set_screenshot(screenshot)
        job.set_result(result or "Akcja wykonana pomyślnie.")
        job.update(status=JobStatus.COMPLETED, message="Automatyzacja zakończona sukcesem.")
        audit_logger.log(
            action=action.value,
            service_key=self.service_key,
            job_id=job.job_id,
            initiated_by=job.initiated_by,
            status="completed",
            message=result or "Akcja wykonana pomyślnie.",
            subscription_id=job.subscription_id,
        )

    # ── Abstrakcyjne kroki ─────────────────────────────────────────────────────

    @abstractmethod
    def login(self, driver: WebDriver, email: str, password: str) -> None:
        """Zaloguj do serwisu (używane dla CANCEL/RESUME)."""

    @abstractmethod
    def navigate_to_subscription(self, driver: WebDriver) -> None:
        """Przejdź do strony zarządzania subskrypcją."""

    @abstractmethod
    def execute_action(self, driver: WebDriver, action: AutomationAction) -> str:
        """Wykonaj akcję (anulowanie/wznowienie). Zwraca komunikat wyniku."""

    def get_login_url(self) -> str:
        """
        Zwraca URL strony logowania serwisu.
        Nadpisywana przez serwisy – domyślnie używa subscription_url z MANAGE_URLS.
        """
        return "about:blank"

    def is_logged_in(self, driver: WebDriver) -> bool:
        """
        Sprawdza czy użytkownik jest zalogowany po ręcznym logowaniu.
        Nadpisywana przez serwisy. Domyślnie: sprawdza czy URL nie zawiera
        słów kluczowych logowania (login/signin/auth).
        """
        try:
            url = driver.current_url.lower()
            login_patterns = ["login", "signin", "sign-in", "auth", "logowanie", "zaloguj"]
            return not any(p in url for p in login_patterns)
        except Exception:
            return False

    def scrape_billing_info(self, driver: WebDriver) -> dict:
        """
        Pobiera dane rozliczeniowe ze strony konta.
        Nadpisywana przez dedykowane skrypty serwisów.
        Zwraca dict zgodny z ScrapedBillingData:
          { plan_name, amount, currency, payment_cycle, next_payment_date, raw_info }
        """
        return {
            "plan_name": None,
            "amount": None,
            "currency": None,
            "payment_cycle": None,
            "next_payment_date": None,
            "raw_info": "Automatyczne pobieranie danych niedostępne dla tego serwisu.",
        }

    # ── Sprawdzanie płatności ──────────────────────────────────────────────────

    def check_payment_status(
        self,
        driver: WebDriver,
        expected_amount: float,
        expected_date: str,
    ) -> dict:
        """
        Sprawdza czy płatność przeszła. Domyślna implementacja – nadpisywana przez serwisy.
        Zwraca dict: {payment_found, payment_date, amount_found, message}
        """
        return {
            "payment_found": False,
            "payment_date": None,
            "amount_found": None,
            "message": "Automatyczna weryfikacja płatności niedostępna dla tego serwisu. Sprawdź ręcznie.",
        }

    def check(
        self,
        driver: WebDriver,
        email: str,
        password: str,
        expected_amount: float,
        expected_date: str,
    ) -> dict:
        """
        Szablon sprawdzania płatności: logowanie + check_payment_status.
        Nie rzuca wyjątków – zwraca dict z wynikiem.
        """
        try:
            self.login(driver, email, password)
            if self.detect_captcha(driver):
                return {
                    "payment_found": False,
                    "payment_date": None,
                    "amount_found": None,
                    "message": "Wykryto CAPTCHA. Sprawdź status płatności ręcznie.",
                }
            return self.check_payment_status(driver, expected_amount, expected_date)
        except AutomationError as exc:
            return {
                "payment_found": False,
                "payment_date": None,
                "amount_found": None,
                "message": str(exc),
            }
        except Exception as exc:
            return {
                "payment_found": False,
                "payment_date": None,
                "amount_found": None,
                "message": f"Nieoczekiwany błąd: {exc}",
            }

    # ── Detekcja CAPTCHA ──────────────────────────────────────────────────────

    def detect_captcha(self, driver: WebDriver) -> bool:
        """
        Sprawdza, czy na aktualnej stronie widoczna jest CAPTCHA lub 2FA.
        Domyślna implementacja: szuka słów kluczowych w źródle strony.
        """
        try:
            page_source = driver.page_source.lower()
            return any(hint in page_source for hint in _CAPTCHA_HINTS)
        except Exception:
            return False

    # ── Narzędzia dla podklas ──────────────────────────────────────────────────

    def wait_for_element(
        self,
        driver: WebDriver,
        by: str,
        value: str,
        timeout: int = 15,
    ):
        """Czeka na element i zwraca go lub rzuca AutomationError."""
        try:
            return WebDriverWait(driver, timeout).until(
                EC.element_to_be_clickable((by, value))
            )
        except TimeoutException:
            raise AutomationError(
                f"Element '{value}' nie pojawił się w ciągu {timeout}s. "
                f"Serwis mógł zmienić interfejs."
            )

    def wait_for_url_contains(self, driver: WebDriver, fragment: str, timeout: int = 15) -> None:
        try:
            WebDriverWait(driver, timeout).until(EC.url_contains(fragment))
        except TimeoutException:
            raise AutomationError(f"Oczekiwano URL zawierającego '{fragment}'.")

    def safe_click(self, driver: WebDriver, element) -> None:
        """Klik z fallback do JavaScript."""
        try:
            element.click()
        except Exception:
            driver.execute_script("arguments[0].click();", element)

    def sleep(self, seconds: float) -> None:
        time.sleep(seconds)

    # ── Prywatne ──────────────────────────────────────────────────────────────

    def _handle_captcha(self, driver: WebDriver, job: AutomationJob, action: AutomationAction) -> None:
        """
        Wstrzymuje automatyzację i czeka na manualną Interwencję użytkownika.
        Frontend pollinguje /status/{job_id} i wykrywa stan WAITING_FOR_USER.
        """
        screenshot = take_screenshot_base64(driver)
        job.set_screenshot(screenshot)
        job.update(
            status=JobStatus.WAITING_FOR_USER,
            message="Wykryto CAPTCHA lub weryfikację 2FA. "
                    "Wypełnij formularz, a następnie kliknij 'Kontynuuj'.",
        )
        audit_logger.log(
            action=action.value,
            service_key=self.service_key,
            job_id=job.job_id,
            initiated_by=job.initiated_by,
            status="waiting_for_user",
            message="CAPTCHA / 2FA wykryte – oczekiwanie na użytkownika",
            subscription_id=job.subscription_id,
        )

        # Czekamy maksymalnie 5 minut na sygnał od użytkownika
        completed = job.wait_for_user(timeout=300.0)
        if not completed:
            raise AutomationError("Przekroczono czas oczekiwania na interakcję użytkownika (5 min).")

        job.update(status=JobStatus.RUNNING, message="Kontynuuję automatyzację…")

    def _fail(
        self,
        job: AutomationJob,
        action: AutomationAction,
        message: str,
        driver: Optional[WebDriver] = None,
    ) -> None:
        screenshot = take_screenshot_base64(driver) if driver else None
        if screenshot:
            job.set_screenshot(screenshot)
        job.set_error(message)
        job.update(status=JobStatus.FAILED, message=message)
        audit_logger.log(
            action=action.value,
            service_key=self.service_key,
            job_id=job.job_id,
            initiated_by=job.initiated_by,
            status="failed",
            message=message,
            subscription_id=job.subscription_id,
        )


class AutomationError(Exception):
    """Wyjątek diagnostyczny automatyzacji serwisu."""
