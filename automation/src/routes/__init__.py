# automation/src/routes/__init__.py
from .automation_routes import router as automation_router
from .credential_routes import router as credential_router

__all__ = ["automation_router", "credential_router"]
