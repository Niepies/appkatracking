"""
Audyt i logowanie akcji.

Każda akcja automatyzacji jest zapisywana do pliku JSONL ze znacznikiem czasu,
identyfikatorem sesji, serwisem, akcją i wynikiem.
Dane logowania NIGDY nie trafiają do logów.
"""
from __future__ import annotations

import json
import threading
from datetime import datetime, timezone
from typing import Optional

from config import settings


class AuditLogger:
    """Wątkobezpieczny logger audytu do pliku JSONL."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._file = settings.audit_log_file

    def log(
        self,
        *,
        action: str,
        service_key: str,
        job_id: str,
        initiated_by: str = "user",
        status: str,
        message: str,
        subscription_id: Optional[str] = None,
        extra: Optional[dict] = None,
    ) -> None:
        entry = {
            "ts":              datetime.now(timezone.utc).isoformat(),
            "job_id":          job_id,
            "action":          action,
            "service_key":     service_key,
            "subscription_id": subscription_id,
            "initiated_by":    initiated_by,
            "status":          status,
            "message":         message,
        }
        if extra:
            # Upewniamy się, że żadne dane uwierzytelniające nie trafiają do logów
            safe_extra = {k: v for k, v in extra.items() if k not in ("password", "token", "secret")}
            entry["extra"] = safe_extra

        line = json.dumps(entry, ensure_ascii=False)
        with self._lock:
            try:
                self._file.parent.mkdir(parents=True, exist_ok=True)
                with self._file.open("a", encoding="utf-8") as f:
                    f.write(line + "\n")
            except Exception as exc:
                print(f"[AuditLogger] Błąd zapisu: {exc}")

        # Zawsze drukuj na stdout (dla debugowania)
        print(f"[AUDIT] {line}")


# Singleton
audit_logger = AuditLogger()
