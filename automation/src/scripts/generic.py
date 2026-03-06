"""
Generyczny skrypt automatyzacji – fallback dla serwisów bez dedykowanego skryptu.

Otwiera bezpośrednio stronę zarządzania / anulowania subskrypcji z bazy SERVICE_URL_MAP.
Jeśli serwis jest nieznany, próbuje wyszukania w Google.
"""
from __future__ import annotations

import re
from urllib.parse import quote_plus

from selenium.webdriver.chrome.webdriver import WebDriver

from src.scripts.base_automation import BaseAutomation, AutomationError
from src.types import AutomationAction
from src.utils.scrape_helpers import _parse_date_str, _parse_polish_date, _extract_amount_and_currency, _get_spa_innertext


# Mapowanie service_key -> URL zarządzania subskrypcją
# (podzbiór z web_app/lib/service-urls.ts – istotne dla automatyzacji)
_MANAGE_URLS: dict[str, tuple[str, str | None]] = {
    #  key            manage_url                                               cancel_url
    "hbomax":         ("https://play.max.com/settings",                        None),
    "max":            ("https://play.max.com/settings",                        None),
    "amazonprime":    ("https://www.amazon.pl/gp/subs/primeclub/manage/home.html", None),
    "primevideo":     ("https://www.primevideo.com/settings/",                 None),
    "appletv+":       ("https://appleid.apple.com/account/manage/section/subscriptions", None),
    "youtubepremium": ("https://www.youtube.com/paid_memberships",            None),
    "canalplus":      ("https://www.canalplus.com/mon-compte/",               None),
    "canal+":         ("https://www.canalplus.com/mon-compte/",               None),
    "tidal":          ("https://listen.tidal.com/account/subscription",       "https://account.tidal.com/subscription/cancel"),
    "chatgptplus":    ("https://chatgpt.com/#account/manage-subscription",    None),
    "githubcopilot":  ("https://github.com/settings/billing/plans",           None),
    "adobecc":        ("https://account.adobe.com/plans",                     "https://account.adobe.com/plans?q=CANCEL"),
    "microsoft365":   ("https://account.microsoft.com/services/",             "https://account.microsoft.com/services/microsoft365/cancel"),
    "nordvpn":        ("https://my.nordaccount.com/subscriptions/",           None),
    "dropbox":        ("https://www.dropbox.com/account/plan",               "https://www.dropbox.com/account/plan/cancel"),
    "notion":         ("https://www.notion.so/profile/subscription",          None),
    "googleone":      ("https://one.google.com/u/0/about",                    None),
}


class GenericAutomation(BaseAutomation):
    """
    Generyczny automatyzator: otwiera stronę zarządzania lub anulowania
    dla serwisu, czeka na działanie użytkownika (WAITING_FOR_USER).

    Dla w pełni zautomatyzowanych serwisów bez dedykowanego skryptu –
    to tryb pomocniczy, który otwiera odpowiedni URL i przekazuje
    kontrolę użytkownikowi.
    """

    service_key          = "generic"
    service_display_name = "Generic"

    def __init__(self, target_service_key: str) -> None:
        self.service_key = target_service_key
        self.service_display_name = target_service_key.capitalize()

    def login(self, driver: WebDriver, email: str, password: str) -> None:
        # Generyczny automatyzator nie loguje się automatycznie.
        # Zamiast tego otwiera stronę zarządzania i przekazuje kontrolę.
        pass

    def get_login_url(self) -> str:
        """Otwiera stronę zarządzania serwisu – użytkownik loguje się sam."""
        entry = _MANAGE_URLS.get(self.service_key)
        if entry:
            return entry[0]
        # Fallback: wyszukaj jak zarządzać subskrypcją
        query = quote_plus(f"{self.service_key} account login")
        return f"https://www.google.com/search?q={query}"

    def is_logged_in(self, driver: WebDriver) -> bool:
        """Heurystyka: nie jest na stronie logowania i URL nie jest o Google."""
        try:
            url = driver.current_url.lower()
            login_patterns = ["login", "signin", "sign-in", "logowanie", "google.com/search"]
            return not any(p in url for p in login_patterns)
        except Exception:
            return False

    def navigate_to_subscription(self, driver: WebDriver) -> None:
        entry = _MANAGE_URLS.get(self.service_key)
        if entry:
            driver.get(entry[0])
        else:
            # Wyszukaj instrukcję w Google
            query = quote_plus(f"how to cancel {self.service_key} subscription")
            driver.get(f"https://www.google.com/search?q={query}")

    def execute_action(self, driver: WebDriver, action: AutomationAction) -> str:
        entry = _MANAGE_URLS.get(self.service_key)

        if action == AutomationAction.CANCEL and entry and entry[1]:
            driver.get(entry[1])
        elif entry:
            driver.get(entry[0])

        # Dla generycznej automatyzacji zawsze dajemy kontrolę użytkownikowi
        # (nie wiemy jak wygląda konkretna strona)
        return (
            f"Otworzyłem stronę zarządzania dla {self.service_display_name}. "
            f"Strona jest gotowa – wykonaj akcję ręcznie, a następnie kliknij 'Kontynuuj'."
        )

    def detect_captcha(self, driver: WebDriver) -> bool:
        # Używamy standardowej detekcji po słowach kluczowych (z BaseAutomation)
        try:
            from src.scripts.base_automation import _CAPTCHA_HINTS
            page_source = driver.page_source.lower()
            return any(hint in page_source for hint in _CAPTCHA_HINTS)
        except Exception:
            return False

    def scrape_billing_info(self, driver: WebDriver) -> dict:
        """
        Generyczne pobieranie danych rozliczeniowych – best-effort.
        Nie nawiguje ponownie – navigate_to_subscription() już to zrobiło.
        """
        entry = _MANAGE_URLS.get(self.service_key)
        # Jeśli jesteśmy na innej stronie niż manage URL, nawiguj
        try:
            current = driver.current_url
            target = entry[0] if entry else None
            if target and target not in current:
                driver.get(target)
        except Exception:
            pass

        result: dict = {
            "plan_name": None,
            "amount": None,
            "currency": None,
            "payment_cycle": None,
            "next_payment_date": None,
            "raw_info": None,
        }

        try:
            # Pobierz wyrenderowany widoczny tekst (działa na SPA) + surowy HTML
            visible_text = _get_spa_innertext(driver, extra_wait=2)
            page = visible_text or driver.page_source
            page_lower = page.lower()

            # Kwota i waluta
            amount, currency = _extract_amount_and_currency(page)
            if amount is not None:
                result["amount"] = amount
            if currency is not None:
                result["currency"] = currency

            # Cykl płatności
            if "year" in page_lower or "annual" in page_lower or "roczn" in page_lower:
                result["payment_cycle"] = "yearly"
            elif "month" in page_lower or "miesięczn" in page_lower:
                result["payment_cycle"] = "monthly"

            # Data następnej płatności (najszersza heurystyka)
            date_m = re.search(
                r"(?:next billing|next payment|renewal|następna płatność|data odnowienia)"
                r"[^0-9]{0,20}(\d{4}-\d{2}-\d{2}|\d{1,2}[./]\d{1,2}[./]20\d{2}|"
                r"\w+ \d{1,2},? 20\d{2}|\d{1,2} \w+ 20\d{2})",
                page, re.IGNORECASE,
            )
            if date_m:
                result["next_payment_date"] = (
                    _parse_date_str(date_m.group(1))
                    or _parse_polish_date(date_m.group(1))
                )

            result["raw_info"] = (
                f"Generyczny scraping z: {driver.current_url}. "
                f"Dane mogą być niepełne – zalecana ręczna weryfikacja."
            )
        except Exception as exc:
            result["raw_info"] = f"Błąd scrapingu: {exc}"

        return result

    def check_payment_status(
        self, driver: WebDriver, expected_amount: float, expected_date: str
    ) -> dict:
        """Generyczny serwis nie może automatycznie weryfikować płatności."""
        return {
            "payment_found": False,
            "payment_date": None,
            "amount_found": None,
            "message": (
                f"Automatyczna weryfikacja płatności niedostępna dla serwisu "
                f"'{self.service_display_name}'. Sprawdź historię płatności ręcznie."
            ),
        }
