from datetime import datetime, timezone

import sqlite3
from fastapi import APIRouter, Depends, Request, status
from jose import JWTError

from ..config import Settings, get_settings
from ..deps import get_current_user, get_db
from ..errors import api_error
from ..rate_limit import enforce_rate_limit
from ..schemas import AuthResponse, ForgotPasswordRequest, ForgotPasswordResponse, LoginRequest, LogoutRequest, LogoutResponse, MeResponse, RefreshRequest, RegisterRequest, ResetPasswordRequest, ResetPasswordResponse
from ..security import create_access_token, create_refresh_token, decode_refresh_token, hash_opaque_token, hash_password, hash_refresh_token, new_token_id, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED, summary="Register a new user")
def register_user(
    payload: RegisterRequest,
    request: Request,
    db: sqlite3.Connection = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> AuthResponse:
    enforce_rate_limit(db, "auth_register", request.client.host if request.client else "unknown", 10, 300)
    existing = db.execute("SELECT user_id FROM users WHERE user_id = ?", (payload.identifier,)).fetchone()
    if existing is not None:
        raise api_error(409, "CONFLICT", "identifier already exists")

    timestamp = datetime.now(timezone.utc).isoformat()
    session_id = new_token_id()
    db.execute(
        "INSERT INTO users (user_id, display_name, global_role, access_token, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (
            payload.identifier,
            payload.display_name,
            "user",
            f"token_{payload.identifier}",
            hash_password(payload.password),
            timestamp,
            timestamp,
        ),
    )
    access_token = create_access_token(payload.identifier, settings, session_id=session_id)
    refresh_token = create_refresh_token(payload.identifier, settings)
    refresh_payload = decode_refresh_token(refresh_token, settings)
    refresh_token_hash = hash_refresh_token(refresh_token)
    db.execute(
        "INSERT INTO refresh_tokens (token_id, user_id, refresh_token, expires_at, created_at, revoked_at) VALUES (?, ?, ?, ?, ?, NULL)",
        (session_id, payload.identifier, refresh_token_hash, int(refresh_payload["exp"]), timestamp),
    )
    db.commit()
    return AuthResponse(
        user_id=payload.identifier,
        display_name=payload.display_name,
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.access_token_expire_minutes * 60,
    )


@router.post("/login", response_model=AuthResponse, summary="Login with identifier and password")
def login_user(
    payload: LoginRequest,
    request: Request,
    db: sqlite3.Connection = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> AuthResponse:
    request_key = f"{request.client.host if request.client else 'unknown'}:{payload.identifier}"
    enforce_rate_limit(db, "auth_login", request_key, 20, 300)
    user = db.execute(
        "SELECT user_id, display_name, password_hash FROM users WHERE user_id = ?",
        (payload.identifier,),
    ).fetchone()
    if user is None or user["password_hash"] is None or not verify_password(payload.password, user["password_hash"]):
        raise api_error(401, "AUTH_FAILED", "invalid credentials")

    timestamp = datetime.now(timezone.utc).isoformat()
    session_id = new_token_id()
    access_token = create_access_token(user["user_id"], settings, session_id=session_id)
    refresh_token = create_refresh_token(user["user_id"], settings)
    refresh_payload = decode_refresh_token(refresh_token, settings)
    refresh_token_hash = hash_refresh_token(refresh_token)
    db.execute(
        "INSERT INTO refresh_tokens (token_id, user_id, refresh_token, expires_at, created_at, revoked_at) VALUES (?, ?, ?, ?, ?, NULL)",
        (session_id, user["user_id"], refresh_token_hash, int(refresh_payload["exp"]), timestamp),
    )
    db.commit()
    return AuthResponse(
        user_id=user["user_id"],
        display_name=user["display_name"],
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.access_token_expire_minutes * 60,
    )


@router.post("/refresh", response_model=AuthResponse, summary="Refresh an access token")
def refresh_session(
    payload: RefreshRequest,
    request: Request,
    db: sqlite3.Connection = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> AuthResponse:
    enforce_rate_limit(db, "auth_refresh", request.client.host if request.client else "unknown", 30, 300)
    try:
        decoded = decode_refresh_token(payload.refresh_token, settings)
    except JWTError as error:
        raise api_error(401, "AUTH_EXPIRED", "invalid refresh token") from error

    presented_token_hash = hash_refresh_token(payload.refresh_token)
    timestamp = datetime.now(timezone.utc).isoformat()
    now_epoch = int(datetime.now(timezone.utc).timestamp())

    try:
        db.execute("BEGIN IMMEDIATE")
        stored = db.execute(
            "SELECT token_id, user_id, expires_at, revoked_at FROM refresh_tokens WHERE refresh_token = ?",
            (presented_token_hash,),
        ).fetchone()
        if (
            stored is None
            or stored["revoked_at"] is not None
            or stored["user_id"] != decoded.get("sub")
            or decoded.get("token_type") != "refresh"
            or stored["expires_at"] <= now_epoch
        ):
            db.rollback()
            raise api_error(401, "AUTH_EXPIRED", "refresh token is no longer valid")

        revoked = db.execute(
            "UPDATE refresh_tokens SET revoked_at = ? WHERE refresh_token = ? AND revoked_at IS NULL",
            (timestamp, presented_token_hash),
        )
        if revoked.rowcount != 1:
            db.rollback()
            raise api_error(401, "AUTH_EXPIRED", "refresh token is no longer valid")

        user = db.execute(
            "SELECT user_id, display_name FROM users WHERE user_id = ?",
            (stored["user_id"],),
        ).fetchone()
        if user is None:
            db.rollback()
            raise api_error(401, "AUTH_FAILED", "user not found for refresh token")

        next_session_id = new_token_id()
        access_token = create_access_token(user["user_id"], settings, session_id=next_session_id)
        refresh_token = create_refresh_token(user["user_id"], settings)
        refresh_payload = decode_refresh_token(refresh_token, settings)
        db.execute(
            "INSERT INTO refresh_tokens (token_id, user_id, refresh_token, expires_at, created_at, revoked_at) VALUES (?, ?, ?, ?, ?, NULL)",
            (next_session_id, user["user_id"], hash_refresh_token(refresh_token), int(refresh_payload["exp"]), timestamp),
        )
        db.commit()
    except Exception:
        if db.in_transaction:
            db.rollback()
        raise

    return AuthResponse(
        user_id=user["user_id"],
        display_name=user["display_name"],
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.access_token_expire_minutes * 60,
    )


@router.get("/me", response_model=MeResponse, summary="Return the current authenticated user")
def get_me(current_user=Depends(get_current_user)) -> MeResponse:
    return MeResponse(user_id=current_user["user_id"], display_name=current_user["display_name"])


@router.post("/logout", response_model=LogoutResponse, summary="Revoke a refresh token")
def logout(
    payload: LogoutRequest,
    request: Request,
    current_user=Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> LogoutResponse:
    enforce_rate_limit(db, "auth_logout", request.client.host if request.client else "unknown", 30, 300)
    try:
        decoded = decode_refresh_token(payload.refresh_token, settings)
    except JWTError as error:
        raise api_error(401, "AUTH_EXPIRED", "invalid refresh token") from error

    if decoded.get("sub") != current_user["user_id"] or decoded.get("token_type") != "refresh":
        raise api_error(403, "PERMISSION_DENIED", "refresh token does not belong to the current user")

    timestamp = datetime.now(timezone.utc).isoformat()
    result = db.execute(
        "UPDATE refresh_tokens SET revoked_at = ? WHERE refresh_token = ? AND user_id = ? AND revoked_at IS NULL",
        (timestamp, hash_refresh_token(payload.refresh_token), current_user["user_id"]),
    )
    if current_user.get("token_id") and current_user.get("token_expires_at"):
        db.execute(
            "INSERT OR REPLACE INTO revoked_access_tokens (token_id, expires_at, revoked_at, user_id) VALUES (?, ?, ?, ?)",
            (current_user["token_id"], int(current_user["token_expires_at"]), timestamp, current_user["user_id"]),
        )
    db.commit()
    return LogoutResponse(revoked=result.rowcount > 0)


@router.post("/forgot-password", response_model=ForgotPasswordResponse, summary="Issue a one-time local password reset token")
def forgot_password(
    payload: ForgotPasswordRequest,
    request: Request,
    db: sqlite3.Connection = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> ForgotPasswordResponse:
    enforce_rate_limit(db, "auth_forgot_password", request.client.host if request.client else "unknown", 10, 300)
    message = "If the account exists, a one-time reset token has been issued for this local environment."
    user = db.execute(
        "SELECT user_id FROM users WHERE user_id = ?",
        (payload.identifier,),
    ).fetchone()
    if user is None:
        return ForgotPasswordResponse(accepted=True, message=message, reset_token=None, expires_at=None)

    timestamp = datetime.now(timezone.utc).isoformat()
    expires_at_epoch = int(datetime.now(timezone.utc).timestamp()) + settings.password_reset_token_expire_minutes * 60
    expires_at_iso = datetime.fromtimestamp(expires_at_epoch, tz=timezone.utc).isoformat()
    raw_reset_token = new_token_id() + new_token_id()
    db.execute(
        "UPDATE password_reset_tokens SET consumed_at = ? WHERE user_id = ? AND consumed_at IS NULL",
        (timestamp, payload.identifier),
    )
    db.execute(
        "INSERT INTO password_reset_tokens (token_id, user_id, token_hash, expires_at, created_at, consumed_at) VALUES (?, ?, ?, ?, ?, NULL)",
        (new_token_id(), payload.identifier, hash_opaque_token(raw_reset_token), expires_at_epoch, timestamp),
    )
    db.commit()
    return ForgotPasswordResponse(accepted=True, message=message, reset_token=raw_reset_token, expires_at=expires_at_iso)


@router.post("/reset-password", response_model=ResetPasswordResponse, summary="Reset a password using a one-time token")
def reset_password(
    payload: ResetPasswordRequest,
    request: Request,
    db: sqlite3.Connection = Depends(get_db),
) -> ResetPasswordResponse:
    request_key = f"{request.client.host if request.client else 'unknown'}:{payload.identifier}"
    enforce_rate_limit(db, "auth_reset_password", request_key, 10, 300)
    timestamp = datetime.now(timezone.utc).isoformat()
    token_hash = hash_opaque_token(payload.reset_token)
    now_epoch = int(datetime.now(timezone.utc).timestamp())

    try:
        db.execute("BEGIN IMMEDIATE")
        token_row = db.execute(
            """
            SELECT token_id, user_id, expires_at, consumed_at
            FROM password_reset_tokens
            WHERE token_hash = ? AND user_id = ?
            """,
            (token_hash, payload.identifier),
        ).fetchone()
        if (
            token_row is None
            or token_row["consumed_at"] is not None
            or token_row["expires_at"] <= now_epoch
        ):
            db.rollback()
            raise api_error(401, "RESET_TOKEN_INVALID", "reset token is invalid or expired")

        db.execute(
            "UPDATE users SET password_hash = ?, updated_at = ? WHERE user_id = ?",
            (hash_password(payload.new_password), timestamp, payload.identifier),
        )
        db.execute(
            "UPDATE password_reset_tokens SET consumed_at = ? WHERE token_id = ?",
            (timestamp, token_row["token_id"]),
        )
        db.execute(
            "UPDATE refresh_tokens SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL",
            (timestamp, payload.identifier),
        )
        db.commit()
    except Exception:
        if db.in_transaction:
            db.rollback()
        raise

    return ResetPasswordResponse(reset=True)
