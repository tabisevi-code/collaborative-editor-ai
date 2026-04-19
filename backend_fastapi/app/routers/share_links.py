from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, Query

from ..database import append_realtime_event
from ..deps import get_current_user, get_db
from ..document_access import ensure_owner
from ..errors import api_error
from ..idempotency import begin_idempotent_request, store_idempotent_response
from ..schemas import (
    AcceptShareLinkResponse,
    CreateShareLinkRequest,
    ShareLinkCreateResponse,
    ShareLinkListResponse,
    ShareLinkPreviewResponse,
    ShareLinkSummary,
)
from ..security import hash_opaque_token

router = APIRouter(tags=["share-links"])


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def to_share_link_summary(row: sqlite3.Row) -> ShareLinkSummary:
    return ShareLinkSummary(
        link_id=row["link_id"],
        role=row["role"],
        created_at=row["created_at"],
        expires_at=datetime.fromtimestamp(row["expires_at"], tz=timezone.utc).isoformat(),
        revoked_at=row["revoked_at"],
        last_claimed_at=row["last_claimed_at"],
        active=row["revoked_at"] is None and row["expires_at"] > int(datetime.now(timezone.utc).timestamp()),
    )


def get_share_link_row(db: sqlite3.Connection, share_token: str) -> sqlite3.Row:
    row = db.execute(
        """
        SELECT sl.link_id, sl.document_id, sl.created_by_user_id, sl.role, sl.token_hash, sl.created_at,
               sl.expires_at, sl.revoked_at, sl.last_claimed_at, d.title, u.display_name AS owner_display_name,
               d.owner_user_id
        FROM share_links sl
        JOIN documents d ON d.document_id = sl.document_id
        JOIN users u ON u.user_id = d.owner_user_id
        WHERE sl.token_hash = ?
        """,
        (hash_opaque_token(share_token),),
    ).fetchone()
    if row is None:
        raise api_error(404, "NOT_FOUND", "share link not found")
    if row["revoked_at"] is not None:
        raise api_error(410, "LINK_REVOKED", "share link has been revoked")
    if row["expires_at"] <= int(datetime.now(timezone.utc).timestamp()):
        raise api_error(410, "LINK_EXPIRED", "share link has expired")
    return row


def merge_role(current_role: str | None, incoming_role: str) -> str:
    ranking = {"viewer": 1, "editor": 2, "owner": 3}
    if current_role is None:
        return incoming_role
    return incoming_role if ranking[incoming_role] > ranking[current_role] else current_role


@router.get("/documents/{document_id}/share-links", response_model=ShareLinkListResponse, summary="List share links for a document")
def list_share_links(
    document_id: str,
    current_user=Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
) -> ShareLinkListResponse:
    ensure_owner(db, document_id, current_user["user_id"])
    rows = db.execute(
        "SELECT link_id, role, created_at, expires_at, revoked_at, last_claimed_at FROM share_links WHERE document_id = ? ORDER BY created_at DESC",
        (document_id,),
    ).fetchall()
    return ShareLinkListResponse(document_id=document_id, links=[to_share_link_summary(row) for row in rows])


@router.post("/documents/{document_id}/share-links", response_model=ShareLinkCreateResponse, summary="Create a revocable share link")
def create_share_link(
    document_id: str,
    payload: CreateShareLinkRequest,
    current_user=Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
) -> ShareLinkCreateResponse:
    ensure_owner(db, document_id, current_user["user_id"])
    payload_hash, existing_response = begin_idempotent_request(
        db,
        scope=f"share_link:create:{document_id}",
        user_id=current_user["user_id"],
        request_id=payload.request_id,
        payload={"documentId": document_id, "role": payload.role, "expiresInHours": payload.expires_in_hours},
    )
    if existing_response is not None:
        return ShareLinkCreateResponse.model_validate(existing_response)

    try:
        share_token = uuid4().hex + uuid4().hex
        link_id = f"link_{uuid4().hex[:12]}"
        created_at = now_iso()
        expires_at_dt = datetime.now(timezone.utc) + timedelta(hours=payload.expires_in_hours)
        expires_at_epoch = int(expires_at_dt.timestamp())
        db.execute(
            "INSERT INTO share_links (link_id, document_id, created_by_user_id, role, token_hash, created_at, expires_at, revoked_at, last_claimed_at) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL)",
            (link_id, document_id, current_user["user_id"], payload.role, hash_opaque_token(share_token), created_at, expires_at_epoch),
        )
        response = ShareLinkCreateResponse(
            link_id=link_id,
            role=payload.role,
            created_at=created_at,
            expires_at=expires_at_dt.isoformat(),
            revoked_at=None,
            last_claimed_at=None,
            active=True,
            revoked_access_count=0,
            share_token=share_token,
        )
        store_idempotent_response(
            db,
            scope=f"share_link:create:{document_id}",
            user_id=current_user["user_id"],
            request_id=payload.request_id,
            payload_hash=payload_hash,
            response_payload=response.model_dump(by_alias=True),
        )
        db.commit()
        return response
    except Exception:
        if db.in_transaction:
            db.rollback()
        raise


@router.delete("/documents/{document_id}/share-links/{link_id}", response_model=ShareLinkSummary, summary="Revoke a share link")
def revoke_share_link(
    document_id: str,
    link_id: str,
    revoke_access: bool = Query(default=False, alias="revokeAccess"),
    current_user=Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
) -> ShareLinkSummary:
    ensure_owner(db, document_id, current_user["user_id"])
    revoked_at = now_iso()
    result = db.execute(
        "UPDATE share_links SET revoked_at = ? WHERE document_id = ? AND link_id = ? AND revoked_at IS NULL",
        (revoked_at, document_id, link_id),
    )
    if result.rowcount != 1:
        raise api_error(404, "NOT_FOUND", "share link not found")
    revoked_access_count = 0
    if revoke_access:
        revoked_access_count = db.execute(
            "DELETE FROM document_permissions WHERE document_id = ? AND granted_via_share_link_id = ?",
            (document_id, link_id),
        ).rowcount
    row = db.execute(
        "SELECT link_id, role, created_at, expires_at, revoked_at, last_claimed_at FROM share_links WHERE link_id = ?",
        (link_id,),
    ).fetchone()
    db.commit()
    summary = to_share_link_summary(row)
    summary.revoked_access_count = revoked_access_count
    return summary


@router.get("/share-links/{share_token}", response_model=ShareLinkPreviewResponse, summary="Preview a share link")
def preview_share_link(share_token: str, db: sqlite3.Connection = Depends(get_db)) -> ShareLinkPreviewResponse:
    row = get_share_link_row(db, share_token)
    return ShareLinkPreviewResponse(
        document_id=row["document_id"],
        document_title=row["title"],
        role=row["role"],
        expires_at=datetime.fromtimestamp(row["expires_at"], tz=timezone.utc).isoformat(),
        owner_display_name=row["owner_display_name"],
    )


@router.post("/share-links/{share_token}/accept", response_model=AcceptShareLinkResponse, summary="Accept a share link")
def accept_share_link(
    share_token: str,
    current_user=Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
) -> AcceptShareLinkResponse:
    row = get_share_link_row(db, share_token)
    if current_user["user_id"] == row["owner_user_id"]:
        db.execute("UPDATE share_links SET last_claimed_at = ? WHERE link_id = ?", (now_iso(), row["link_id"]))
        db.commit()
        return AcceptShareLinkResponse(document_id=row["document_id"], role="owner", accepted=False)

    existing = db.execute(
        "SELECT role, granted_via_share_link_id FROM document_permissions WHERE document_id = ? AND user_id = ?",
        (row["document_id"], current_user["user_id"]),
    ).fetchone()
    granted_role = merge_role(existing["role"] if existing else None, row["role"])
    claimed_at = now_iso()
    if existing is None or granted_role != existing["role"]:
        db.execute(
            """
            INSERT INTO document_permissions (document_id, user_id, role, updated_at, granted_by_user_id, granted_via_share_link_id)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(document_id, user_id) DO UPDATE SET
                role = excluded.role,
                updated_at = excluded.updated_at,
                granted_by_user_id = excluded.granted_by_user_id,
                granted_via_share_link_id = excluded.granted_via_share_link_id
            """,
            (row["document_id"], current_user["user_id"], granted_role, claimed_at, row["created_by_user_id"], row["link_id"]),
        )
    db.execute("UPDATE share_links SET last_claimed_at = ? WHERE link_id = ?", (claimed_at, row["link_id"]))
    append_realtime_event(
        db,
        row["document_id"],
        "permission_updated",
        json.dumps({"targetUserId": current_user["user_id"], "role": granted_role}),
        claimed_at,
    )
    db.commit()
    return AcceptShareLinkResponse(document_id=row["document_id"], role=granted_role, accepted=True)
