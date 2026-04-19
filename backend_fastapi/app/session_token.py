from __future__ import annotations

import base64
import hashlib
import hmac
import json
from typing import Any, Dict


def base64url_encode(value: str) -> str:
    return base64.urlsafe_b64encode(value.encode("utf-8")).decode("utf-8").rstrip("=")


def sign_value(value: str, secret: str) -> str:
    digest = hmac.new(secret.encode("utf-8"), value.encode("utf-8"), hashlib.sha256).digest()
    return base64.urlsafe_b64encode(digest).decode("utf-8").rstrip("=")


def sign_session_token(payload: Dict[str, Any], secret: str) -> str:
    encoded_payload = base64url_encode(json.dumps(payload, separators=(",", ":")))
    signature = sign_value(encoded_payload, secret)
    return f"{encoded_payload}.{signature}"
