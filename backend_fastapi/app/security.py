import hashlib
from datetime import datetime, timedelta, timezone
from uuid import uuid4
from typing import Any, Dict

from jose import jwt
from passlib.context import CryptContext

from .config import Settings, get_settings

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def hash_opaque_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _create_token(payload: Dict[str, Any], secret: str, expires_delta: timedelta) -> str:
    now = datetime.now(timezone.utc)
    to_encode = payload.copy()
    to_encode.update({"iat": int(now.timestamp()), "exp": int((now + expires_delta).timestamp())})
    return jwt.encode(to_encode, secret, algorithm="HS256")


def create_access_token(subject: str, settings: Settings | None = None, session_id: str | None = None) -> str:
    settings = settings or get_settings()
    payload = {"sub": subject, "token_type": "access", "jti": new_token_id()}
    if session_id:
        payload["sid"] = session_id
    return _create_token(
        payload,
        settings.jwt_secret_key,
        timedelta(minutes=settings.access_token_expire_minutes),
    )


def create_refresh_token(subject: str, settings: Settings | None = None) -> str:
    settings = settings or get_settings()
    return _create_token(
        {"sub": subject, "token_type": "refresh", "jti": new_token_id()},
        settings.jwt_refresh_secret_key,
        timedelta(days=settings.refresh_token_expire_days),
    )


def decode_access_token(token: str, settings: Settings | None = None) -> Dict[str, Any]:
    settings = settings or get_settings()
    return jwt.decode(token, settings.jwt_secret_key, algorithms=["HS256"])


def decode_refresh_token(token: str, settings: Settings | None = None) -> Dict[str, Any]:
    settings = settings or get_settings()
    return jwt.decode(token, settings.jwt_refresh_secret_key, algorithms=["HS256"])


def new_token_id() -> str:
    return uuid4().hex
