from __future__ import annotations

import hashlib
import json
import sqlite3
from datetime import datetime, timezone
from typing import Any

from .errors import api_error


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def hash_payload(payload: Any) -> str:
    serialized = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def begin_idempotent_request(
    db: sqlite3.Connection,
    scope: str,
    user_id: str,
    request_id: str | None,
    payload: Any,
) -> tuple[str | None, dict[str, Any] | None]:
    if not request_id:
        return None, None

    payload_hash = hash_payload(payload)
    db.execute("BEGIN IMMEDIATE")
    row = db.execute(
        "SELECT payload_hash, response_json FROM idempotency_requests WHERE scope = ? AND user_id = ? AND request_id = ?",
        (scope, user_id, request_id),
    ).fetchone()
    if row is None:
        return payload_hash, None
    db.rollback()
    if row["payload_hash"] != payload_hash:
        raise api_error(409, "IDEMPOTENCY_CONFLICT", "requestId was already used with a different payload")
    return payload_hash, json.loads(row["response_json"])


def store_idempotent_response(
    db: sqlite3.Connection,
    scope: str,
    user_id: str,
    request_id: str | None,
    payload_hash: str | None,
    response_payload: dict[str, Any],
) -> None:
    if not request_id or not payload_hash:
        return

    db.execute(
        "INSERT INTO idempotency_requests (scope, user_id, request_id, payload_hash, response_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (scope, user_id, request_id, payload_hash, json.dumps(response_payload, sort_keys=True), now_iso()),
    )
