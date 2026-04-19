import sqlite3
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, Request

from ..config import Settings, get_settings
from ..deps import get_current_user, get_db
from ..document_access import ensure_document_access
from ..rate_limit import enforce_rate_limit
from ..schemas import SessionRequest, SessionResponse
from ..session_token import sign_session_token

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("", response_model=SessionResponse, summary="Issue a realtime collaboration session")
def create_session(
    payload: SessionRequest,
    request: Request,
    current_user=Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> SessionResponse:
    enforce_rate_limit(db, "session_issue", request.client.host if request.client else "unknown", 60, 60)
    document = ensure_document_access(db, payload.document_id, current_user["user_id"], "viewer")
    session_id = f"sess_{uuid4().hex[:12]}"
    expires_at = int((datetime.now(timezone.utc).timestamp() * 1000) + settings.session_token_ttl_seconds * 1000)
    token = sign_session_token(
        {
            "sessionId": session_id,
            "documentId": payload.document_id,
            "userId": current_user["user_id"],
            "role": document["role"],
            "exp": expires_at,
        },
        settings.realtime_shared_secret,
    )
    return SessionResponse(session_id=session_id, ws_url=settings.realtime_ws_base_url, session_token=token, role=document["role"])
