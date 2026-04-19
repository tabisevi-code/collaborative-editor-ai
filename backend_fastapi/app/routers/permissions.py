import json
import sqlite3
from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from ..database import append_realtime_event
from ..deps import get_current_user, get_db
from ..document_access import ensure_owner
from ..errors import api_error
from ..schemas import PermissionEntry, PermissionListResponse, PermissionUpdateRequest, PermissionUpdateResponse, RevokePermissionResponse

router = APIRouter(prefix="/documents/{document_id}/permissions", tags=["permissions"])


@router.get("", response_model=PermissionListResponse, summary="List document permissions")
def list_permissions(document_id: str, current_user=Depends(get_current_user), db: sqlite3.Connection = Depends(get_db)) -> PermissionListResponse:
    ensure_owner(db, document_id, current_user["user_id"])
    rows = db.execute(
        "SELECT user_id, role, updated_at FROM document_permissions WHERE document_id = ? ORDER BY updated_at DESC",
        (document_id,),
    ).fetchall()
    return PermissionListResponse(
        document_id=document_id,
        members=[PermissionEntry(user_id=row["user_id"], role=row["role"], updated_at=row["updated_at"]) for row in rows],
    )


@router.put("", response_model=PermissionUpdateResponse, summary="Grant or update document permission")
def update_permission(
    document_id: str,
    payload: PermissionUpdateRequest,
    current_user=Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
) -> PermissionUpdateResponse:
    owner_document = ensure_owner(db, document_id, current_user["user_id"])
    if payload.target_user_id == owner_document["owner_user_id"]:
        raise api_error(400, "INVALID_INPUT", "owner role cannot be reassigned")

    user_exists = db.execute("SELECT user_id FROM users WHERE user_id = ?", (payload.target_user_id,)).fetchone()
    if user_exists is None:
        raise api_error(404, "NOT_FOUND", "target user not found")

    updated_at = datetime.now(timezone.utc).isoformat()
    db.execute(
        """
        INSERT INTO document_permissions (document_id, user_id, role, updated_at, granted_by_user_id, granted_via_share_link_id)
        VALUES (?, ?, ?, ?, ?, NULL)
        ON CONFLICT(document_id, user_id) DO UPDATE SET
            role = excluded.role,
            updated_at = excluded.updated_at,
            granted_by_user_id = excluded.granted_by_user_id,
            granted_via_share_link_id = NULL
        """,
        (document_id, payload.target_user_id, payload.role, updated_at, current_user["user_id"]),
    )
    append_realtime_event(
        db,
        document_id,
        "permission_updated",
        json.dumps({"targetUserId": payload.target_user_id, "role": payload.role}),
        updated_at,
    )
    db.commit()
    return PermissionUpdateResponse(
        document_id=document_id,
        target_user_id=payload.target_user_id,
        role=payload.role,
        updated_at=updated_at,
    )


@router.delete("/{target_user_id}", response_model=RevokePermissionResponse, summary="Revoke document access")
def revoke_permission(
    document_id: str,
    target_user_id: str,
    current_user=Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
) -> RevokePermissionResponse:
    owner_document = ensure_owner(db, document_id, current_user["user_id"])
    if target_user_id == owner_document["owner_user_id"]:
        raise api_error(400, "INVALID_INPUT", "owner access cannot be revoked")

    db.execute(
        "DELETE FROM document_permissions WHERE document_id = ? AND user_id = ?",
        (document_id, target_user_id),
    )
    timestamp = datetime.now(timezone.utc).isoformat()
    append_realtime_event(
        db,
        document_id,
        "access_revoked",
        json.dumps({"targetUserId": target_user_id}),
        timestamp,
    )
    db.commit()
    return RevokePermissionResponse(document_id=document_id, target_user_id=target_user_id, revoked=True)
