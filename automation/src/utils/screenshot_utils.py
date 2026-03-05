"""
Narzędzia do przechwytywania zrzutów ekranu z sesji przeglądarki.
"""
from __future__ import annotations

import base64
from typing import Optional

from selenium.webdriver.remote.webdriver import WebDriver


def take_screenshot_base64(driver: WebDriver) -> Optional[str]:
    """Zwraca zrzut ekranu jako string base64 (PNG) lub None w razie błędu."""
    try:
        png_bytes: bytes = driver.get_screenshot_as_png()
        return base64.b64encode(png_bytes).decode("utf-8")
    except Exception as exc:
        print(f"[Screenshot] Błąd przechwytywania: {exc}")
        return None


def take_screenshot_bytes(driver: WebDriver) -> Optional[bytes]:
    """Zwraca zrzut ekranu jako bajty PNG lub None w razie błędu."""
    try:
        return driver.get_screenshot_as_png()
    except Exception as exc:
        print(f"[Screenshot] Błąd przechwytywania: {exc}")
        return None
