"""
Middleware uwierzytelniania API – weryfikuje klucz API w nagłówku X-API-Key.

Każde żądanie do endpointów /api/automation/* i /api/credentials/*
musi zawierać nagłówek:
  X-API-Key: <wartość AUTOMATION_API_KEY z .env>

Zwraca 401 przy braku lub błędnym kluczu.
"""
from __future__ import annotations

import secrets

from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

from config import settings

# Ścieżki wykluczone z auth (publiczne)
_PUBLIC_PATHS = {"/", "/health", "/docs", "/openapi.json", "/redoc"}


class ApiKeyMiddleware(BaseHTTPMiddleware):
    """Weryfikuje X-API-Key dla wszystkich chronionych endpointów."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        # Pomiń auth dla publicznych ścieżek
        if request.url.path in _PUBLIC_PATHS:
            return await call_next(request)

        api_key = request.headers.get("X-API-Key", "")

        # Porównanie stałoczasowe – zapobiega timing attack
        if not secrets.compare_digest(api_key, settings.automation_api_key):
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"detail": "Nieprawidłowy lub brakujący klucz API (X-API-Key)."},
            )

        return await call_next(request)
