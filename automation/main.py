"""
Punkt wejścia mikroserwisu automatyzacji SubsControl.

Uruchomienie:
  cd automation
  uvicorn main:app --host 0.0.0.0 --port 8001 --reload

Lub przez skrypt:
  python main.py
"""
from __future__ import annotations

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from src.middleware import ApiKeyMiddleware
from src.routes import automation_router

# ─── Aplikacja ────────────────────────────────────────────────────────────────

app = FastAPI(
    title="SubsControl Automation API",
    description=(
        "Mikroserwis automatyzacji subskrypcji – umożliwia automatyczne "
        "anulowanie i wznawianie subskrypcji przy użyciu Selenium WebDriver.\n\n"
        "**Uwaga bezpieczeństwa**: Wszystkie endpointy wymagają nagłówka "
        "`X-API-Key` z wartością ustawioną w zmiennej `AUTOMATION_API_KEY`."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# ── Auth middleware ────────────────────────────────────────────────────────────
app.add_middleware(ApiKeyMiddleware)

# ── Routery ───────────────────────────────────────────────────────────────────
app.include_router(automation_router)


# ─── Endpointy publiczne ──────────────────────────────────────────────────────

@app.get("/", tags=["public"])
def root():
    return {"service": "SubsControl Automation API", "version": "1.0.0"}


@app.get("/health", tags=["public"])
def health():
    return {
        "status": "ok",
        "active_sessions": 0,  # browser_service.active_count() wywołane lazily
    }


# ─── Entry point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.port,
        reload=True,
        log_level="info",
    )
