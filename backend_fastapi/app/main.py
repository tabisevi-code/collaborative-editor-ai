import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .errors import register_exception_handlers
from .routers import (
    ai_router,
    auth_router,
    document_crud_router,
    documents_router,
    exports_router,
    health_router,
    permissions_router,
    sessions_router,
    share_links_router,
    versions_router,
)

app = FastAPI(
    title="Collaborative Editor AI FastAPI",
    version="0.1.0",
    description="Assignment 2 FastAPI backend scaffold for the collaborative editor project.",
)

register_exception_handlers(app)
allowed_origins = [
    origin.strip()
    for origin in os.environ.get("FRONTEND_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(auth_router)
app.include_router(ai_router)
app.include_router(documents_router)
app.include_router(document_crud_router)
app.include_router(exports_router)
app.include_router(versions_router)
app.include_router(permissions_router)
app.include_router(sessions_router)
app.include_router(share_links_router)
