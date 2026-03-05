"""
Usługa zarządzania sesjami przeglądarki Selenium.

Zarządza pulą sesji (ChromeDriver), ich tworzeniem i zamykaniem.
Respektuje MAX_CONCURRENT_SESSIONS, aby uniknąć przeciążenia zasobów.
"""
from __future__ import annotations

import threading
from typing import Optional

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager

from config import settings


class BrowserService:
    """Zarządza instancjami ChromeDriver."""

    def __init__(self) -> None:
        self._lock = threading.Semaphore(settings.max_concurrent_sessions)
        self._active: dict[str, webdriver.Chrome] = {}
        self._drivers_lock = threading.Lock()

    def create_driver(self, job_id: str) -> webdriver.Chrome:
        """
        Tworzy nowy ChromeDriver dla podanego job_id.
        Blokuje jeśli osiągnięto MAX_CONCURRENT_SESSIONS.
        """
        # Zajmij slot z semafora (blokuje jeśli max osiągnięty)
        self._lock.acquire()

        options = Options()
        if settings.headless:
            options.add_argument("--headless=new")

        # Ustawienia bezpieczeństwa i stabilności
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-gpu")
        options.add_argument("--window-size=1440,900")
        options.add_argument("--disable-blink-features=AutomationControlled")
        options.add_experimental_option("excludeSwitches", ["enable-automation"])
        options.add_experimental_option("useAutomationExtension", False)
        # User-Agent neutralny (nie zdradza Selenium)
        options.add_argument(
            "user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/121.0.0.0 Safari/537.36"
        )

        driver = webdriver.Chrome(
            service=Service(ChromeDriverManager().install()),
            options=options,
        )
        driver.set_page_load_timeout(settings.browser_timeout)
        driver.implicitly_wait(5)

        with self._drivers_lock:
            self._active[job_id] = driver

        return driver

    def get_driver(self, job_id: str) -> Optional[webdriver.Chrome]:
        with self._drivers_lock:
            return self._active.get(job_id)

    def close_driver(self, job_id: str) -> None:
        """Zamyka przeglądarkę i zwalnia slot z semafora."""
        with self._drivers_lock:
            driver = self._active.pop(job_id, None)

        if driver:
            try:
                driver.quit()
            except Exception:
                pass
            finally:
                self._lock.release()

    def active_count(self) -> int:
        with self._drivers_lock:
            return len(self._active)


# Singleton
browser_service = BrowserService()
