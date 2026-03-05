"""
Modele Pydantic – kontrakty REST API mikroserwisu automatyzacji.
"""
from __future__ import annotations

from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


# ─── Enums ────────────────────────────────────────────────────────────────────

class AutomationAction(str, Enum):
    CANCEL = "cancel"
    RESUME = "resume"


class JobStatus(str, Enum):
    PENDING            = "pending"
    RUNNING            = "running"
    WAITING_FOR_USER   = "waiting_for_user"   # CAPTCHA / 2FA
    COMPLETED          = "completed"
    FAILED             = "failed"


# ─── Requesty ─────────────────────────────────────────────────────────────────

class SaveCredentialRequest(BaseModel):
    """Zapis zaszyfrowanych danych logowania dla danego serwisu."""
    service_key: str = Field(
        ...,
        min_length=1,
        max_length=64,
        pattern=r"^[a-z0-9_\-]+$",
        description="Klucz serwisu, np. 'netflix', 'spotify'",
    )
    email: str = Field(..., min_length=3, max_length=254)
    password: str = Field(..., min_length=1, max_length=256)


class DeleteCredentialRequest(BaseModel):
    service_key: str = Field(..., min_length=1, max_length=64, pattern=r"^[a-z0-9_\-]+$")


class RunAutomationRequest(BaseModel):
    """Uruchomienie automatyzacji dla subskrypcji."""
    subscription_id: str = Field(..., min_length=1, max_length=64)
    service_key: str = Field(
        ...,
        min_length=1,
        max_length=64,
        pattern=r"^[a-z0-9_\-]+$",
        description="Klucz rozpoznawanego serwisu (np. 'netflix'). "
                    "Jeśli nie ma dedykowanego skryptu, użyty zostanie 'generic'.",
    )
    action: AutomationAction
    initiated_by: str = Field(default="user", max_length=64)


class ContinueSessionRequest(BaseModel):
    """Kontynuacja sesji po manualnym wypełnieniu CAPTCHA / 2FA."""
    job_id: str


# ─── Odpowiedzi ───────────────────────────────────────────────────────────────

class AutomationJobResponse(BaseModel):
    job_id: str
    status: JobStatus
    message: str
    screenshot_base64: Optional[str] = None   # PNG zakodowany w base64
    screenshot_url: Optional[str] = None      # np. /api/automation/screenshot/{job_id}
    result: Optional[str] = None               # Wynik końcowy (tekst)
    error: Optional[str] = None


class CredentialStatusResponse(BaseModel):
    service_key: str
    has_credentials: bool


class CheckPaymentRequest(BaseModel):
    """Sprawdzenie statusu płatności dla danego cyklu subskrypcji."""

    subscription_id: str = Field(..., min_length=1, max_length=64)
    service_key: str = Field(
        ...,
        min_length=1,
        max_length=64,
        pattern=r"^[a-z0-9_\-]+$",
    )
    expected_amount: float = Field(..., gt=0, description="Oczekiwana kwota płatności")
    expected_date: str = Field(
        ...,
        description="Oczekiwana data płatności w formacie yyyy-MM-dd",
    )


class CheckPaymentResponse(BaseModel):
    """Wynik sprawdzania statusu płatności."""

    subscription_id: str
    payment_found: bool
    payment_date: Optional[str] = None   # ISO yyyy-MM-dd lub None
    amount_found: Optional[float] = None
    message: str


class HealthResponse(BaseModel):
    status: str = "ok"
    version: str = "1.0.0"
