"""
Endpointy REST API do uruchamiania i monitorowania automatyzacji.

POST  /api/automation/run              – uruchom automatyzację
GET   /api/automation/status/{job_id}  – pobierz status joba
POST  /api/automation/continue/{job_id} – kontynuuj po CAPTCHA/2FA
GET   /api/automation/screenshot/{job_id} – pobierz zrzut ekranu (PNG)
GET   /api/automation/jobs             – lista aktywnych jobów
"""
from __future__ import annotations

import threading

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import Response

from src.types import (
    RunAutomationRequest,
    AutomationJobResponse,
    JobStatus,
    CheckPaymentResponse,
)
from src.services.session_service import session_service
from src.services.browser_service import browser_service
from src.scripts import get_automation

router = APIRouter(prefix="/api/automation", tags=["automation"])


# ─── Uruchomienie ──────────────────────────────────────────────────────────────

@router.post("/run", response_model=AutomationJobResponse, status_code=status.HTTP_202_ACCEPTED)
def run_automation(body: RunAutomationRequest) -> AutomationJobResponse:
    """
    Uruchomia automatyzację w tle.
    Dane logowania przekazywane wyłącznie w body – nie są nigdzie zapisywane.
    Zwraca job_id do śledzenia statusu.
    """
    # Utwórz job
    job = session_service.create_job(
        subscription_id=body.subscription_id,
        service_key=body.service_key,
        action=body.action,
        initiated_by=body.initiated_by,
    )

    # Uruchom automatyzację w osobnym wątku (nie blokuje HTTP)
    # email i password przekazywane tylko dla CANCEL/RESUME (SCRAPE = ręczny login przez użytkownika)
    thread = threading.Thread(
        target=_run_automation_thread,
        args=(job.job_id, body.service_key, body.action, body.email, body.password),
        daemon=True,
        name=f"automation-{job.job_id[:8]}",
    )
    thread.start()

    return AutomationJobResponse(
        job_id=job.job_id,
        status=JobStatus.PENDING,
        message="Automatyzacja uruchomiona. Śledź status przez GET /api/automation/status/{job_id}.",
    )


# ─── Status ────────────────────────────────────────────────────────────────────

@router.get("/status/{job_id}", response_model=AutomationJobResponse)
def get_job_status(job_id: str) -> AutomationJobResponse:
    """Pobiera aktualny status zadania automatyzacji."""
    job = session_service.get_job(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job '{job_id}' nie istnieje.",
        )
    return AutomationJobResponse(
        job_id=job.job_id,
        status=job.status,
        message=job.message,
        screenshot_url=(
            f"/api/automation/screenshot/{job_id}"
            if job.screenshot_b64 else None
        ),
        result=job.result,
        error=job.error,
    )


# ─── Kontynuacja po CAPTCHA/2FA ────────────────────────────────────────────────

@router.post("/continue/{job_id}", response_model=AutomationJobResponse)
def continue_automation(job_id: str) -> AutomationJobResponse:
    """Sygnalizuje kontynuację automatyzacji po ręcznym rozwiązaniu CAPTCHA/2FA."""
    job = session_service.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' nie istnieje.")

    if job.status != JobStatus.WAITING_FOR_USER:
        raise HTTPException(
            status_code=400,
            detail=f"Job '{job_id}' nie oczekuje na interakcję użytkownika (status: {job.status}).",
        )

    job.signal_continue()

    return AutomationJobResponse(
        job_id=job.job_id,
        status=JobStatus.RUNNING,
        message="Sygnał kontynuacji wysłany – automatyzacja wznowiona.",
    )


# ─── Zrzut ekranu ──────────────────────────────────────────────────────────────

@router.get("/screenshot/{job_id}")
def get_screenshot(job_id: str) -> Response:
    """Zwraca aktualny zrzut ekranu sesji przeglądarki jako obraz PNG."""
    job = session_service.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' nie istnieje.")

    if not job.screenshot_b64:
        raise HTTPException(status_code=404, detail="Brak zrzutu ekranu dla tego joba.")

    import base64
    png_bytes = base64.b64decode(job.screenshot_b64)
    return Response(content=png_bytes, media_type="image/png")


# ─── Lista jobów ───────────────────────────────────────────────────────────────

@router.get("/jobs")
def list_jobs():
    """Zwraca listę wszystkich aktywnych i zakończonych zadań."""
    jobs = session_service.list_jobs()
    return {
        "jobs": [
            {
                "job_id":          j.job_id,
                "subscription_id": j.subscription_id,
                "service_key":     j.service_key,
                "action":          j.action.value,
                "status":          j.status.value,
                "message":         j.message,
                "created_at":      j.created_at.isoformat(),
                "updated_at":      j.updated_at.isoformat(),
            }
            for j in sorted(jobs, key=lambda x: x.created_at, reverse=True)
        ]
    }


# ─── Wewnętrzna funkcja wątku ─────────────────────────────────────────────────
def _run_automation_thread(
    job_id: str,
    service_key: str,
    action,
    email: str | None,
    password: str | None,
) -> None:
    """
    Wykonuje automatyzację w osobnym wątku.
    email i password są None dla akcji SCRAPE (użytkownik loguje się ręcznie).
    Dla CANCEL/RESUME przekazywane są w RAM i czyszczone po użyciu.
    """
    job = session_service.get_job(job_id)
    if not job:
        return

    driver = None
    try:
        driver = browser_service.create_driver(job_id)
        automation = get_automation(service_key)
        automation.run(driver=driver, email=email, password=password, action=action, job=job)

    except Exception as exc:
        if job:
            job.set_error(str(exc))
            job.update(status=JobStatus.FAILED, message=f"Błąd krytyczny: {str(exc)}")
    finally:
        # Wyczyść referencje do danych logowania z ramki stosu
        email = ""
        password = ""
        if driver:
            browser_service.close_driver(job_id)
        session_service.cleanup_finished()
