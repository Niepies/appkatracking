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
        email: str,
        password: str,
        action: AutomationAction,
        job: AutomationJob,
    ) -> None:
        """
        Główna metoda uruchamiająca automatyzację.
        Loguje zdarzenia do AuditLogger i aktualizuje stan joba.
        """
        try:
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
            job.update(status=JobStatus.RUNNING, message="Nawiguję do zarządzania subskrypcją…")
            self.navigate_to_subscription(driver)

            # 4. Sprawdzenie CAPTCHA po nawigacji
            if self.detect_captcha(driver):
                self._handle_captcha(driver, job, action)

            # 5. Wykonanie akcji
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

        except WebDriverException as exc:
            self._fail(job, action, f"Błąd przeglądarki: {exc.msg or str(exc)}", driver)
        except AutomationError as exc:
            self._fail(job, action, str(exc), driver)
        except Exception as exc:
            self._fail(job, action, f"Nieoczekiwany błąd: {str(exc)}", driver)

    # ── Abstrakcyjne kroki ─────────────────────────────────────────────────────

    @abstractmethod
    def login(self, driver: WebDriver, email: str, password: str) -> None:
        """Zaloguj do serwisu."""

    @abstractmethod
    def navigate_to_subscription(self, driver: WebDriver) -> None:
        """Przejdź do strony zarządzania subskrypcją."""

    @abstractmethod
    def execute_action(self, driver: WebDriver, action: AutomationAction) -> str:
        """Wykonaj akcję (anulowanie/wznowienie). Zwraca komunikat wyniku."""

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
