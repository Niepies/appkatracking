"""
Testy jednostkowe i integracyjne API automatyzacji.

Uruchomienie:
  cd automation
  pip install -r requirements.txt
  pytest tests/ -v
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from main import app
from config import settings

# Nadpisujemy klucz API dla testów
settings.automation_api_key = "test-api-key-for-unit-tests"

client = TestClient(app)
HEADERS = {"X-API-Key": "test-api-key-for-unit-tests"}


# ─── Auth ─────────────────────────────────────────────────────────────────────

class TestApiKeyAuth:
    def test_no_key_returns_401(self):
        response = client.get("/api/automation/jobs")
        assert response.status_code == 401

    def test_wrong_key_returns_401(self):
        response = client.get(
            "/api/automation/jobs",
            headers={"X-API-Key": "wrong-key"},
        )
        assert response.status_code == 401

    def test_correct_key_succeeds(self):
        response = client.get("/api/automation/jobs", headers=HEADERS)
        assert response.status_code == 200

    def test_health_is_public(self):
        response = client.get("/health")
        assert response.status_code == 200


# ─── Credentials ──────────────────────────────────────────────────────────────

# ─── Credentials endpointy zostały usunięte – dane logowania nie są przechowywane
# Testy poniżej dotyczą tylko endpointów automatyzacji.

# ─── Automation API ───────────────────────────────────────────────────────────

class TestAutomationApi:
    def test_run_without_credentials_is_accepted(self):
        """POST /run z email/password w body powinien zwrócić 202 i job_id."""
        response = client.post(
            "/api/automation/run",
            json={
                "subscription_id": "sub-123",
                "service_key": "netflix",
                "action": "cancel",
                "email": "test@example.com",
                "password": "testpass",
            },
            headers=HEADERS,
        )
        # 202 – automatyzacja uruchomiona w tle
        assert response.status_code == 202
        assert "job_id" in response.json()

    def test_run_missing_email_returns_422(self):
        """Body bez email/password powinno zwrócić 422 (walidacja Pydantic)."""
        response = client.post(
            "/api/automation/run",
            json={
                "subscription_id": "sub-123",
                "service_key": "netflix",
                "action": "cancel",
            },
            headers=HEADERS,
        )
        assert response.status_code == 422

    def test_status_unknown_job_returns_404(self):
        response = client.get(
            "/api/automation/status/nonexistent-job-id",
            headers=HEADERS,
        )
        assert response.status_code == 404

    def test_continue_nonexistent_job_returns_404(self):
        response = client.post(
            "/api/automation/continue/nonexistent-job-id",
            headers=HEADERS,
        )
        assert response.status_code == 404

    def test_jobs_list_returns_list(self):
        response = client.get("/api/automation/jobs", headers=HEADERS)
        assert response.status_code == 200
        assert "jobs" in response.json()
