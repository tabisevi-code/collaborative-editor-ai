from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from uuid import uuid4

from ..document_access import ensure_document_access
from ..errors import api_error
from ..schemas import AiHistoryItem, AiJobFeedbackRequest
from .prompts import build_prompt_label
from .providers import AiProviderRequest


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_history_id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex[:12]}"


def ensure_ai_policy_row(db: sqlite3.Connection, document_id: str, updated_at: str) -> None:
    db.execute(
        """
        INSERT INTO ai_policies (document_id, ai_enabled, allowed_roles_csv, daily_quota, updated_at)
        VALUES (?, 1, 'owner,editor', 5, ?)
        ON CONFLICT(document_id) DO NOTHING
        """,
        (document_id, updated_at),
    )


def get_ai_policy(db: sqlite3.Connection, document_id: str) -> dict:
    timestamp = now_iso()
    ensure_ai_policy_row(db, document_id, timestamp)
    db.commit()
    row = db.execute(
        "SELECT document_id, ai_enabled, allowed_roles_csv, daily_quota, updated_at FROM ai_policies WHERE document_id = ?",
        (document_id,),
    ).fetchone()
    return {
        "documentId": row["document_id"],
        "aiEnabled": bool(row["ai_enabled"]),
        "allowedRolesForAI": [item for item in row["allowed_roles_csv"].split(",") if item],
        "dailyQuota": row["daily_quota"],
        "usedToday": 0,
        "remainingToday": row["daily_quota"],
        "updatedAt": row["updated_at"],
    }


def get_ai_usage_for_user(db: sqlite3.Connection, document_id: str, user_id: str, current_role: str) -> dict:
    policy = get_ai_policy(db, document_id)
    today = datetime.now(timezone.utc).date().isoformat()
    used_today = db.execute(
        "SELECT COUNT(*) AS count FROM ai_history WHERE document_id = ? AND user_id = ? AND substr(created_at, 1, 10) = ?",
        (document_id, user_id, today),
    ).fetchone()["count"]
    remaining_today = max(policy["dailyQuota"] - used_today, 0)
    allowed_roles = policy["allowedRolesForAI"]
    return {
        **policy,
        "usedToday": used_today,
        "remainingToday": remaining_today,
        "currentUserRole": current_role,
        "canUseAi": policy["aiEnabled"] and current_role in allowed_roles and remaining_today > 0,
    }


def validate_selection_snapshot(selection_start: int, selection_end: int, selected_text: str, base_version_id: str) -> None:
    if selection_start < 0 or selection_end <= selection_start:
        raise api_error(400, "INVALID_INPUT", "selection is invalid")
    if selected_text.strip() == "":
        raise api_error(400, "INVALID_INPUT", "selectedText is required")
    if not base_version_id:
        raise api_error(400, "INVALID_INPUT", "baseVersionId is required")


def prepare_ai_request(
    db: sqlite3.Connection,
    current_user: dict,
    document_id: str,
    action: str,
    selection_start: int,
    selection_end: int,
    selected_text: str,
    context_before: str,
    context_after: str,
    instruction: str | None,
    target_language: str | None,
    base_version_id: str,
) -> tuple[str, AiProviderRequest]:
    document = ensure_document_access(db, document_id, current_user["user_id"], "viewer")
    policy = get_ai_usage_for_user(db, document_id, current_user["user_id"], document["role"])
    if not policy["aiEnabled"]:
        raise api_error(403, "AI_DISABLED", "AI is disabled for this document")
    if document["role"] not in policy["allowedRolesForAI"]:
        raise api_error(403, "AI_ROLE_FORBIDDEN", "your role cannot invoke AI actions")

    if policy["usedToday"] >= policy["dailyQuota"]:
        raise api_error(429, "QUOTA_EXCEEDED", "daily AI quota exceeded", {"dailyQuota": policy["dailyQuota"]})

    validate_selection_snapshot(selection_start, selection_end, selected_text, base_version_id)

    job_id = new_history_id("aijob")
    history_id = new_history_id("aih")
    timestamp = now_iso()
    provider_request = AiProviderRequest(
        action=action,
        selected_text=selected_text,
        context_before=context_before,
        context_after=context_after,
        instruction=instruction,
        target_language=target_language,
        request_id=job_id,
    )
    db.execute(
        """
        INSERT INTO ai_history (
            id,
            job_id,
            document_id,
            user_id,
            action,
            prompt_label,
            request_json,
            output_text,
            status,
            error_code,
            error_message,
            created_at,
            updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 'streaming', NULL, NULL, ?, ?)
        """,
        (
            history_id,
            job_id,
            document_id,
            current_user["user_id"],
            action,
            build_prompt_label(provider_request),
            json.dumps(
                {
                    "selection": {"start": selection_start, "end": selection_end},
                    "selectedText": selected_text,
                    "contextBefore": context_before,
                    "contextAfter": context_after,
                    "instruction": instruction,
                    "targetLanguage": target_language,
                    "baseVersionId": base_version_id,
                }
            ),
            timestamp,
            timestamp,
        ),
    )
    db.commit()
    return job_id, provider_request


def complete_ai_request(db: sqlite3.Connection, job_id: str, output_text: str) -> None:
    timestamp = now_iso()
    db.execute(
        "UPDATE ai_history SET output_text = ?, status = 'completed', updated_at = ? WHERE job_id = ?",
        (output_text, timestamp, job_id),
    )
    db.commit()


def fail_ai_request(db: sqlite3.Connection, job_id: str, error_code: str, error_message: str) -> None:
    timestamp = now_iso()
    db.execute(
        "UPDATE ai_history SET status = 'failed', error_code = ?, error_message = ?, updated_at = ? WHERE job_id = ?",
        (error_code, error_message, timestamp, job_id),
    )
    db.commit()


def cancel_ai_job(db: sqlite3.Connection, job_id: str, current_user: dict) -> bool:
    row = db.execute(
        "SELECT document_id, user_id, status FROM ai_history WHERE job_id = ?",
        (job_id,),
    ).fetchone()
    if row is None:
        raise api_error(404, "NOT_FOUND", "AI job not found")
    ensure_document_access(db, row["document_id"], current_user["user_id"], "viewer")
    if row["status"] not in {"streaming", "completed"}:
        return False
    db.execute(
        "UPDATE ai_history SET status = 'cancelled', updated_at = ? WHERE job_id = ?",
        (now_iso(), job_id),
    )
    db.commit()
    return True


def is_ai_job_cancelled(db: sqlite3.Connection, job_id: str) -> bool:
    row = db.execute("SELECT status FROM ai_history WHERE job_id = ?", (job_id,)).fetchone()
    return row is not None and row["status"] == "cancelled"


def record_ai_feedback(db: sqlite3.Connection, current_user: dict, job_id: str, payload: AiJobFeedbackRequest) -> dict:
    row = db.execute(
        "SELECT document_id, output_text FROM ai_history WHERE job_id = ?",
        (job_id,),
    ).fetchone()
    if row is None:
        raise api_error(404, "NOT_FOUND", "AI job not found")
    ensure_document_access(db, row["document_id"], current_user["user_id"], "viewer")

    next_status = "rejected"
    if payload.disposition != "rejected":
        normalized_output = (row["output_text"] or "").strip()
        normalized_applied = (payload.applied_text or normalized_output).strip()
        next_status = "edited" if normalized_applied and normalized_applied != normalized_output else "accepted"

    recorded_at = now_iso()
    db.execute(
        "UPDATE ai_history SET status = ?, updated_at = ? WHERE job_id = ?",
        (next_status, recorded_at, job_id),
    )
    db.commit()
    return {
        "jobId": job_id,
        "disposition": payload.disposition,
        "recordedAt": recorded_at,
    }


def list_ai_history(db: sqlite3.Connection, current_user: dict, document_id: str) -> list[AiHistoryItem]:
    ensure_document_access(db, document_id, current_user["user_id"], "viewer")
    rows = db.execute(
        """
        SELECT id, job_id, document_id, action, prompt_label, output_text, status, created_at
        FROM ai_history
        WHERE document_id = ?
        ORDER BY created_at DESC
        """,
        (document_id,),
    ).fetchall()
    return [
        AiHistoryItem(
            id=row["id"],
            document_id=row["document_id"],
            action=row["action"],
            prompt_label=row["prompt_label"],
            output_preview=(row["output_text"] or "")[:240],
            status=row["status"],
            created_at=row["created_at"],
            job_id=row["job_id"],
        )
        for row in rows
    ]
