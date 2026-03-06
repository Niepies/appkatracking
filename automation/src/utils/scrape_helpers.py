"""
Pomocnicze funkcje do scrapingu danych rozliczeniowych.
Współdzielone przez skrypty wszystkich serwisów.
"""
from __future__ import annotations

import datetime
import re
import time
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from selenium.webdriver.chrome.webdriver import WebDriver


def _get_spa_innertext(driver: "WebDriver", extra_wait: float = 0) -> str:
    """
    Czeka na pełne wyrenderowanie SPA i zwraca document.body.innerText
    (widoczny tekst strony, nie surowy HTML).
    To jest kluczowe dla stron React/Next.js, gdzie page_source jest pustym szkieletem.
    """
    try:
        # Poczekaj na document.readyState === 'complete'
        deadline = time.time() + 10
        while time.time() < deadline:
            state = driver.execute_script("return document.readyState")
            if state == "complete":
                break
            time.sleep(0.3)

        # Poczekaj na zniknięcie loaderów
        loader_css = (
            "[class*='loading'],[class*='skeleton'],[class*='spinner'],"
            "[aria-busy='true'],[data-loading='true'],[class*='Loader']"
        )
        deadline = time.time() + 6
        while time.time() < deadline:
            has_loader = driver.execute_script(
                f"return !!document.querySelector('{loader_css}')"
            )
            if not has_loader:
                break
            time.sleep(0.4)

        if extra_wait > 0:
            time.sleep(extra_wait)

        # Przewiń strony żeby wyzwolić lazy loading
        driver.execute_script("window.scrollTo(0, 300);")
        time.sleep(0.5)
        driver.execute_script("window.scrollTo(0, 0);")
        time.sleep(0.3)

        return driver.execute_script("return document.body.innerText") or ""
    except Exception:
        return ""


def _extract_next_data_json(driver: "WebDriver") -> str | None:
    """
    Próbuje wyciągnąć dane z window.__NEXT_DATA__ (Next.js)
    lub ze script tagów z JSON (React/Redux initial state).
    Zwraca surowy string JSON lub None.
    """
    try:
        result = driver.execute_script("""
            // Next.js initial state
            if (window.__NEXT_DATA__) return JSON.stringify(window.__NEXT_DATA__);

            // React/Redux lub inne — szukaj dużych script[type=application/json]
            var scripts = document.querySelectorAll('script[type="application/json"]');
            for (var s of scripts) {
                if (s.textContent && s.textContent.length > 100) return s.textContent;
            }

            // Szukaj skryptów z danymi subskrypcji w treści
            var allScripts = document.querySelectorAll('script:not([src])');
            for (var s of allScripts) {
                var t = s.textContent || '';
                if (t.includes('planName') || t.includes('nextBillingDate') ||
                    t.includes('subscription') && t.includes('price')) {
                    return t.substring(0, 50000);
                }
            }
            return null;
        """)
        return result
    except Exception:
        return None


def _parse_date_str(text: str) -> str | None:
    """Próbuje sparsować datę z tekstu i zwrócić ISO YYYY-MM-DD."""
    if not text:
        return None

    # Format ISO: 2026-03-13
    m = re.search(r"(20\d{2})-(\d{2})-(\d{2})", text)
    if m:
        return m.group(0)

    # Format DD.MM.YYYY lub DD/MM/YYYY
    m = re.search(r"(\d{1,2})[./](\d{1,2})[./](20\d{2})", text)
    if m:
        try:
            return datetime.date(int(m.group(3)), int(m.group(2)), int(m.group(1))).isoformat()
        except ValueError:
            pass

    # Format Month DD, YYYY (English)
    months_en = {
        "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
        "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
    }
    m = re.search(
        r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2}),?\s+(20\d{2})",
        text, re.IGNORECASE,
    )
    if m:
        try:
            mon = months_en[m.group(1)[:3].lower()]
            return datetime.date(int(m.group(3)), mon, int(m.group(2))).isoformat()
        except (ValueError, KeyError):
            pass

    # Format DD Month YYYY (English)
    m = re.search(
        r"(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(20\d{2})",
        text, re.IGNORECASE,
    )
    if m:
        try:
            mon = months_en[m.group(2)[:3].lower()]
            return datetime.date(int(m.group(3)), mon, int(m.group(1))).isoformat()
        except (ValueError, KeyError):
            pass

    return None


def _parse_polish_date(text: str) -> str | None:
    """Parsuje polską datę, np. '13 marca 2026'."""
    months_pl = {
        "stycz": 1, "luty": 2, "lute": 2, "marc": 3, "kwiet": 4, "kwi": 4,
        "maj": 5, "czerw": 6, "cze": 6, "lip": 7, "sierp": 8, "wrze": 9,
        "paźdz": 10, "paz": 10, "list": 11, "grud": 12,
    }
    m = re.search(r"(\d{1,2})\s+([a-ząćęłńóśźż]+)\s+(20\d{2})", text, re.IGNORECASE)
    if m:
        month_str = m.group(2).lower()
        for key, mon in months_pl.items():
            if month_str.startswith(key):
                try:
                    return datetime.date(int(m.group(3)), mon, int(m.group(1))).isoformat()
                except ValueError:
                    pass
    return None


def _extract_amount_and_currency(text: str) -> tuple[float | None, str | None]:
    """
    Wyciąga kwotę i walutę z tekstu.
    Zwraca (amount, currency_code) lub (None, None) jeśli nie znaleziono.
    """
    currency_map = {
        "PLN": "PLN", "zł": "PLN", "zl": "PLN",
        "USD": "USD", "$": "USD",
        "EUR": "EUR", "€": "EUR",
        "GBP": "GBP", "£": "GBP",
        "CHF": "CHF",
    }

    patterns = [
        r"(\d+[,.]\d{2})\s*(PLN|zł|USD|EUR|GBP|CHF)",
        r"(PLN|USD|EUR|GBP|CHF|\$|€|£)\s*(\d+[,.]\d{2})",
        r"(\d+[,.]\d{2})\s*/\s*(?:miesi|month|mo)",
        r"(\d+)\s*(PLN|zł|USD|EUR|GBP|CHF)\b",
    ]

    for pattern in patterns:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            # Znajdź grupę z liczbą
            for g in m.groups():
                if g and re.match(r"^\d+[,.]?\d*$", g):
                    try:
                        amount = float(g.replace(",", "."))
                        # Znajdź walutę w dopasowaniu
                        full = m.group(0)
                        currency = None
                        for sym, code in currency_map.items():
                            if sym in full:
                                currency = code
                                break
                        return amount, currency
                    except ValueError:
                        pass

    return None, None
