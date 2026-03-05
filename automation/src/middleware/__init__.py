# automation/src/middleware/__init__.py
from .auth_middleware import ApiKeyMiddleware

__all__ = ["ApiKeyMiddleware"]
