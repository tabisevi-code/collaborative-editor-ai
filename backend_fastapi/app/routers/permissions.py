import sqlite3
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status

from ..deps import get_current_user, get_db
from ..schemas import PermissionEntry, PermissionListResponse, PermissionUpdateRequest

router = APIRouter(prefix="/documents/{document_id}/permissions", tags=["permissions"])


def ensure_owner(db: sqlite3.Connection, document_id: str, user_id: str):
    row = db.execute(
        "SELECT owner_user_id FROM documents WHERE document_id = ?",
        (document_id,),
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": "document not found"}})
    if row["owner_user_id"] != user_id:
        raise HTTPException(status_code=403, detail={"error": {"code": "PERMISSION_DENIED", "message": "owner access required"}})


@router.get("", response_model=PermissionListResponse, summary="List document permissions")
def list_permissions(document_id: str, current_user=Depends(get_current_user), db: sqlite3.Connection = Depends(get_db)):
    ensure_owner(db, document_id, current_user["user_id"])
    rows = db.execute(
        "SELECT user_id, role, updated_at FROM document_permissions WHERE document_id = ? ORDER BY updated_at DESC",
        (document_id,),
    ).fetchall()
    return PermissionListResponse(
        document_id=document_id,
        members=[PermissionEntry(user_id=row["user_id"], role=row["role"], updated_at=row["updated_at"]) for row in rows],
    )


@router.put("", summary="Grant or update document permission")
def update_permission(
    document_id: str,
    payload: PermissionUpdateRequest,
    current_user=Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    ensure_owner(db, document_id, current_user["user_id"])
    if payload.role not in {"viewer", "editor"}:
        raise HTTPException(status_code=400, detail={"error": {"code": "INVALID_INPUT", "message": "role must be viewer or editor"}})

    user_exists = db.execute("SELECT user_id FROM users WHERE user_id = ?", (payload.target_user_id,)).fetchone()
    if user_exists is None:
        raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": "target user not found"}})

    updated_at = datetime.now(timezone.utc).isoformat()
    db.execute(
        """
        INSERT INTO document_permissions (document_id, user_id, role, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(document_id, user_id) DO UPDATE SET role = excluded.role, updated_at = excluded.updated_at
        """,
        (document_id, payload.target_user_id, payload.role, updated_at),
    )
    db.commit()
    return {
        "documentId": document_id,
        "targetUserId": payload.target_user_id,
        "role": payload.role,
        "updatedAt": updated_at,
    }


@router.delete("/{target_user_id}", summary="Revoke document access")
def revoke_permission(
    document_id: str,
    target_user_id: str,
    current_user=Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    ensure_owner(db, document_id, current_user["user_id"])
    db.execute(
        "DELETE FROM document_permissions WHERE document_id = ? AND user_id = ?",
        (document_id, target_user_id),
    )
    db.commit()
    return {
        "documentId": document_id,
        "targetUserId": target_user_id,
        "revoked": True,
    }
