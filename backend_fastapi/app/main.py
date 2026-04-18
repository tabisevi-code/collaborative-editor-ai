from fastapi import FastAPI

from .config import get_settings
from .routers import (
    ai_router,
    auth_router,
    document_crud_router,
    documents_router,
    health_router,
    permissions_router,
    sessions_router,
    versions_router,
)

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="Assignment 2 FastAPI backend scaffold for the collaborative editor project.",
)

app.include_router(health_router)
app.include_router(auth_router)
app.include_router(ai_router)
app.include_router(documents_router)
app.include_router(document_crud_router)
app.include_router(versions_router)
app.include_router(permissions_router)
app.include_router(sessions_router)
