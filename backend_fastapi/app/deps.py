from __future__ import annotations

import sqlite3
from typing import Generator

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError

from .config import Settings, get_settings
from .database import create_connection
from .errors import api_error
from .security import decode_access_token

bearer_scheme = HTTPBearer(auto_error=False)


def get_db(settings: Settings = Depends(get_settings)) -> Generator[sqlite3.Connection, None, None]:
    connection = create_connection(settings)
    try:
        yield connection
    finally:
        connection.close()


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: sqlite3.Connection = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise api_error(401, "AUTH_REQUIRED", "authorization token is required")

    try:
        payload = decode_access_token(credentials.credentials, settings)
    except JWTError as error:
        raise api_error(401, "AUTH_FAILED", "invalid access token") from error

    if payload.get("token_type") != "access" or not payload.get("sub"):
        raise api_error(401, "AUTH_FAILED", "invalid access token payload")

    row = db.execute(
        "SELECT user_id, display_name, created_at, updated_at FROM users WHERE user_id = ?",
        (payload["sub"],),
    ).fetchone()
    if row is None:
        raise api_error(401, "AUTH_FAILED", "user for token not found")

    token_id = payload.get("jti")
    if token_id:
        revoked = db.execute("SELECT token_id FROM revoked_access_tokens WHERE token_id = ?", (token_id,)).fetchone()
        if revoked is not None:
            raise api_error(401, "AUTH_FAILED", "access token is no longer valid")

    session_id = payload.get("sid")
    if session_id:
        session = db.execute(
            "SELECT token_id FROM refresh_tokens WHERE token_id = ? AND revoked_at IS NULL AND expires_at > strftime('%s','now')",
            (session_id,),
        ).fetchone()
        if session is None:
            raise api_error(401, "AUTH_FAILED", "access token session is no longer valid")

    return {
        "user_id": row["user_id"],
        "display_name": row["display_name"],
        "token_id": token_id,
        "session_id": session_id,
        "token_expires_at": payload.get("exp"),
    }
