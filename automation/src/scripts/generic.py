"""
Generyczny skrypt automatyzacji – fallback dla serwisów bez dedykowanego skryptu.

Otwiera bezpośrednio stronę zarządzania / anulowania subskrypcji z bazy SERVICE_URL_MAP.
Jeśli serwis jest nieznany, próbuje wyszukania w Google.
"""
from __future__ import annotations

from urllib.parse import quote_plus

from selenium.webdriver.chrome.webdriver import WebDriver

from src.scripts.base_automation import BaseAutomation, AutomationError
from src.types import AutomationAction


# Mapowanie service_key -> URL zarządzania subskrypcją
# (podzbiór z web_app/lib/service-urls.ts – istotne dla automatyzacji)
_MANAGE_URLS: dict[str, tuple[str, str | None]] = {
    #  key            manage_url                                               cancel_url
    "hbomax":         ("https://play.max.com/account/manage-subscriptions",   None),
    "max":            ("https://play.max.com/account/manage-subscriptions",   None),
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
        # Generyczny automatyzator zawsze prosi o interakcję po załadowaniu strony
        return True

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
