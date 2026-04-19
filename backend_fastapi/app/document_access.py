from __future__ import annotations

import sqlite3

from .errors import api_error


def resolve_document_for_user(db: sqlite3.Connection, document_id: str, user_id: str) -> dict:
    document = db.execute(
        "SELECT document_id, owner_user_id, title, content, updated_at, current_version_id, revision_id, created_at FROM documents WHERE document_id = ?",
        (document_id,),
    ).fetchone()
    if document is None:
        raise api_error(404, "NOT_FOUND", "document not found")

    if document["owner_user_id"] == user_id:
        return {**dict(document), "role": "owner"}

    permission = db.execute(
        "SELECT role FROM document_permissions WHERE document_id = ? AND user_id = ?",
        (document_id, user_id),
    ).fetchone()
    if permission is None:
        raise api_error(403, "PERMISSION_DENIED", "document access denied")

    return {**dict(document), "role": permission["role"]}


def ensure_document_access(db: sqlite3.Connection, document_id: str, user_id: str, minimum_role: str = "viewer") -> dict:
    document = resolve_document_for_user(db, document_id, user_id)
    if minimum_role == "viewer":
        return document
    if minimum_role == "editor" and document["role"] in {"owner", "editor"}:
        return document
    if minimum_role == "owner" and document["role"] == "owner":
        return document
    raise api_error(403, "PERMISSION_DENIED", "document action not permitted")


def ensure_owner(db: sqlite3.Connection, document_id: str, user_id: str) -> dict:
    return ensure_document_access(db, document_id, user_id, "owner")
