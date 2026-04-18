import sqlite3
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException

from ..config import Settings, get_settings
from ..deps import get_current_user, get_db
from ..schemas import SessionRequest, SessionResponse
from ..session_token import sign_session_token

router = APIRouter(prefix="/sessions", tags=["sessions"])


def resolve_document_role(db: sqlite3.Connection, document_id: str, user_id: str):
    document = db.execute(
        "SELECT owner_user_id FROM documents WHERE document_id = ?",
        (document_id,),
    ).fetchone()
    if document is None:
        raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": "document not found"}})

    if document["owner_user_id"] == user_id:
        return "owner"

    permission = db.execute(
        "SELECT role FROM document_permissions WHERE document_id = ? AND user_id = ?",
        (document_id, user_id),
    ).fetchone()
    if permission is None:
        raise HTTPException(status_code=403, detail={"error": {"code": "PERMISSION_DENIED", "message": "document access denied"}})
    return permission["role"]


@router.post("", response_model=SessionResponse, summary="Issue a realtime collaboration session")
def create_session(
    payload: SessionRequest,
    current_user=Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> SessionResponse:
    role = resolve_document_role(db, payload.document_id, current_user["user_id"])
    session_id = f"sess_{uuid4().hex[:12]}"
    expires_at = int((datetime.now(timezone.utc).timestamp() * 1000) + settings.session_token_ttl_seconds * 1000)
    token = sign_session_token(
        {
            "sessionId": session_id,
            "documentId": payload.document_id,
            "userId": current_user["user_id"],
            "role": role,
            "exp": expires_at,
        },
        settings.realtime_shared_secret,
    )
    return SessionResponse(
        session_id=session_id,
        ws_url=f"{settings.realtime_ws_base_url}?token={token}",
        role=role,
    )
