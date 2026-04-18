from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from jose import JWTError

from ..config import Settings, get_settings
from ..deps import get_db
from ..schemas import AuthResponse, LoginRequest, RefreshRequest, RegisterRequest
from ..security import create_access_token, create_refresh_token, decode_refresh_token, hash_password, new_token_id, verify_password

import sqlite3

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=AuthResponse, summary="Register a new user")
def register_user(
    payload: RegisterRequest,
    db: sqlite3.Connection = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> AuthResponse:
    existing = db.execute("SELECT user_id FROM users WHERE user_id = ?", (payload.identifier,)).fetchone()
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error": {"code": "CONFLICT", "message": "identifier already exists"}},
        )

    password_hash = hash_password(payload.password)
    timestamp = datetime.now(timezone.utc).isoformat()
    db.execute(
        "INSERT INTO users (user_id, display_name, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        (payload.identifier, payload.display_name, password_hash, timestamp, timestamp),
    )
    access_token = create_access_token(payload.identifier, settings)
    refresh_token = create_refresh_token(payload.identifier, settings)
    refresh_payload = decode_refresh_token(refresh_token, settings)
    db.execute(
        "INSERT INTO refresh_tokens (token_id, user_id, refresh_token, expires_at, created_at) VALUES (?, ?, ?, ?, ?)",
        (new_token_id(), payload.identifier, refresh_token, int(refresh_payload["exp"]), timestamp),
    )
    db.commit()
    return AuthResponse(
        user_id=payload.identifier,
        display_name=payload.display_name,
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=20 * 60,
    )


@router.post("/login", response_model=AuthResponse, summary="Login with identifier and password")
def login_user(
    payload: LoginRequest,
    db: sqlite3.Connection = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> AuthResponse:
    user = db.execute(
        "SELECT user_id, display_name, password_hash FROM users WHERE user_id = ?",
        (payload.identifier,),
    ).fetchone()
    if user is None or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": {"code": "AUTH_FAILED", "message": "invalid credentials"}},
        )

    access_token = create_access_token(payload.identifier, settings)
    refresh_token = create_refresh_token(payload.identifier, settings)
    refresh_payload = decode_refresh_token(refresh_token, settings)
    timestamp = datetime.now(timezone.utc).isoformat()
    db.execute("DELETE FROM refresh_tokens WHERE user_id = ?", (payload.identifier,))
    db.execute(
        "INSERT INTO refresh_tokens (token_id, user_id, refresh_token, expires_at, created_at) VALUES (?, ?, ?, ?, ?)",
        (new_token_id(), payload.identifier, refresh_token, int(refresh_payload["exp"]), timestamp),
    )
    db.commit()
    return AuthResponse(
        user_id=payload.identifier,
        display_name=user["display_name"],
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=20 * 60,
    )


@router.post("/refresh", response_model=AuthResponse, summary="Refresh an access token")
def refresh_session(
    payload: RefreshRequest,
    db: sqlite3.Connection = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> AuthResponse:
    try:
        decoded = decode_refresh_token(payload.refresh_token, settings)
    except JWTError as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": {"code": "AUTH_EXPIRED", "message": "invalid refresh token", "details": {"reason": str(error)}}},
        ) from error

    stored = db.execute(
        "SELECT user_id, expires_at FROM refresh_tokens WHERE refresh_token = ?",
        (payload.refresh_token,),
    ).fetchone()
    if stored is None or stored["user_id"] != decoded.get("sub") or decoded.get("token_type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": {"code": "AUTH_EXPIRED", "message": "refresh token is no longer valid"}},
        )

    user = db.execute(
        "SELECT user_id, display_name FROM users WHERE user_id = ?",
        (stored["user_id"],),
    ).fetchone()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": {"code": "AUTH_FAILED", "message": "user not found for refresh token"}},
        )

    access_token = create_access_token(user["user_id"], settings)
    refresh_token = create_refresh_token(user["user_id"], settings)
    refresh_payload = decode_refresh_token(refresh_token, settings)
    timestamp = datetime.now(timezone.utc).isoformat()
    db.execute("DELETE FROM refresh_tokens WHERE refresh_token = ?", (payload.refresh_token,))
    db.execute(
        "INSERT INTO refresh_tokens (token_id, user_id, refresh_token, expires_at, created_at) VALUES (?, ?, ?, ?, ?)",
        (new_token_id(), user["user_id"], refresh_token, int(refresh_payload["exp"]), timestamp),
    )
    db.commit()

    return AuthResponse(
        user_id=user["user_id"],
        display_name=user["display_name"],
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.access_token_expire_minutes * 60,
    )
