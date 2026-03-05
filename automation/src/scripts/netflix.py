"""
Automatyzacja Netflix – logowanie i anulowanie/wznowienie subskrypcji.

UWAGA: Skrypt automatyzuje konto WŁASNEGO użytkownika. Dane logowania
są przechowywane zaszyfrowane i używane wyłącznie do tej operacji.
"""
from __future__ import annotations

from selenium.webdriver.chrome.webdriver import WebDriver
from selenium.webdriver.common.by import By

from src.scripts.base_automation import BaseAutomation, AutomationError
from src.types import AutomationAction


class NetflixAutomation(BaseAutomation):
    service_key          = "netflix"
    service_display_name = "Netflix"

    _LOGIN_URL      = "https://www.netflix.com/login"
    _MANAGE_URL     = "https://www.netflix.com/account"
    _CANCEL_URL     = "https://www.netflix.com/cancelplan"

    def login(self, driver: WebDriver, email: str, password: str) -> None:
        driver.get(self._LOGIN_URL)

        email_field = self.wait_for_element(driver, By.NAME, "userLoginId")
        email_field.clear()
        email_field.send_keys(email)

        password_field = self.wait_for_element(driver, By.NAME, "password")
        password_field.clear()
        password_field.send_keys(password)

        submit_btn = self.wait_for_element(driver, By.CSS_SELECTOR, "button[type='submit']")
        self.safe_click(driver, submit_btn)

        # Czekamy na przekierowanie po zalogowaniu (URL nie zawiera /login)
        self.sleep(2)
        if "login" in driver.current_url.lower():
            raise AutomationError(
                "Logowanie do Netflix nie powiodło się. "
                "Sprawdź dane logowania lub podgląd sesji."
            )

    def navigate_to_subscription(self, driver: WebDriver) -> None:
        driver.get(self._MANAGE_URL)
        self.wait_for_element(driver, By.CSS_SELECTOR, "div.account-section", timeout=20)

    def execute_action(self, driver: WebDriver, action: AutomationAction) -> str:
        if action == AutomationAction.CANCEL:
            return self._cancel(driver)
        else:
            return self._resume(driver)

    def _cancel(self, driver: WebDriver) -> str:
        driver.get(self._CANCEL_URL)
        self.sleep(2)

        # Kliknij przycisk potwierdzający anulowanie
        try:
            confirm_btn = self.wait_for_element(
                driver,
                By.CSS_SELECTOR,
                "button[data-uia='confirm-cancel-button'], "
                "button[class*='cancel'], "
                "a[href*='cancelconfirm']",
                timeout=10,
            )
            self.safe_click(driver, confirm_btn)
            self.sleep(2)
            return "Subskrypcja Netflix anulowana. Dostęp trwa do końca bieżącego okresu."
        except AutomationError:
            # Może już być anulowana
            page = driver.page_source.lower()
            if "restart" in page or "wznów" in page or "cancelled" in page:
                return "Subskrypcja Netflix jest już anulowana."
            raise AutomationError(
                "Nie znaleziono przycisku anulowania na stronie Netflix. "
                "Strona mogła zmienić strukturę – wymagana aktualizacja skryptu."
            )

    def _resume(self, driver: WebDriver) -> str:
        driver.get(self._CANCEL_URL)
        self.sleep(2)

        try:
            restart_btn = self.wait_for_element(
                driver,
                By.CSS_SELECTOR,
                "button[data-uia='restart-btn'], "
                "a[href*='restart'], "
                "button[class*='restart']",
                timeout=10,
            )
            self.safe_click(driver, restart_btn)
            self.sleep(2)
            return "Subskrypcja Netflix wznowiona pomyślnie."
        except AutomationError:
            page = driver.page_source.lower()
            if "cancel" in page and "restart" not in page:
                return "Subskrypcja Netflix jest aktywna – nie ma czego wznawiać."
            raise AutomationError(
                "Nie znaleziono przycisku wznowienia na stronie Netflix. "
                "Wymagana aktualizacja skryptu."
            )

    def check_payment_status(
        self, driver: WebDriver, expected_amount: float, expected_date: str
    ) -> dict:
        """
        Sprawdza czy Netflix jest aktywny co sugeruje że płatność przeszła.
        Prosta heurystyka: aktywna subskrypcja = cykl opłacony.
        """
        driver.get(self._MANAGE_URL)
        self.sleep(3)
        page = driver.page_source.lower()

        # Sygnały aktywnej subskrypcji na stronie zarządzania
        active_signals = ["anuluj", "cancel", "restart", "manage", "zarzą", "plan"]
        is_sub_active = any(s in page for s in active_signals)

        if not is_sub_active:
            return {
                "payment_found": False,
                "payment_date": None,
                "amount_found": None,
                "message": "Subskrypcja Netflix wydaje się nieaktywna lub anulowana.",
            }

        # Szukamy kwoty na stronie (format PLN: 49,00 lub 49)
        amount_str = f"{expected_amount:.2f}".replace(".", ",")
        amount_in_page = amount_str in page or str(int(expected_amount)) in page

        return {
            "payment_found": True,
            "payment_date": expected_date,
            "amount_found": expected_amount if amount_in_page else None,
            "message": (
                f"Subskrypcja Netflix jest aktywna – płatność "
                f"{expected_amount:.2f} PLN z dnia {expected_date} "
                f"prawdopodobnie przeszła pomyślnie."
            ),
        }
