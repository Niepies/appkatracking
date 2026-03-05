"""
Endpointy REST API do zarządzania zaszyfrowanymi danymi logowania.

POST   /api/credentials          – zapisz / zaktualizuj dane logowania
DELETE /api/credentials/{key}    – usuń dane logowania
GET    /api/credentials/{key}    – sprawdź czy dane istnieją (NIE zwraca haseł)
GET    /api/credentials          – lista serwisów z zapisanymi danymi
"""
from fastapi import APIRouter, HTTPException, status

from src.types import SaveCredentialRequest, DeleteCredentialRequest, CredentialStatusResponse
from src.services.credential_service import credential_service
from src.utils.audit_logger import audit_logger

router = APIRouter(prefix="/api/credentials", tags=["credentials"])


@router.post("", status_code=status.HTTP_200_OK)
def save_credential(body: SaveCredentialRequest):
    """Zaszyfruj i zapisz dane logowania dla serwisu."""
    try:
        credential_service.save(
            service_key=body.service_key,
            email=body.email,
            password=body.password,
        )
        audit_logger.log(
            action="save_credential",
            service_key=body.service_key,
            job_id="n/a",
            initiated_by="user",
            status="completed",
            message=f"Dane logowania dla '{body.service_key}' zapisane.",
        )
        return {"message": f"Dane logowania dla '{body.service_key}' zapisane pomyślnie."}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.delete("/{service_key}", status_code=status.HTTP_200_OK)
def delete_credential(service_key: str):
    """Usuń dane logowania dla serwisu."""
    existed = credential_service.delete(service_key)
    if not existed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Brak danych logowania dla serwisu '{service_key}'.",
        )
    audit_logger.log(
        action="delete_credential",
        service_key=service_key,
        job_id="n/a",
        initiated_by="user",
        status="completed",
        message=f"Dane logowania dla '{service_key}' usunięte.",
    )
    return {"message": f"Dane logowania dla '{service_key}' usunięte."}


@router.get("/{service_key}", response_model=CredentialStatusResponse)
def check_credential(service_key: str) -> CredentialStatusResponse:
    """Sprawdź czy dane logowania dla serwisu istnieją (NIE zwraca hasła)."""
    return CredentialStatusResponse(
        service_key=service_key,
        has_credentials=credential_service.has_credentials(service_key),
    )


@router.get("", status_code=status.HTTP_200_OK)
def list_credentials():
    """Zwraca listę kluczy serwisów z zapisanymi danymi logowania."""
    return {"services": credential_service.list_services()}
