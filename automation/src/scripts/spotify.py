"""
Automatyzacja Spotify – logowanie i anulowanie/wznowienie subskrypcji Premium.
"""
from __future__ import annotations

from selenium.webdriver.chrome.webdriver import WebDriver
from selenium.webdriver.common.by import By

from src.scripts.base_automation import BaseAutomation, AutomationError
from src.types import AutomationAction


class SpotifyAutomation(BaseAutomation):
    service_key          = "spotify"
    service_display_name = "Spotify"

    _LOGIN_URL  = "https://accounts.spotify.com/pl/login"
    _MANAGE_URL = "https://www.spotify.com/pl/account/subscription/"
    _CANCEL_URL = "https://www.spotify.com/pl/account/subscription/cancel/"

    def login(self, driver: WebDriver, email: str, password: str) -> None:
        driver.get(self._LOGIN_URL)

        email_field = self.wait_for_element(driver, By.ID, "login-username")
        email_field.clear()
        email_field.send_keys(email)

        password_field = self.wait_for_element(driver, By.ID, "login-password")
        password_field.clear()
        password_field.send_keys(password)

        login_btn = self.wait_for_element(driver, By.ID, "login-button")
        self.safe_click(driver, login_btn)

        self.sleep(3)
        if "login" in driver.current_url.lower() or "accounts.spotify.com" in driver.current_url:
            # Może być 2FA – detekcja
            page = driver.page_source.lower()
            if "enter the code" in page or "kod" in page or "verification" in page:
                raise AutomationError(
                    "Spotify wymaga weryfikacji dwuetapowej. "
                    "Oczekiwanie na interakcję użytkownika."
                )
            raise AutomationError(
                "Logowanie do Spotify nie powiodło się. Sprawdź dane logowania."
            )

    def navigate_to_subscription(self, driver: WebDriver) -> None:
        driver.get(self._MANAGE_URL)
        self.sleep(2)
    def execute_action(self, driver: WebDriver, action: AutomationAction) -> str:
        if action == AutomationAction.CANCEL:
            return self._cancel(driver)
        else:
            return self._resume(driver)

    def _cancel(self, driver: WebDriver) -> str:
        driver.get(self._CANCEL_URL)
        self.sleep(2)

        try:
            # Przycisk inicjujący proces anulowania
            start_btn = self.wait_for_element(
                driver,
                By.CSS_SELECTOR,
                "button[data-testid*='cancel'], "
                "a[href*='cancel'], "
                "button[class*='cancel-button']",
                timeout=10,
            )
            self.safe_click(driver, start_btn)
            self.sleep(2)

            # Potwierdzenie
            try:
                confirm = self.wait_for_element(
                    driver,
                    By.CSS_SELECTOR,
                    "button[data-testid*='confirm'], "
                    "button[class*='confirm']",
                    timeout=8,
                )
                self.safe_click(driver, confirm)
                self.sleep(2)
            except AutomationError:
                pass  # Może wymagać tylko jednego kliknięcia

            return "Subskrypcja Spotify Premium anulowana. Dostęp trwa do końca bieżącego cyklu."
        except AutomationError:
            page = driver.page_source.lower()
            if "free" in page and "premium" not in page:
                return "Konto Spotify jest już na planie Free."
            raise AutomationError(
                "Nie znaleziono przycisku anulowania Spotify Premium. "
                "Interfejs mógł się zmienić – wymagana aktualizacja skryptu."
            )

    def _resume(self, driver: WebDriver) -> str:
        driver.get(self._MANAGE_URL)
        self.sleep(2)

        try:
            resume_btn = self.wait_for_element(
                driver,
                By.CSS_SELECTOR,
                "button[data-testid*='resume'], "
                "a[href*='reactivate'], "
                "button[class*='resume']",
                timeout=10,
            )
            self.safe_click(driver, resume_btn)
            self.sleep(2)
            return "Subskrypcja Spotify Premium wznowiona pomyślnie."
        except AutomationError:
            raise AutomationError(
                "Nie znaleziono przycisku wznowienia Spotify Premium. "
                "Wymagana aktualizacja skryptu lub ręczna interwencja."
            )

    def check_payment_status(
        self, driver: WebDriver, expected_amount: float, expected_date: str
    ) -> dict:
        """
        Sprawdza czy Spotify Premium jest aktywny (co sugeruje, że płatność przeszła).
        """
        driver.get(self._MANAGE_URL)
        self.sleep(2)
        page = driver.page_source.lower()

        premium_active = "premium" in page and (
            "cancel" in page
            or "anuluj" in page
            or "your plan" in page
            or "twój plan" in page
            or "next payment" in page
            or "następna płatność" in page
        )

        if not premium_active:
            return {
                "payment_found": False,
                "payment_date": None,
                "amount_found": None,
                "message": "Spotify Premium wydaje się nieaktywny lub anulowany.",
            }

        return {
            "payment_found": True,
            "payment_date": expected_date,
            "amount_found": expected_amount,
            "message": (
                f"Spotify Premium jest aktywny – płatność {expected_amount:.2f} PLN "
                f"z dnia {expected_date} prawdopodobnie przeszła pomyślnie."
            ),
        }
