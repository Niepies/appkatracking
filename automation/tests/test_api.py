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

class TestCredentials:
    def test_save_credential(self):
        response = client.post(
            "/api/credentials",
            json={"service_key": "test-service", "email": "user@test.com", "password": "s3cur3!"},
            headers=HEADERS,
        )
        assert response.status_code == 200
        assert "test-service" in response.json()["message"]

    def test_check_credential_exists(self):
        # Zapisz najpierw
        client.post(
            "/api/credentials",
            json={"service_key": "check-service", "email": "a@b.com", "password": "pw"},
            headers=HEADERS,
        )
        response = client.get("/api/credentials/check-service", headers=HEADERS)
        assert response.status_code == 200
        assert response.json()["has_credentials"] is True

    def test_check_credential_not_exists(self):
        response = client.get("/api/credentials/nonexistent-xyz", headers=HEADERS)
        assert response.status_code == 200
        assert response.json()["has_credentials"] is False

    def test_delete_credential(self):
        # Zapisz
        client.post(
            "/api/credentials",
            json={"service_key": "del-service", "email": "x@y.com", "password": "p"},
            headers=HEADERS,
        )
        # Usuń
        response = client.delete("/api/credentials/del-service", headers=HEADERS)
        assert response.status_code == 200
        # Sprawdź że nie ma
        check = client.get("/api/credentials/del-service", headers=HEADERS)
        assert check.json()["has_credentials"] is False

    def test_delete_nonexistent_returns_404(self):
        response = client.delete("/api/credentials/ghost-service", headers=HEADERS)
        assert response.status_code == 404

    def test_invalid_service_key_rejected(self):
        response = client.post(
            "/api/credentials",
            json={"service_key": "INVALID KEY!", "email": "a@b.com", "password": "p"},
            headers=HEADERS,
        )
        assert response.status_code == 422  # Walidacja Pydantic


# ─── Automation API ───────────────────────────────────────────────────────────

class TestAutomationApi:
    def test_run_without_credentials_returns_400(self):
        response = client.post(
            "/api/automation/run",
            json={
                "subscription_id": "sub-123",
                "service_key": "no-creds-service",
                "action": "cancel",
            },
            headers=HEADERS,
        )
        assert response.status_code == 400
        assert "Brak zaszyfrowanych danych" in response.json()["detail"]

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


# ─── Credential Service unit tests ────────────────────────────────────────────

class TestCredentialServiceEncryption:
    def test_encryption_roundtrip(self):
        from src.services.credential_service import CredentialService
        from cryptography.fernet import Fernet

        # Tworzony tymczasowy service z nowym kluczem
        settings.encryption_key = Fernet.generate_key().decode()
        svc = CredentialService()

        svc.save("roundtrip-svc", "user@example.com", "supersecret")
        result = svc.load("roundtrip-svc")

        assert result is not None
        assert result[0] == "user@example.com"
        assert result[1] == "supersecret"

    def test_credentials_not_stored_in_plaintext(self):
        from src.services.credential_service import CredentialService
        from cryptography.fernet import Fernet

        settings.encryption_key = Fernet.generate_key().decode()
        svc = CredentialService()
        svc.save("plain-test", "secret@mail.com", "mypassword123")

        # Sprawdź surowe dane w cache – powinny być zaszyfrowane
        raw = svc._cache.get("plain-test", {})
        assert "secret@mail.com" not in raw.get("email_enc", "")
        assert "mypassword123" not in raw.get("password_enc", "")
