from pathlib import Path
import sqlite3

from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.main import app
from app.rate_limit import reset_rate_limits


def create_client(tmp_path: Path) -> TestClient:
    database_url = f"sqlite:///{tmp_path / 'test.db'}"
    reset_rate_limits()
    app.dependency_overrides.clear()
    app.dependency_overrides[get_settings] = lambda: Settings(
        fastapi_database_url=database_url,
        jwt_secret_key="test-secret",
        jwt_refresh_secret_key="test-refresh-secret",
        realtime_shared_secret="test-realtime-secret",
    )
    return TestClient(app)


def auth_headers(access_token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {access_token}"}


def test_register_login_me_refresh_and_logout(tmp_path: Path):
    client = create_client(tmp_path)

    register = client.post(
        "/auth/register",
        json={
            "identifier": "user_1",
            "displayName": "User One",
            "password": "demo-pass-123",
        },
    )
    assert register.status_code == 201
    register_json = register.json()
    assert register_json["userId"] == "user_1"
    assert register_json["accessToken"]
    assert register_json["refreshToken"]

    me = client.get("/auth/me", headers=auth_headers(register_json["accessToken"]))
    assert me.status_code == 200
    assert me.json() == {"userId": "user_1", "displayName": "User One"}

    login = client.post(
        "/auth/login",
        json={
            "identifier": "user_1",
            "password": "demo-pass-123",
        },
    )
    assert login.status_code == 200
    login_json = login.json()
    assert login_json["accessToken"]
    assert login_json["refreshToken"]
    assert login_json["refreshToken"] != register_json["refreshToken"]

    unauthorized = client.get("/documents")
    assert unauthorized.status_code == 401
    assert unauthorized.json()["error"]["code"] == "AUTH_REQUIRED"

    refreshed = client.post(
        "/auth/refresh",
        json={"refreshToken": login_json["refreshToken"]},
    )
    assert refreshed.status_code == 200
    refreshed_json = refreshed.json()
    assert refreshed_json["accessToken"]
    assert refreshed_json["refreshToken"] != login_json["refreshToken"]

    logout = client.post(
        "/auth/logout",
        headers=auth_headers(refreshed_json["accessToken"]),
        json={"refreshToken": refreshed_json["refreshToken"]},
    )
    assert logout.status_code == 200
    assert logout.json() == {"revoked": True}

    reuse_revoked = client.post(
        "/auth/refresh",
        json={"refreshToken": refreshed_json["refreshToken"]},
    )
    assert reuse_revoked.status_code == 401
    assert reuse_revoked.json()["error"]["code"] == "AUTH_EXPIRED"

    access_after_logout = client.get("/documents", headers=auth_headers(refreshed_json["accessToken"]))
    assert access_after_logout.status_code == 401
    assert access_after_logout.json()["error"]["code"] == "AUTH_FAILED"

    db = sqlite3.connect(tmp_path / "test.db")
    row = db.execute("SELECT refresh_token FROM refresh_tokens WHERE user_id = ? ORDER BY created_at DESC LIMIT 1", ("user_1",)).fetchone()
    db.close()
    assert row is not None
    assert row[0] != refreshed_json["refreshToken"]
    assert len(row[0]) == 64


def test_register_rejects_duplicate_identifier(tmp_path: Path):
    client = create_client(tmp_path)

    first = client.post(
        "/auth/register",
        json={"identifier": "user_dup", "displayName": "User Dup", "password": "demo-pass-123"},
    )
    assert first.status_code == 201

    duplicate = client.post(
        "/auth/register",
        json={"identifier": "user_dup", "displayName": "User Dup Two", "password": "demo-pass-456"},
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "CONFLICT"


def test_login_rejects_wrong_password(tmp_path: Path):
    client = create_client(tmp_path)

    client.post(
        "/auth/register",
        json={
            "identifier": "user_2",
            "displayName": "User Two",
            "password": "correct-pass",
        },
    )

    response = client.post(
        "/auth/login",
        json={
            "identifier": "user_2",
            "password": "wrong-pass",
        },
    )
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "AUTH_FAILED"


def test_forgot_password_resets_password_and_revokes_existing_sessions(tmp_path: Path):
    client = create_client(tmp_path)

    client.post(
        "/auth/register",
        json={
            "identifier": "user_reset",
            "displayName": "User Reset",
            "password": "original-pass",
        },
    )

    login = client.post(
        "/auth/login",
        json={
            "identifier": "user_reset",
            "password": "original-pass",
        },
    )
    old_access_token = login.json()["accessToken"]

    forgot = client.post("/auth/forgot-password", json={"identifier": "user_reset"})
    assert forgot.status_code == 200
    forgot_json = forgot.json()
    assert forgot_json["accepted"] is True
    assert forgot_json["resetToken"]

    reset = client.post(
        "/auth/reset-password",
        json={
            "identifier": "user_reset",
            "resetToken": forgot_json["resetToken"],
            "newPassword": "new-pass-123",
        },
    )
    assert reset.status_code == 200
    assert reset.json() == {"reset": True}

    old_login = client.post(
        "/auth/login",
        json={
            "identifier": "user_reset",
            "password": "original-pass",
        },
    )
    assert old_login.status_code == 401

    new_login = client.post(
        "/auth/login",
        json={
            "identifier": "user_reset",
            "password": "new-pass-123",
        },
    )
    assert new_login.status_code == 200

    old_access_after_reset = client.get("/documents", headers=auth_headers(old_access_token))
    assert old_access_after_reset.status_code == 401
    assert old_access_after_reset.json()["error"]["code"] == "AUTH_FAILED"


def test_auth_identifier_rejects_injection_style_input(tmp_path: Path):
    client = create_client(tmp_path)
    response = client.post(
        "/auth/login",
        json={
            "identifier": "user_1' OR '1'='1",
            "password": "irrelevant",
        },
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_INPUT"


def test_refresh_rejects_invalid_token(tmp_path: Path):
    client = create_client(tmp_path)

    response = client.post("/auth/refresh", json={"refreshToken": "not-a-real-token"})
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "AUTH_EXPIRED"
    assert "details" not in response.json()["error"]


def test_health_allows_configured_frontend_origin(tmp_path: Path):
    client = create_client(tmp_path)

    response = client.options(
        "/health",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"
