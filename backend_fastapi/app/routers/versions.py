import json
import sqlite3
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends

from ..database import append_realtime_event
from ..deps import get_current_user, get_db
from ..document_access import ensure_document_access
from ..errors import api_error
from ..idempotency import begin_idempotent_request, store_idempotent_response
from ..schemas import RevertRequest, RevertResponse, VersionListResponse, VersionSummary

router = APIRouter(prefix="/documents/{document_id}", tags=["versions"])


@router.get("/versions", response_model=VersionListResponse, summary="List document versions")
def list_versions(document_id: str, current_user=Depends(get_current_user), db: sqlite3.Connection = Depends(get_db)) -> VersionListResponse:
    ensure_document_access(db, document_id, current_user["user_id"], "viewer")
    rows = db.execute(
        "SELECT version_id, version_number, created_at, created_by_user_id, reason, snapshot_content FROM document_versions WHERE document_id = ? ORDER BY version_number DESC",
        (document_id,),
    ).fetchall()
    return VersionListResponse(
        document_id=document_id,
        versions=[
            VersionSummary(
                version_id=row["version_id"],
                version_number=row["version_number"],
                created_at=row["created_at"],
                created_by=row["created_by_user_id"],
                reason=row["reason"],
                snapshot_content=row["snapshot_content"],
            )
            for row in rows
        ],
    )


@router.post("/revert", response_model=RevertResponse, summary="Revert to a previous version")
def revert_document(
    document_id: str,
    payload: RevertRequest,
    current_user=Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
) -> RevertResponse:
    payload_hash, existing_response = begin_idempotent_request(
        db,
        scope=f"document:revert:{document_id}",
        user_id=current_user["user_id"],
        request_id=payload.request_id,
        payload={"documentId": document_id, "targetVersionId": payload.target_version_id},
    )
    if existing_response is not None:
        return RevertResponse.model_validate(existing_response)

    try:
        document = ensure_document_access(db, document_id, current_user["user_id"], "owner")
        target = db.execute(
            "SELECT version_id, version_number, snapshot_content FROM document_versions WHERE document_id = ? AND version_id = ?",
            (document_id, payload.target_version_id),
        ).fetchone()
        if target is None:
            raise api_error(404, "VERSION_NOT_FOUND", "target version not found")

        current_max_version = db.execute(
            "SELECT COALESCE(MAX(version_number), 0) AS max_version FROM document_versions WHERE document_id = ?",
            (document_id,),
        ).fetchone()["max_version"]
        timestamp = datetime.now(timezone.utc).isoformat()
        backup_version_id = f"ver_{uuid4().hex[:12]}"
        revert_version_id = f"ver_{uuid4().hex[:12]}"
        next_revision = f"rev_{current_max_version + 2}"
        db.execute(
            "INSERT INTO document_versions (version_id, document_id, version_number, created_at, created_by_user_id, reason, snapshot_content, base_revision_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (backup_version_id, document_id, current_max_version + 1, timestamp, current_user["user_id"], "pre_revert_backup", document["content"], document["revision_id"]),
        )
        db.execute(
            "INSERT INTO document_versions (version_id, document_id, version_number, created_at, created_by_user_id, reason, snapshot_content, base_revision_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (revert_version_id, document_id, current_max_version + 2, timestamp, current_user["user_id"], "revert", target["snapshot_content"], document["revision_id"]),
        )
        db.execute(
            "UPDATE documents SET content = ?, updated_at = ?, current_version_id = ?, revision_id = ? WHERE document_id = ?",
            (target["snapshot_content"], timestamp, revert_version_id, next_revision, document_id),
        )
        append_realtime_event(
            db,
            document_id,
            "document_reverted",
            json.dumps({"currentVersionId": revert_version_id, "revisionId": next_revision}),
            timestamp,
        )
        response = RevertResponse(
            document_id=document_id,
            current_version_id=revert_version_id,
            reverted_from_version_id=payload.target_version_id,
            updated_at=timestamp,
        )
        store_idempotent_response(
            db,
            scope=f"document:revert:{document_id}",
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
