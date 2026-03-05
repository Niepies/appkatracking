"""
Sesje zadań automatyzacji – śledzi stan i metadane każdego job_id.
"""
from __future__ import annotations

import threading
import uuid
from datetime import datetime, timezone
from typing import Optional

from src.types import JobStatus, AutomationAction


class AutomationJob:
    def __init__(
        self,
        *,
        subscription_id: str,
        service_key: str,
        action: AutomationAction,
        initiated_by: str = "user",
    ) -> None:
        self.job_id:          str = str(uuid.uuid4())
        self.subscription_id: str = subscription_id
        self.service_key:     str = service_key
        self.action:          AutomationAction = action
        self.initiated_by:    str = initiated_by

        self.status:           JobStatus = JobStatus.PENDING
        self.message:          str = "Oczekiwanie na start…"
        self.result:           Optional[str] = None
        self.error:            Optional[str] = None
        self.screenshot_b64:  Optional[str] = None  # aktualny zrzut ekranu

        self.created_at:   datetime = datetime.now(timezone.utc)
        self.updated_at:   datetime = datetime.now(timezone.utc)

        # Event sygnalizujący kontynuację po CAPTCHA/2FA
        self._continue_event: threading.Event = threading.Event()

    # ── Mutatory ──────────────────────────────────────────────────────────────

    def update(self, *, status: JobStatus, message: str) -> None:
        self.status  = status
        self.message = message
        self.updated_at = datetime.now(timezone.utc)

    def set_screenshot(self, b64: Optional[str]) -> None:
        self.screenshot_b64 = b64

    def set_result(self, result: str) -> None:
        self.result = result

    def set_error(self, error: str) -> None:
        self.error = error

    def wait_for_user(self, timeout: float = 300.0) -> bool:
        """Blokuje do czasu sygnału kontynuacji lub upłynięcia timeout (s)."""
        return self._continue_event.wait(timeout=timeout)

    def signal_continue(self) -> None:
        """Sygnalizuje kontynuację automatyzacji (po 2FA/CAPTCHA)."""
        self._continue_event.set()


class SessionService:
    """Rejestr wszystkich zadań automatyzacji."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._jobs: dict[str, AutomationJob] = {}

    def create_job(
        self,
        *,
        subscription_id: str,
        service_key: str,
        action: AutomationAction,
        initiated_by: str = "user",
    ) -> AutomationJob:
        job = AutomationJob(
            subscription_id=subscription_id,
            service_key=service_key,
            action=action,
            initiated_by=initiated_by,
        )
        with self._lock:
            self._jobs[job.job_id] = job
        return job

    def get_job(self, job_id: str) -> Optional[AutomationJob]:
        with self._lock:
            return self._jobs.get(job_id)

    def list_jobs(self) -> list[AutomationJob]:
        with self._lock:
            return list(self._jobs.values())

    def cleanup_finished(self, max_keep: int = 50) -> None:
        """Usuwa stare zakończone joby, zachowując max_keep najnowszych."""
        with self._lock:
            finished_ids = [
                j.job_id
                for j in sorted(self._jobs.values(), key=lambda j: j.updated_at)
                if j.status in (JobStatus.COMPLETED, JobStatus.FAILED)
            ]
            for jid in finished_ids[:-max_keep]:
                del self._jobs[jid]


# Singleton
session_service = SessionService()
