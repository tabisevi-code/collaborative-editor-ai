import sqlite3
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException

from ..deps import get_current_user, get_db
from ..schemas import CreateDocumentRequest, CreateDocumentResponse, GetDocumentResponse, UpdateDocumentRequest, UpdateDocumentResponse

router = APIRouter(prefix="/documents", tags=["documents-crud"])


def resolve_document_for_user(db: sqlite3.Connection, document_id: str, user_id: str):
    document = db.execute(
        "SELECT document_id, owner_user_id, title, content, updated_at, current_version_id, revision_id, created_at FROM documents WHERE document_id = ?",
        (document_id,),
    ).fetchone()
    if document is None:
        raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": "document not found"}})

    if document["owner_user_id"] == user_id:
        return {**dict(document), "role": "owner"}

    permission = db.execute(
        "SELECT role FROM document_permissions WHERE document_id = ? AND user_id = ?",
        (document_id, user_id),
    ).fetchone()
    if permission is None:
        raise HTTPException(status_code=403, detail={"error": {"code": "PERMISSION_DENIED", "message": "document access denied"}})
    return {**dict(document), "role": permission["role"]}


@router.post("", response_model=CreateDocumentResponse, summary="Create a document")
def create_document(
    payload: CreateDocumentRequest,
    current_user=Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
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
def get_document(document_id: str, current_user=Depends(get_current_user), db: sqlite3.Connection = Depends(get_db)):
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
):
    document = resolve_document_for_user(db, document_id, current_user["user_id"])
    if document["role"] == "viewer":
        raise HTTPException(status_code=403, detail={"error": {"code": "PERMISSION_DENIED", "message": "viewer cannot update document"}})

    if document["revision_id"] != payload.base_revision_id and document["content"] != payload.content:
        raise HTTPException(
            status_code=409,
            detail={"error": {"code": "CONFLICT", "message": "base revision is stale", "details": {"expectedRevisionId": document["revision_id"], "actualRevisionId": payload.base_revision_id}}},
        )

    if document["content"] == payload.content:
        return UpdateDocumentResponse(document_id=document_id, updated_at=document["updated_at"], revision_id=document["revision_id"])

    max_version = db.execute(
        "SELECT COALESCE(MAX(version_number), 0) AS max_version FROM document_versions WHERE document_id = ?",
        (document_id,),
    ).fetchone()["max_version"]
    timestamp = datetime.now(timezone.utc).isoformat()
    next_version_id = f"ver_{uuid4().hex[:12]}"
    next_revision = f"rev_{max_version + 1}"
    db.execute(
        "INSERT INTO document_versions (version_id, document_id, version_number, created_at, created_by_user_id, reason, snapshot_content, base_revision_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (next_version_id, document_id, max_version + 1, timestamp, current_user["user_id"], "content_update", payload.content, payload.base_revision_id),
    )
    db.execute(
        "UPDATE documents SET content = ?, updated_at = ?, current_version_id = ?, revision_id = ? WHERE document_id = ?",
        (payload.content, timestamp, next_version_id, next_revision, document_id),
    )
    db.commit()
    return UpdateDocumentResponse(document_id=document_id, updated_at=timestamp, revision_id=next_revision)
