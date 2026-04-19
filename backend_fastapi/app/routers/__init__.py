from .ai import router as ai_router
from .auth import router as auth_router
from .document_crud import router as document_crud_router
from .documents import router as documents_router
from .exports import router as exports_router
from .health import router as health_router
from .permissions import router as permissions_router
from .sessions import router as sessions_router
from .share_links import router as share_links_router
from .versions import router as versions_router

__all__ = [
    "auth_router",
    "ai_router",
    "document_crud_router",
    "documents_router",
    "exports_router",
    "health_router",
    "permissions_router",
    "sessions_router",
    "share_links_router",
    "versions_router",
]
