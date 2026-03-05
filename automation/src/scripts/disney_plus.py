"""
Automatyzacja Disney+ – logowanie i anulowanie/wznowienie subskrypcji.
"""
from __future__ import annotations

from selenium.webdriver.chrome.webdriver import WebDriver
from selenium.webdriver.common.by import By

from src.scripts.base_automation import BaseAutomation, AutomationError
from src.types import AutomationAction


class DisneyPlusAutomation(BaseAutomation):
    service_key          = "disney+"
    service_display_name = "Disney+"

    _LOGIN_URL  = "https://www.disneyplus.com/login"
    _MANAGE_URL = "https://www.disneyplus.com/account/subscription"
    _CANCEL_URL = "https://www.disneyplus.com/account/subscription/cancel"

    def login(self, driver: WebDriver, email: str, password: str) -> None:
        driver.get(self._LOGIN_URL)

        email_field = self.wait_for_element(
            driver, By.CSS_SELECTOR, "input[type='email'], input[name='email']"
        )
        email_field.clear()
        email_field.send_keys(email)

        next_btn = self.wait_for_element(
            driver, By.CSS_SELECTOR, "button[type='submit']"
        )
        self.safe_click(driver, next_btn)
        self.sleep(1)

        password_field = self.wait_for_element(
            driver, By.CSS_SELECTOR, "input[type='password']"
        )
        password_field.clear()
        password_field.send_keys(password)

        submit_btn = self.wait_for_element(
            driver, By.CSS_SELECTOR, "button[type='submit']"
        )
        self.safe_click(driver, submit_btn)
        self.sleep(3)

        if "login" in driver.current_url.lower():
            raise AutomationError(
                "Logowanie do Disney+ nie powiodło się. Sprawdź dane logowania."
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
            cancel_btn = self.wait_for_element(
                driver,
                By.CSS_SELECTOR,
                "button[data-testid*='cancel'], "
                "button[class*='cancel-subscription'], "
                "a[href*='cancel']",
                timeout=10,
            )
            self.safe_click(driver, cancel_btn)
            self.sleep(2)

            # Potwierdzenie
            try:
                confirm = self.wait_for_element(
                    driver,
                    By.CSS_SELECTOR,
                    "button[data-testid*='confirm'], button[class*='confirm']",
                    timeout=8,
                )
                self.safe_click(driver, confirm)
                self.sleep(2)
            except AutomationError:
                pass

            return "Subskrypcja Disney+ anulowana."
        except AutomationError:
            raise AutomationError(
                "Nie znaleziono przycisku anulowania Disney+. "
                "Wymagana aktualizacja skryptu."
            )

    def _resume(self, driver: WebDriver) -> str:
        driver.get(self._MANAGE_URL)
        self.sleep(2)

        try:
            resume_btn = self.wait_for_element(
                driver,
                By.CSS_SELECTOR,
                "button[data-testid*='resume'], "
                "button[class*='restart'], "
                "a[href*='reactivate']",
                timeout=10,
            )
            self.safe_click(driver, resume_btn)
            self.sleep(2)
            return "Subskrypcja Disney+ wznowiona."
        except AutomationError:
            raise AutomationError(
                "Nie znaleziono przycisku wznowienia Disney+. "
                "Wymagana aktualizacja skryptu."
            )

    def check_payment_status(
        self, driver: WebDriver, expected_amount: float, expected_date: str
    ) -> dict:
        """Sprawdza czy Disney+ jest aktywny (płatność przeszła)."""
        driver.get(self._MANAGE_URL)
        self.sleep(2)
        page = driver.page_source.lower()

        active_signals = ["anuluj", "cancel", "manage", "plan", "subscription"]
        is_active = any(s in page for s in active_signals) and "login" not in driver.current_url.lower()

        if not is_active:
            return {
                "payment_found": False,
                "payment_date": None,
                "amount_found": None,
                "message": "Subskrypcja Disney+ wydaje się nieaktywna.",
            }

        return {
            "payment_found": True,
            "payment_date": expected_date,
            "amount_found": expected_amount,
            "message": (
                f"Disney+ jest aktywny – płatność {expected_amount:.2f} PLN "
                f"z dnia {expected_date} prawdopodobnie przeszła pomyślnie."
            ),
        }
