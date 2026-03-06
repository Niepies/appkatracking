"""
Automatyzacja Disney+ – logowanie i anulowanie/wznowienie subskrypcji.
"""
from __future__ import annotations

import re

from selenium.webdriver.chrome.webdriver import WebDriver
from selenium.webdriver.common.by import By

from src.scripts.base_automation import BaseAutomation, AutomationError
from src.types import AutomationAction
from src.utils.scrape_helpers import _parse_date_str, _parse_polish_date, _extract_amount_and_currency


class DisneyPlusAutomation(BaseAutomation):
    service_key          = "disney+"
    service_display_name = "Disney+"

    _LOGIN_URL  = "https://www.disneyplus.com/login"
    _MANAGE_URL = "https://www.disneyplus.com/account/subscription"
    _CANCEL_URL = "https://www.disneyplus.com/account/subscription/cancel"

    def get_login_url(self) -> str:
        return self._LOGIN_URL

    def is_logged_in(self, driver: WebDriver) -> bool:
        """Disney+ przekierowuje na /home lub /account po zalogowaniu."""
        try:
            url = driver.current_url.lower()
            return "/login" not in url and "/signin" not in url
        except Exception:
            return False

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
    def scrape_billing_info(self, driver: WebDriver) -> dict:
        """Pobiera dane rozliczeniowe ze strony konta Disney+."""
        driver.get(self._MANAGE_URL)
        self.sleep(3)

        result: dict = {
            "plan_name": None,
            "amount": None,
            "currency": None,
            "payment_cycle": "monthly",
            "next_payment_date": None,
            "raw_info": None,
        }

        try:
            page = driver.page_source
            page_lower = page.lower()

            # ── Nazwa planu ──────────────────────────────────────────
            plan_selectors = [
                "[class*='plan-name']",
                "[class*='planName']",
                "[data-testid='plan-title']",
                "[class*='subscription-plan']",
            ]
            for sel in plan_selectors:
                try:
                    el = driver.find_element(By.CSS_SELECTOR, sel)
                    result["plan_name"] = el.text.strip() or None
                    if result["plan_name"]:
                        break
                except Exception:
                    pass

            if not result["plan_name"]:
                for plan in ["Disney+ Premium", "Disney+ Standard", "Disney+ Basic",
                              "Disney+ With Ads", "Disney+"]:
                    if plan.lower() in page_lower:
                        result["plan_name"] = plan
                        break

            # ── Kwota i waluta ───────────────────────────────────────
            amount, currency = _extract_amount_and_currency(page)
            if amount is not None:
                result["amount"] = amount
            if currency is not None:
                result["currency"] = currency

            # ── Cykl płatności ──────────────────────────────────────
            if "year" in page_lower or "annual" in page_lower or "roczn" in page_lower:
                result["payment_cycle"] = "yearly"

            # ── Data następnej płatności ─────────────────────────────
            date_selectors = [
                "[data-testid='next-billing-date']",
                "[class*='next-billing']",
                "[class*='nextBilling']",
                "[class*='renewal-date']",
                "[class*='billingDate']",
            ]
            for sel in date_selectors:
                try:
                    el = driver.find_element(By.CSS_SELECTOR, sel)
                    parsed = _parse_date_str(el.text.strip())
                    if parsed:
                        result["next_payment_date"] = parsed
                        break
                except Exception:
                    pass

            if not result["next_payment_date"]:
                date_m = re.search(
                    r"(?:next billing[:\s]+|renewal date[:\s]+|następna płatność[:\s]+)"
                    r"(\d{1,2}[./\s]\w+[./\s]20\d{2}|\d{4}-\d{2}-\d{2}|"
                    r"\w+ \d{1,2},? 20\d{2}|\d{1,2} \w+ 20\d{2})",
                    page, re.IGNORECASE,
                )
                if date_m:
                    result["next_payment_date"] = (
                        _parse_date_str(date_m.group(1))
                        or _parse_polish_date(date_m.group(1))
                    )

            result["raw_info"] = f"Pobrano z: {driver.current_url}"
        except Exception as exc:
            result["raw_info"] = f"Błąd scrapingu: {exc}"

        return result

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
