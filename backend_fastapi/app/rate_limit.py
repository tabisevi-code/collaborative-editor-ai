from __future__ import annotations

import sqlite3
from time import time

from .database import new_event_id
from .errors import api_error


def enforce_rate_limit(db: sqlite3.Connection, scope: str, key: str, limit: int, window_seconds: int) -> None:
    now_epoch = int(time())
    expires_at = now_epoch + window_seconds
    db.execute("DELETE FROM rate_limit_events WHERE expires_at <= ?", (now_epoch,))
    db.execute(
        "INSERT INTO rate_limit_events (event_id, scope, rate_key, created_at, expires_at) VALUES (?, ?, ?, ?, ?)",
        (new_event_id("ratelimit"), scope, key, now_epoch, expires_at),
    )
    count = db.execute(
        "SELECT COUNT(*) AS count FROM rate_limit_events WHERE scope = ? AND rate_key = ? AND expires_at > ?",
        (scope, key, now_epoch),
    ).fetchone()["count"]
    db.commit()

    if count > limit:
        raise api_error(429, "RATE_LIMITED", "too many requests, please try again later")


def reset_rate_limits() -> None:
    return None
