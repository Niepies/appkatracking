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
    CheckPaymentRequest,
    CheckPaymentResponse,
)
from src.services.session_service import session_service
from src.services.browser_service import browser_service
from src.services.credential_service import credential_service
from src.scripts import get_automation

router = APIRouter(prefix="/api/automation", tags=["automation"])


# ─── Uruchomienie ──────────────────────────────────────────────────────────────

@router.post("/run", response_model=AutomationJobResponse, status_code=status.HTTP_202_ACCEPTED)
def run_automation(body: RunAutomationRequest) -> AutomationJobResponse:
    """
    Uruchomia automatyzację w tle.
    Zwraca job_id do śledzenia statusu.
    """
    # Sprawdź czy mamy dane logowania
    if not credential_service.has_credentials(body.service_key):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Brak zaszyfrowanych danych logowania dla serwisu '{body.service_key}'. "
                f"Najpierw zapisz dane przez POST /api/credentials."
            ),
        )

    # Utwórz job
    job = session_service.create_job(
        subscription_id=body.subscription_id,
        service_key=body.service_key,
        action=body.action,
        initiated_by=body.initiated_by,
    )

    # Uruchom automatyzację w osobnym wątku (nie blokuje HTTP)
    thread = threading.Thread(
        target=_run_automation_thread,
        args=(job.job_id, body.service_key, body.action),
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


# ─── Sprawdzanie płatności ─────────────────────────────────────────────────────

@router.post("/check-payment", response_model=CheckPaymentResponse)
def check_payment_status(body: CheckPaymentRequest) -> CheckPaymentResponse:
    """
    Synchronicznie loguje się do serwisu i sprawdza czy płatność za dany cykl przeszła.
    Heurystyka: aktywna subskrypcja po terminie płatności = płatność przetworzona.
    Może zająć 30–60 sekund (Selenium).
    """
    if not credential_service.has_credentials(body.service_key):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Brak danych logowania dla serwisu '{body.service_key}'. "
                   f"Zapisz je przez POST /api/credentials.",
        )

    job_id = f"check-{body.subscription_id}"
    driver = None
    try:
        creds = credential_service.load(body.service_key)
        if not creds:
            raise HTTPException(status_code=500, detail="Błąd odczytu danych logowania.")
        email, password = creds

        driver = browser_service.create_driver(job_id)
        automation = get_automation(body.service_key)
        result = automation.check(
            driver=driver,
            email=email,
            password=password,
            expected_amount=body.expected_amount,
            expected_date=body.expected_date,
        )

        return CheckPaymentResponse(
            subscription_id=body.subscription_id,
            payment_found=result["payment_found"],
            payment_date=result.get("payment_date"),
            amount_found=result.get("amount_found"),
            message=result["message"],
        )

    except HTTPException:
        raise
    except Exception as exc:
        return CheckPaymentResponse(
            subscription_id=body.subscription_id,
            payment_found=False,
            message=f"Błąd podczas sprawdzania płatności: {exc}",
        )
    finally:
        if driver:
            browser_service.close_driver(job_id)


# ─── Wewnętrzna funkcja wątku ─────────────────────────────────────────────────
def _run_automation_thread(job_id: str, service_key: str, action) -> None:
    """
    Wykonuje automatyzację w osobnym wątku.
    Zarządza cyklem życia przeglądarki i joba.
    """
    job = session_service.get_job(job_id)
    if not job:
        return

    driver = None
    try:
        # Pobierz dane logowania
        creds = credential_service.load(service_key)
        if not creds:
            job.set_error("Błąd odczytu zaszyfrowanych danych logowania.")
            job.update(status=JobStatus.FAILED, message="Błąd danych logowania.")
            return

        email, password = creds

        # Utwórz przeglądarkę
        driver = browser_service.create_driver(job_id)

        # Pobierz automatyzator i uruchom
        automation = get_automation(service_key)
        automation.run(driver=driver, email=email, password=password, action=action, job=job)

    except Exception as exc:
        if job:
            job.set_error(str(exc))
            job.update(status=JobStatus.FAILED, message=f"Błąd krytyczny: {str(exc)}")
    finally:
        if driver:
            browser_service.close_driver(job_id)
        session_service.cleanup_finished()
