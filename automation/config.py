"""
Konfiguracja mikroserwisu automatyzacji.
Wartości są wczytywane ze zmiennych środowiskowych / pliku .env.
"""
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Bezpieczeństwo
    automation_api_key: str = "dev-insecure-key-change-in-production"

    # Pliki danych
    audit_log_file: Path = Path("./data/audit.log")

    # Przeglądarka
    headless: bool = True
    browser_timeout: int = 30
    max_concurrent_sessions: int = 3

    # Serwer
    port: int = 8001
    frontend_url: str = "http://localhost:3000"

    def ensure_data_dirs(self) -> None:
        self.audit_log_file.parent.mkdir(parents=True, exist_ok=True)


settings = Settings()
settings.ensure_data_dirs()
