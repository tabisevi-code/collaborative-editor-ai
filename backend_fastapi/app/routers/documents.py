import sqlite3
from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from ..ai.service import get_ai_policy, get_ai_usage_for_user, list_ai_history
from ..deps import get_current_user, get_db
from ..document_access import ensure_document_access, ensure_owner
from ..schemas import AiHistoryItem, AiPolicyResponse, AiUsageResponse, DocumentListResponse, DocumentSummary, UpdateAiPolicyRequest

router = APIRouter(prefix="/documents", tags=["documents"])


@router.get("", response_model=DocumentListResponse, summary="List owned and shared documents")
def list_documents(
    current_user=Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
) -> DocumentListResponse:
    owned_rows = db.execute(
        "SELECT document_id, title, updated_at FROM documents WHERE owner_user_id = ? ORDER BY updated_at DESC",
        (current_user["user_id"],),
    ).fetchall()
    shared_rows = db.execute(
        """
        SELECT d.document_id, d.title, d.updated_at, p.role, u.display_name AS owner_display_name
        FROM document_permissions p
        JOIN documents d ON d.document_id = p.document_id
        JOIN users u ON u.user_id = d.owner_user_id
        WHERE p.user_id = ? AND d.owner_user_id != ?
        ORDER BY d.updated_at DESC
        """,
        (current_user["user_id"], current_user["user_id"]),
    ).fetchall()
    return DocumentListResponse(
        owned=[
            DocumentSummary(
                document_id=row["document_id"],
                title=row["title"],
                role="owner",
                updated_at=row["updated_at"],
                owner_display_name=current_user["display_name"],
            )
            for row in owned_rows
        ],
        shared=[
            DocumentSummary(
                document_id=row["document_id"],
                title=row["title"],
                role=row["role"],
                updated_at=row["updated_at"],
                owner_display_name=row["owner_display_name"],
            )
            for row in shared_rows
        ],
    )


@router.get("/{document_id}/ai-policy", response_model=AiPolicyResponse, summary="Get AI policy for a document")
def fetch_ai_policy(
    document_id: str,
    current_user=Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
) -> AiPolicyResponse:
    document = ensure_owner(db, document_id, current_user["user_id"])
    return AiPolicyResponse.model_validate(get_ai_usage_for_user(db, document_id, current_user["user_id"], document["role"]))


@router.put("/{document_id}/ai-policy", response_model=AiPolicyResponse, summary="Update AI policy for a document")
def update_ai_policy(
    document_id: str,
    payload: UpdateAiPolicyRequest,
    current_user=Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
) -> AiPolicyResponse:
    ensure_owner(db, document_id, current_user["user_id"])
    updated_at = datetime.now(timezone.utc).isoformat()
    db.execute(
        """
        INSERT INTO ai_policies (document_id, ai_enabled, allowed_roles_csv, daily_quota, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(document_id) DO UPDATE SET
            ai_enabled = excluded.ai_enabled,
            allowed_roles_csv = excluded.allowed_roles_csv,
            daily_quota = excluded.daily_quota,
            updated_at = excluded.updated_at
        """,
        (
            document_id,
            1 if payload.ai_enabled else 0,
            ",".join(payload.allowed_roles_for_ai),
            payload.daily_quota,
            updated_at,
        ),
    )
    db.commit()
    document = ensure_owner(db, document_id, current_user["user_id"])
    return AiPolicyResponse.model_validate(get_ai_usage_for_user(db, document_id, current_user["user_id"], document["role"]))


@router.get("/{document_id}/ai-usage", response_model=AiUsageResponse, summary="Get AI quota usage for the current user")
def fetch_ai_usage(
    document_id: str,
    current_user=Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
) -> AiUsageResponse:
    document = ensure_document_access(db, document_id, current_user["user_id"], "viewer")
    return AiUsageResponse.model_validate(get_ai_usage_for_user(db, document_id, current_user["user_id"], document["role"]))


@router.get("/{document_id}/ai-history", response_model=list[AiHistoryItem], summary="List AI interaction history for a document")
def fetch_ai_history(
    document_id: str,
    current_user=Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
) -> list[AiHistoryItem]:
    return list_ai_history(db, current_user, document_id)
