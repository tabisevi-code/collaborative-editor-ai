from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator
from uuid import uuid4

from .config import Settings, get_settings


def new_event_id(prefix: str = "evt") -> str:
    return f"{prefix}_{uuid4().hex[:12]}"


def resolve_sqlite_path(database_url: str) -> Path:
    prefix = "sqlite:///"
    if not database_url.startswith(prefix):
        raise ValueError("Only sqlite:/// URLs are supported in the current FastAPI backend scaffold")

    relative_path = database_url[len(prefix):]
    return Path(relative_path).expanduser().resolve()


def initialize_database(connection: sqlite3.Connection) -> None:
    connection.executescript(
        """
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS users (
            user_id TEXT PRIMARY KEY,
            display_name TEXT NOT NULL,
            global_role TEXT,
            access_token TEXT UNIQUE,
            password_hash TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS refresh_tokens (
            token_id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            refresh_token TEXT NOT NULL UNIQUE,
            expires_at INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            revoked_at TEXT,
            FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS password_reset_tokens (
            token_id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            token_hash TEXT NOT NULL UNIQUE,
            expires_at INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            consumed_at TEXT,
            FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS rate_limit_events (
            event_id TEXT PRIMARY KEY,
            scope TEXT NOT NULL,
            rate_key TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            expires_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS documents (
            document_id TEXT PRIMARY KEY,
            owner_user_id TEXT NOT NULL,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            current_version_id TEXT,
            revision_id TEXT,
            FOREIGN KEY (owner_user_id) REFERENCES users(user_id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS document_permissions (
            document_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            role TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            granted_by_user_id TEXT,
            granted_via_share_link_id TEXT,
            PRIMARY KEY (document_id, user_id),
            FOREIGN KEY (document_id) REFERENCES documents(document_id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
            FOREIGN KEY (granted_by_user_id) REFERENCES users(user_id) ON DELETE SET NULL,
            FOREIGN KEY (granted_via_share_link_id) REFERENCES share_links(link_id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS document_versions (
            version_id TEXT PRIMARY KEY,
            document_id TEXT NOT NULL,
            version_number INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            created_by_user_id TEXT NOT NULL,
            reason TEXT NOT NULL,
            snapshot_content TEXT NOT NULL,
            base_revision_id TEXT,
            UNIQUE (document_id, version_number),
            FOREIGN KEY (document_id) REFERENCES documents(document_id) ON DELETE CASCADE,
            FOREIGN KEY (created_by_user_id) REFERENCES users(user_id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS ai_policies (
            document_id TEXT PRIMARY KEY,
            ai_enabled INTEGER NOT NULL DEFAULT 1,
            allowed_roles_csv TEXT NOT NULL DEFAULT 'owner,editor',
            daily_quota INTEGER NOT NULL DEFAULT 5,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (document_id) REFERENCES documents(document_id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS ai_history (
            id TEXT PRIMARY KEY,
            job_id TEXT NOT NULL UNIQUE,
            document_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            action TEXT NOT NULL,
            prompt_label TEXT NOT NULL,
            request_json TEXT NOT NULL,
            output_text TEXT,
            status TEXT NOT NULL,
            error_code TEXT,
            error_message TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (document_id) REFERENCES documents(document_id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS export_jobs (
            job_id TEXT PRIMARY KEY,
            document_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            format TEXT NOT NULL,
            status TEXT NOT NULL,
            result_json TEXT,
            error_code TEXT,
            error_message TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (document_id) REFERENCES documents(document_id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS share_links (
            link_id TEXT PRIMARY KEY,
            document_id TEXT NOT NULL,
            created_by_user_id TEXT NOT NULL,
            role TEXT NOT NULL,
            token_hash TEXT NOT NULL UNIQUE,
            created_at TEXT NOT NULL,
            expires_at INTEGER NOT NULL,
            revoked_at TEXT,
            last_claimed_at TEXT,
            FOREIGN KEY (document_id) REFERENCES documents(document_id) ON DELETE CASCADE,
            FOREIGN KEY (created_by_user_id) REFERENCES users(user_id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS idempotency_requests (
            scope TEXT NOT NULL,
            user_id TEXT NOT NULL,
            request_id TEXT NOT NULL,
            payload_hash TEXT NOT NULL,
            response_json TEXT NOT NULL,
            created_at TEXT NOT NULL,
            PRIMARY KEY (scope, user_id, request_id),
            FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS realtime_events (
            event_id TEXT PRIMARY KEY,
            document_id TEXT NOT NULL,
            event_type TEXT NOT NULL,
            payload_json TEXT NOT NULL,
            created_at TEXT NOT NULL,
            delivered_at TEXT
        );

        CREATE TABLE IF NOT EXISTS revoked_access_tokens (
            token_id TEXT PRIMARY KEY,
            expires_at INTEGER NOT NULL,
            revoked_at TEXT NOT NULL,
            user_id TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
        );
        """
    )

    for table_name, column_name, ddl in [
        ("users", "global_role", "ALTER TABLE users ADD COLUMN global_role TEXT"),
        ("users", "access_token", "ALTER TABLE users ADD COLUMN access_token TEXT"),
        ("users", "password_hash", "ALTER TABLE users ADD COLUMN password_hash TEXT"),
        ("documents", "current_version_id", "ALTER TABLE documents ADD COLUMN current_version_id TEXT"),
        ("documents", "revision_id", "ALTER TABLE documents ADD COLUMN revision_id TEXT"),
        ("refresh_tokens", "revoked_at", "ALTER TABLE refresh_tokens ADD COLUMN revoked_at TEXT"),
        ("document_permissions", "granted_by_user_id", "ALTER TABLE document_permissions ADD COLUMN granted_by_user_id TEXT"),
        ("document_permissions", "granted_via_share_link_id", "ALTER TABLE document_permissions ADD COLUMN granted_via_share_link_id TEXT"),
    ]:
        columns = {row[1] for row in connection.execute(f"PRAGMA table_info({table_name})").fetchall()}
        if column_name not in columns:
            connection.execute(ddl)

    connection.execute("UPDATE users SET global_role = COALESCE(global_role, 'user')")
    connection.execute("UPDATE users SET access_token = COALESCE(access_token, 'token_' || user_id)")

    connection.commit()


def append_realtime_event(connection: sqlite3.Connection, document_id: str, event_type: str, payload_json: str, created_at: str) -> None:
    connection.execute(
        "INSERT INTO realtime_events (event_id, document_id, event_type, payload_json, created_at, delivered_at) VALUES (?, ?, ?, ?, ?, NULL)",
        (new_event_id(), document_id, event_type, payload_json, created_at),
    )


def ensure_ai_policy(connection: sqlite3.Connection, document_id: str, updated_at: str) -> None:
    connection.execute(
        """
        INSERT INTO ai_policies (document_id, ai_enabled, allowed_roles_csv, daily_quota, updated_at)
        VALUES (?, 1, 'owner,editor', 5, ?)
        ON CONFLICT(document_id) DO NOTHING
        """,
        (document_id, updated_at),
    )


def create_connection(settings: Settings | None = None) -> sqlite3.Connection:
    settings = settings or get_settings()
    database_path = resolve_sqlite_path(settings.fastapi_database_url)
    database_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(database_path, check_same_thread=False)
    connection.row_factory = sqlite3.Row
    initialize_database(connection)
    return connection


@contextmanager
def connection_context() -> Iterator[sqlite3.Connection]:
    connection = create_connection()
    try:
        yield connection
    finally:
        connection.close()
