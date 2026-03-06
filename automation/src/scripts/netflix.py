"""
Automatyzacja Netflix – logowanie i anulowanie/wznowienie subskrypcji.

UWAGA: Skrypt automatyzuje konto WŁASNEGO użytkownika. Dane logowania
są przechowywane zaszyfrowane i używane wyłącznie do tej operacji.
"""
from __future__ import annotations

import re

from selenium.webdriver.chrome.webdriver import WebDriver
from selenium.webdriver.common.by import By

from src.scripts.base_automation import BaseAutomation, AutomationError
from src.types import AutomationAction
from src.utils.scrape_helpers import _parse_date_str, _parse_polish_date, _extract_amount_and_currency, _get_spa_innertext


class NetflixAutomation(BaseAutomation):
    service_key          = "netflix"
    service_display_name = "Netflix"

    _LOGIN_URL      = "https://www.netflix.com/login"
    _MANAGE_URL     = "https://www.netflix.com/account"
    _CANCEL_URL     = "https://www.netflix.com/cancelplan"

    def get_login_url(self) -> str:
        return self._LOGIN_URL

    def is_logged_in(self, driver: WebDriver) -> bool:
        """Netflix przekierowuje po zalogowaniu na /browse lub /YourAccount."""
        try:
            url = driver.current_url.lower()
            return any(p in url for p in ["/browse", "/youraccount", "/account", "/profiles"])
        except Exception:
            return False

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

    def scrape_billing_info(self, driver: WebDriver) -> dict:
        """Pobiera dane rozliczeniowe z konta Netflix."""
        driver.get(self._MANAGE_URL)
        self.sleep(3)

        result: dict = {
            "plan_name": None,
            "amount": None,
            "currency": None,
            "payment_cycle": "monthly",  # Netflix zawsze miesięczny
            "next_payment_date": None,
            "raw_info": None,
        }

        try:
            # innerText = wyrenderowany tekst (działa dla React/SPA)
            # page_source = surowy HTML szkielet (fallback dla SSR)
            inner_text = _get_spa_innertext(driver)
            page = driver.page_source
            # Preferuj innerText do regex-ów; page dla CSS selektorów
            search_text = inner_text if inner_text.strip() else page
            page_lower = search_text.lower()

            # ── Nazwa planu ──────────────────────────────────────────
            plan_selectors = [
                "[data-uia='plan-label']",
                ".current-plan",
                "[class*='planLabel']",
                "[class*='plan-name']",
                "[data-uia='membership-plan']",
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
                for plan in ["Premium", "Standard with ads", "Standard", "Basic",
                              "Standard z reklamami", "Podstawowy"]:
                    if plan.lower() in page_lower:
                        result["plan_name"] = plan
                        break

            # ── Kwota i waluta ───────────────────────────────────────
            amount, currency = _extract_amount_and_currency(search_text)
            if amount is not None:
                result["amount"] = amount
            if currency is not None:
                result["currency"] = currency

            # ── Data następnej płatności ─────────────────────────────
            date_selectors = [
                "[data-uia='next-billing-date']",
                "[data-uia='billing-date']",
                "[class*='nextBillingDate']",
                "[class*='billing-date']",
                "[class*='next-billing']",
                "[class*='membershipBillingDate']",
                "[class*='billing_date']",
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
                # Szukaj w regex na wyrenderowanym tekście
                date_m = re.search(
                    r"(?:next billing|billing date|następna płatność|odnowienie)[:\s]*(\d{1,2}[./\s]\w+[./\s]20\d{2}|\d{4}-\d{2}-\d{2}|\w+\s+\d{1,2},?\s+20\d{2}|\d{1,2}\s+\w+\s+20\d{2})",
                    search_text, re.IGNORECASE
                )
                if date_m:
                    result["next_payment_date"] = (
                        _parse_date_str(date_m.group(1))
                        or _parse_polish_date(date_m.group(1))
                    )

            if not result["next_payment_date"]:
                # Polska data "13 marca 2026" w dowolnym miejscu
                pol_m = re.search(
                    r"(\d{1,2})\s+(stycz|luty|lute|marc|kwiet|kwi|maj|czerw|cze|lip|sierp|wrze|paźdz|paz|list|grud)\w*\s+(20\d{2})",
                    search_text, re.IGNORECASE
                )
                if pol_m:
                    result["next_payment_date"] = _parse_polish_date(pol_m.group(0))

            result["raw_info"] = f"Pobrano z: {driver.current_url}"
        except Exception as exc:
            result["raw_info"] = f"Błąd scrapingu: {exc}"

        return result

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
