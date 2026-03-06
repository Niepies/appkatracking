"""
Automatyzacja Max (dawniej HBO Max) – scraping danych rozliczeniowych.

play.max.com to SPA (Next.js/React) – dane renderowane są przez JS.
Scraper czeka na pełne wyrenderowanie i używa document.body.innerText
zamiast page_source, oraz próbuje odczytać window.__NEXT_DATA__.
"""
from __future__ import annotations

import json
import re

from selenium.webdriver.chrome.webdriver import WebDriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException

from src.scripts.base_automation import BaseAutomation, AutomationError
from src.types import AutomationAction
from src.utils.scrape_helpers import (
    _parse_date_str,
    _parse_polish_date,
    _extract_amount_and_currency,
    _get_spa_innertext,
    _extract_next_data_json,
)


class MaxAutomation(BaseAutomation):
    service_key          = "max"
    service_display_name = "Max"

    _LOGIN_URL   = "https://play.max.com/login"
    _SETTINGS_URL = "https://play.max.com/settings"
    _ACCOUNT_URL  = "https://play.max.com/account"

    # CSS selektory do próby – Max zmienia je często, więc lista fallbacków
    _PLAN_SELECTORS = [
        "[data-testid='subscription-plan-name']",
        "[data-testid='plan-name']",
        "[class*='planName']",
        "[class*='plan-name']",
        "[class*='subscriptionName']",
        "[class*='offer-name']",
        "h1[class*='plan']",
        "h2[class*='plan']",
        "h3[class*='plan']",
    ]
    _PRICE_SELECTORS = [
        "[data-testid='subscription-price']",
        "[data-testid='price']",
        "[class*='price']",
        "[class*='billingAmount']",
        "[class*='billing-amount']",
    ]
    _DATE_SELECTORS = [
        "[data-testid='next-billing-date']",
        "[data-testid='renewal-date']",
        "[class*='nextBilling']",
        "[class*='next-billing']",
        "[class*='renewalDate']",
        "[class*='renewal-date']",
    ]

    def get_login_url(self) -> str:
        return self._LOGIN_URL

    def is_logged_in(self, driver: WebDriver) -> bool:
        try:
            url = driver.current_url.lower()
            # Zalogowany gdy nie jest na stronie logowania
            return "/login" not in url and "/signin" not in url and "auth" not in url
        except Exception:
            return False

    def login(self, driver: WebDriver, email: str, password: str) -> None:
        # Logowanie ręczne – ta metoda nie jest używana w trybie SCRAPE
        raise AutomationError("Max używa trybu ręcznego logowania (SCRAPE).")

    def navigate_to_subscription(self, driver: WebDriver) -> None:
        """Nawiguje do strony ustawień Max i czeka na pełne renderowanie React."""
        self._goto_and_wait(driver, self._SETTINGS_URL, wait=4)

        # Sprawdź czy strona załadowała treść (nie jesteśmy na login/404)
        try:
            visible = driver.execute_script("return document.body.innerText") or ""
            if len(visible.strip()) < 50 or "login" in driver.current_url.lower():
                # Fallback do /account
                self._goto_and_wait(driver, self._ACCOUNT_URL, wait=4)
        except Exception:
            pass

    def _goto_and_wait(self, driver: WebDriver, url: str, wait: float = 3) -> None:
        """Nawiguje do URL i czeka na document.readyState === 'complete'."""
        driver.get(url)
        self.sleep(1)
        try:
            WebDriverWait(driver, 12).until(
                lambda d: d.execute_script("return document.readyState") == "complete"
            )
        except Exception:
            pass
        self.sleep(wait)


    def execute_action(self, driver: WebDriver, action: AutomationAction) -> str:
        raise AutomationError(
            "Automatyczne anulowanie/wznowienie Max nie jest jeszcze zaimplementowane. "
            "Przejdź ręcznie na: " + self._SETTINGS_URL
        )

    def detect_captcha(self, driver: WebDriver) -> bool:
        from src.scripts.base_automation import _CAPTCHA_HINTS
        try:
            page = driver.page_source.lower()
            return any(hint in page for hint in _CAPTCHA_HINTS)
        except Exception:
            return False

    def scrape_billing_info(self, driver: WebDriver) -> dict:
        """
        Pobiera dane rozliczeniowe z Max.
        Strategia (od najlepszej do fallback):
          1. CSS selektory konkretnych elementów DOM
          2. Parsowanie window.__NEXT_DATA__ (Next.js state)
          3. Parsowanie document.body.innerText (widoczny tekst)
        Jeśli jesteśmy już na stronie z danymi – nie nawiguje ponownie.
        """
        result: dict = {
            "plan_name": None,
            "amount": None,
            "currency": None,
            "payment_cycle": None,
            "next_payment_date": None,
            "raw_info": None,
        }

        # Daj stronie czas na wyrenderowanie komponentów React
        try:
            WebDriverWait(driver, 15).until(
                lambda d: d.execute_script("return document.readyState") == "complete"
            )
        except Exception:
            pass

        # Poczekaj aż znikną loadery
        self._wait_for_no_loader(driver)

        # ── Strategia 1: CSS selektory ────────────────────────────────────────
        result["plan_name"] = self._try_css_text(driver, self._PLAN_SELECTORS)
        price_text = self._try_css_text(driver, self._PRICE_SELECTORS)
        if price_text:
            amt, cur = _extract_amount_and_currency(price_text)
            result["amount"] = amt
            result["currency"] = cur
        date_text = self._try_css_text(driver, self._DATE_SELECTORS)
        if date_text:
            result["next_payment_date"] = _parse_date_str(date_text) or _parse_polish_date(date_text)

        # ── Strategia 2: window.__NEXT_DATA__ ────────────────────────────────
        if not result["plan_name"] or result["amount"] is None:
            next_data = _extract_next_data_json(driver)
            if next_data:
                self._parse_next_data(next_data, result)

        # ── Strategia 3: document.body.innerText ─────────────────────────────
        visible_text = _get_spa_innertext(driver)
        if visible_text:
            self._parse_visible_text(visible_text, result)

        result["raw_info"] = (
            f"Max scraping z: {driver.current_url}. "
            f"Plan: {result.get('plan_name')}, "
            f"Kwota: {result.get('amount')} {result.get('currency')}, "
            f"Cykl: {result.get('payment_cycle')}, "
            f"Następna płatność: {result.get('next_payment_date')}"
        )
        return result

    # ── Pomocnicze ────────────────────────────────────────────────────────────

    def _wait_for_no_loader(self, driver: WebDriver, timeout: float = 8.0) -> None:
        """Czeka aż znikną loadery / skelety."""
        loader_selectors = (
            "[class*='loading'],[class*='skeleton'],[class*='spinner'],"
            "[aria-busy='true'],[data-loading='true']"
        )
        try:
            WebDriverWait(driver, timeout).until_not(
                EC.presence_of_element_located((By.CSS_SELECTOR, loader_selectors))
            )
        except Exception:
            self.sleep(2)  # fallback

    def _try_css_text(self, driver: WebDriver, selectors: list[str]) -> str | None:
        """Próbuje wyciągnąć tekst używając kolejnych selektorów CSS."""
        for sel in selectors:
            try:
                els = driver.find_elements(By.CSS_SELECTOR, sel)
                for el in els:
                    text = el.text.strip()
                    if text:
                        return text
            except Exception:
                continue
        return None

    def _parse_next_data(self, data_str: str, result: dict) -> None:
        """Parsuje window.__NEXT_DATA__ szukając danych subskrypcji."""
        try:
            data = json.loads(data_str)
        except Exception:
            return

        # Spłaszcz wszystkie wartości do przeszukiwalnego stringa
        flat = json.dumps(data, ensure_ascii=False)

        # Kwota
        if result["amount"] is None:
            amt, cur = _extract_amount_and_currency(flat)
            if amt is not None:
                result["amount"] = amt
                result["currency"] = cur

        # Nazwa planu
        if not result["plan_name"]:
            plan_m = re.search(
                r'"(?:planName|plan_name|offerName|offer_name|productName|name)":\s*"([^"]{3,60})"',
                flat,
            )
            if plan_m:
                result["plan_name"] = plan_m.group(1)

        # Data następnej płatności
        if not result["next_payment_date"]:
            date_m = re.search(
                r'"(?:nextBillingDate|next_billing_date|renewalDate|renewal_date|'
                r'nextPaymentDate|next_payment_date)":\s*"([^"]{6,30})"',
                flat,
            )
            if date_m:
                result["next_payment_date"] = (
                    _parse_date_str(date_m.group(1))
                    or _parse_polish_date(date_m.group(1))
                )

    def _parse_visible_text(self, text: str, result: dict) -> None:
        """Parsuje widoczny tekst strony – ostateczny fallback."""
        # Kwota
        if result["amount"] is None:
            amt, cur = _extract_amount_and_currency(text)
            if amt is not None:
                result["amount"] = amt
                if result["currency"] is None:
                    result["currency"] = cur

        # Cykl płatności
        if result["payment_cycle"] is None:
            tl = text.lower()
            if any(w in tl for w in ["year", "annual", "roczn", "/year", "/yr"]):
                result["payment_cycle"] = "yearly"
            elif any(w in tl for w in ["month", "miesięcz", "miesiąc", "/mo", "/mies"]):
                result["payment_cycle"] = "monthly"

        # Nazwa planu – Max używa nazw "Max Standard", "Max Ad Free", itp.
        if not result["plan_name"]:
            plan_m = re.search(
                r"(Max\s+(?:Ultimate\s+)?(?:Ad[\s-]Free|Standard(?:\s+with\s+Ads)?|Basic)|"
                r"HBO\s+Max\s+\w+|Max\s+\w+(?:\s+\w+)?)",
                text,
                re.IGNORECASE,
            )
            if plan_m:
                result["plan_name"] = plan_m.group(1).strip()

        # Data następnej płatności
        if not result["next_payment_date"]:
            date_m = re.search(
                r"(?:next billing|renewal(?: date)?|następn[ae] płatno|odnowieni[ae])"
                r"[^\d]{0,25}(\d{4}-\d{2}-\d{2}|\d{1,2}[./]\d{1,2}[./]20\d{2}|"
                r"(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+20\d{2}|"
                r"\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+20\d{2}|"
                r"\d{1,2}\s+\w+\s+20\d{2})",
                text,
                re.IGNORECASE,
            )
            if date_m:
                raw_date = date_m.group(1)
                result["next_payment_date"] = (
                    _parse_date_str(raw_date) or _parse_polish_date(raw_date)
                )
