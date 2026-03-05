"""
Szyfrowany magazyn danych logowania.

Dane logowania są szyfrowane przy użyciu kryptografii symetrycznej Fernet
(AES-128-CBC + HMAC-SHA256). Klucz nigdy nie jest przechowywany razem z danymi.

Plik danych ma format JSON Lines (JSONL), gdzie każda linia to:
  {"service_key": "...", "email_enc": "<base64>", "password_enc": "<base64>"}

UWAGA BEZPIECZEŃSTWA:
- Klucz ENCRYPTION_KEY musi być przechowywany poza repozytorium (env / vault).
- Dane logowania nigdy nie są logowane ani zwracane w API.
- Dostęp do endpointów credential jest chroniony kluczem API.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken

from config import settings


class CredentialService:
    """Zaszyfrowany magazyn danych logowania per-serwis."""

    def __init__(self) -> None:
        key = settings.encryption_key
        if not key:
            # W środowisku deweloperskim generujemy klucz tymczasowy (NIE jest persystowany)
            key = Fernet.generate_key().decode()
            print(
                "[CredentialService] WARN: ENCRYPTION_KEY nie ustawiony – "
                "używam klucza tymczasowego. Dane NIE przetrwają restartu."
            )
        try:
            self._fernet = Fernet(key.encode() if isinstance(key, str) else key)
        except Exception as exc:
            raise ValueError(
                "ENCRYPTION_KEY jest nieprawidłowy. Wygeneruj go poleceniem: "
                "python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
            ) from exc

        self._file: Path = settings.credentials_file
        self._cache: dict[str, dict[str, str]] = {}
        self._load()

    # ── Publiczne API ──────────────────────────────────────────────────────────

    def save(self, service_key: str, email: str, password: str) -> None:
        """Zaszyfruj i zapisz dane logowania dla serwisu."""
        self._cache[service_key] = {
            "email_enc":    self._encrypt(email),
            "password_enc": self._encrypt(password),
        }
        self._persist()

    def load(self, service_key: str) -> Optional[tuple[str, str]]:
        """Zwraca odszyfrowaną parę (email, password) lub None."""
        entry = self._cache.get(service_key)
        if not entry:
            return None
        try:
            email    = self._decrypt(entry["email_enc"])
            password = self._decrypt(entry["password_enc"])
            return email, password
        except InvalidToken:
            return None

    def has_credentials(self, service_key: str) -> bool:
        return service_key in self._cache

    def delete(self, service_key: str) -> bool:
        """Usuwa dane logowania dla serwisu. Zwraca True jeśli istniały."""
        existed = service_key in self._cache
        self._cache.pop(service_key, None)
        if existed:
            self._persist()
        return existed

    def list_services(self) -> list[str]:
        return list(self._cache.keys())

    # ── Prywatne ──────────────────────────────────────────────────────────────

    def _encrypt(self, plaintext: str) -> str:
        return self._fernet.encrypt(plaintext.encode()).decode()

    def _decrypt(self, ciphertext: str) -> str:
        return self._fernet.decrypt(ciphertext.encode()).decode()

    def _load(self) -> None:
        if not self._file.exists():
            return
        try:
            with self._file.open("r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    entry = json.loads(line)
                    key = entry.get("service_key")
                    if key:
                        self._cache[key] = {
                            "email_enc":    entry["email_enc"],
                            "password_enc": entry["password_enc"],
                        }
        except Exception as exc:
            print(f"[CredentialService] Błąd ładowania credentials: {exc}")

    def _persist(self) -> None:
        self._file.parent.mkdir(parents=True, exist_ok=True)
        lines = []
        for service_key, entry in self._cache.items():
            lines.append(json.dumps({
                "service_key":  service_key,
                "email_enc":    entry["email_enc"],
                "password_enc": entry["password_enc"],
            }))
        with self._file.open("w", encoding="utf-8") as f:
            f.write("\n".join(lines))
            if lines:
                f.write("\n")


# Singleton
credential_service = CredentialService()
