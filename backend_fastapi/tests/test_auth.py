from pathlib import Path

from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app


def create_client(tmp_path: Path) -> TestClient:
    database_url = f"sqlite:///{tmp_path / 'test.db'}"

    app.dependency_overrides[get_settings] = lambda: get_settings().model_copy(
        update={
            "fastapi_database_url": database_url,
            "jwt_secret_key": "test-secret",
            "jwt_refresh_secret_key": "test-refresh-secret",
        }
    )
    return TestClient(app)


def test_register_login_refresh_and_protected_documents(tmp_path: Path):
    client = create_client(tmp_path)

    register = client.post(
        "/auth/register",
        json={
            "identifier": "user_1",
            "displayName": "User One",
            "password": "demo-pass-123",
        },
    )
    assert register.status_code == 200
    register_json = register.json()
    assert register_json["userId"] == "user_1"
    assert register_json["refreshToken"]

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

    unauthorized = client.get("/documents")
    assert unauthorized.status_code == 401

    authorized = client.get(
        "/documents",
        headers={"Authorization": f"Bearer {login_json['accessToken']}"},
    )
    assert authorized.status_code == 200
    assert authorized.json() == {"owned": [], "shared": []}

    refreshed = client.post(
        "/auth/refresh",
        json={"refreshToken": login_json["refreshToken"]},
    )
    assert refreshed.status_code == 200
    assert refreshed.json()["accessToken"]


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
    assert response.json()["detail"]["error"]["code"] == "AUTH_FAILED"
