import sqlite3
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, status

from ..database import ensure_ai_policy
from ..deps import get_current_user, get_db
from ..document_access import resolve_document_for_user
from ..errors import api_error
from ..idempotency import begin_idempotent_request, store_idempotent_response
from ..schemas import CreateDocumentRequest, CreateDocumentResponse, GetDocumentResponse, UpdateDocumentRequest, UpdateDocumentResponse

router = APIRouter(prefix="/documents", tags=["documents-crud"])


@router.post("", response_model=CreateDocumentResponse, status_code=status.HTTP_201_CREATED, summary="Create a document")
def create_document(
    payload: CreateDocumentRequest,
    current_user=Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
) -> CreateDocumentResponse:
    document_id = f"doc_{uuid4().hex[:12]}"
    version_id = f"ver_{uuid4().hex[:12]}"
    timestamp = datetime.now(timezone.utc).isoformat()
    db.execute(
        "INSERT INTO documents (document_id, owner_user_id, title, content, created_at, updated_at, current_version_id, revision_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (document_id, current_user["user_id"], payload.title, payload.content, timestamp, timestamp, version_id, "rev_1"),
    )
    db.execute(
        "INSERT INTO document_versions (version_id, document_id, version_number, created_at, created_by_user_id, reason, snapshot_content, base_revision_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (version_id, document_id, 1, timestamp, current_user["user_id"], "initial_create", payload.content, None),
    )
    ensure_ai_policy(db, document_id, timestamp)
    db.commit()
    return CreateDocumentResponse(
        document_id=document_id,
        title=payload.title,
        owner_id=current_user["user_id"],
        created_at=timestamp,
        updated_at=timestamp,
        current_version_id=version_id,
    )


@router.get("/{document_id}", response_model=GetDocumentResponse, summary="Get a document")
def get_document(document_id: str, current_user=Depends(get_current_user), db: sqlite3.Connection = Depends(get_db)) -> GetDocumentResponse:
    document = resolve_document_for_user(db, document_id, current_user["user_id"])
    return GetDocumentResponse(
        document_id=document["document_id"],
        title=document["title"],
        content=document["content"],
        updated_at=document["updated_at"],
        current_version_id=document["current_version_id"],
        role=document["role"],
        revision_id=document["revision_id"],
    )


@router.put("/{document_id}/content", response_model=UpdateDocumentResponse, summary="Save document content")
def update_document(
    document_id: str,
    payload: UpdateDocumentRequest,
    current_user=Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
) -> UpdateDocumentResponse:
    payload_hash, existing_response = begin_idempotent_request(
        db,
        scope=f"document:update:{document_id}",
        user_id=current_user["user_id"],
        request_id=payload.request_id,
        payload={
            "documentId": document_id,
            "content": payload.content,
            "baseRevisionId": payload.base_revision_id,
            "preUpdateVersionReason": payload.pre_update_version_reason,
            "updateReason": payload.update_reason,
            "aiJobId": payload.ai_job_id,
        },
    )
    if existing_response is not None:
        return UpdateDocumentResponse.model_validate(existing_response)

    try:
        document = resolve_document_for_user(db, document_id, current_user["user_id"])
        if document["role"] == "viewer":
            raise api_error(403, "PERMISSION_DENIED", "viewer cannot update document")

        if document["revision_id"] != payload.base_revision_id and document["content"] != payload.content:
            raise api_error(
                409,
                "CONFLICT",
                "base revision is stale",
                {"expectedRevisionId": document["revision_id"], "actualRevisionId": payload.base_revision_id},
            )

        if document["content"] == payload.content:
            response = UpdateDocumentResponse(document_id=document_id, updated_at=document["updated_at"], revision_id=document["revision_id"])
            store_idempotent_response(
                db,
                scope=f"document:update:{document_id}",
                user_id=current_user["user_id"],
                request_id=payload.request_id,
                payload_hash=payload_hash,
                response_payload=response.model_dump(by_alias=True),
            )
            if db.in_transaction:
                db.commit()
            return response

        max_version = db.execute(
            "SELECT COALESCE(MAX(version_number), 0) AS max_version FROM document_versions WHERE document_id = ?",
            (document_id,),
        ).fetchone()["max_version"]
        timestamp = datetime.now(timezone.utc).isoformat()
        next_version_id = f"ver_{uuid4().hex[:12]}"
        next_revision = f"rev_{max_version + 1}"
        db.execute(
            "INSERT INTO document_versions (version_id, document_id, version_number, created_at, created_by_user_id, reason, snapshot_content, base_revision_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (next_version_id, document_id, max_version + 1, timestamp, current_user["user_id"], payload.update_reason or "content_update", payload.content, payload.base_revision_id),
        )
        db.execute(
            "UPDATE documents SET content = ?, updated_at = ?, current_version_id = ?, revision_id = ? WHERE document_id = ?",
            (payload.content, timestamp, next_version_id, next_revision, document_id),
        )
        response = UpdateDocumentResponse(document_id=document_id, updated_at=timestamp, revision_id=next_revision)
        store_idempotent_response(
            db,
            scope=f"document:update:{document_id}",
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
