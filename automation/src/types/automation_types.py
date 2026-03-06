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
    SCRAPE = "scrape"   # Pobierz dane rozliczeniowe (plan, kwota, data płatności)


class JobStatus(str, Enum):
    PENDING            = "pending"
    RUNNING            = "running"
    WAITING_FOR_USER   = "waiting_for_user"   # CAPTCHA / 2FA
    COMPLETED          = "completed"
    FAILED             = "failed"


# ─── Requesty ─────────────────────────────────────────────────────────────────

class RunAutomationRequest(BaseModel):
    """Uruchomienie automatyzacji dla subskrypcji.
    Dane logowania przekazywane wyłącznie w body requestu – nigdy nie są zapisywane.
    """
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
    # email i password są wymagane tylko dla CANCEL/RESUME.
    # Dla SCRAPE użytkownik loguje się ręcznie w otwartej przeglądarce.
    email: Optional[str] = Field(default=None, max_length=254, description="Login/e-mail – tylko CANCEL/RESUME")
    password: Optional[str] = Field(default=None, max_length=256, description="Hasło – tylko CANCEL/RESUME")
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


class CheckPaymentResponse(BaseModel):
    """Wynik sprawdzania statusu płatności."""

    subscription_id: str
    payment_found: bool
    payment_date: Optional[str] = None   # ISO yyyy-MM-dd lub None
    amount_found: Optional[float] = None
    message: str


class ScrapedBillingData(BaseModel):
    """Dane rozliczeniowe pobrane automatycznie przez Selenium."""

    plan_name: Optional[str] = None
    amount: Optional[float] = None
    currency: Optional[str] = None           # ISO kod np. "PLN", "USD"
    payment_cycle: Optional[str] = None      # "monthly" | "yearly"
    next_payment_date: Optional[str] = None  # ISO yyyy-MM-dd
    raw_info: Optional[str] = None           # Surowy tekst ze strony (debug)


class HealthResponse(BaseModel):
    status: str = "ok"
    version: str = "1.0.0"
