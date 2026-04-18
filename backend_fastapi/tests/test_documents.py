from pathlib import Path

from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app


def create_client(tmp_path: Path) -> TestClient:
    database_url = f"sqlite:///{tmp_path / 'documents.db'}"
    app.dependency_overrides[get_settings] = lambda: get_settings().model_copy(
        update={
            "fastapi_database_url": database_url,
            "jwt_secret_key": "test-secret",
            "jwt_refresh_secret_key": "test-refresh-secret",
            "realtime_shared_secret": "test-realtime-secret",
            "realtime_ws_base_url": "ws://localhost:3001/ws",
        }
    )
    return TestClient(app)


def register_and_login(client: TestClient, identifier: str):
    client.post(
        "/auth/register",
        json={
            "identifier": identifier,
            "displayName": identifier,
            "password": "demo-pass-123",
        },
    )
    login = client.post(
        "/auth/login",
        json={
            "identifier": identifier,
            "password": "demo-pass-123",
        },
    )
    return login.json()


def test_document_permissions_versions_revert_and_session(tmp_path: Path):
    client = create_client(tmp_path)
    owner = register_and_login(client, "user_1")
    editor = register_and_login(client, "user_2")

    create_document = client.post(
        "/documents",
        headers={"Authorization": f"Bearer {owner['accessToken']}"},
        json={"title": "Project brief", "content": "Initial text"},
    )
    assert create_document.status_code == 200
    document_id = create_document.json()["documentId"]

    list_documents = client.get(
        "/documents",
        headers={"Authorization": f"Bearer {owner['accessToken']}"},
    )
    assert list_documents.status_code == 200
    assert list_documents.json()["owned"][0]["documentId"] == document_id

    grant_editor = client.put(
        f"/documents/{document_id}/permissions",
        headers={"Authorization": f"Bearer {owner['accessToken']}"},
        json={"requestId": "req_perm_1", "targetUserId": "user_2", "role": "editor"},
    )
    assert grant_editor.status_code == 200

    get_document = client.get(
        f"/documents/{document_id}",
        headers={"Authorization": f"Bearer {editor['accessToken']}"},
    )
    assert get_document.status_code == 200
    assert get_document.json()["role"] == "editor"

    save_document = client.put(
        f"/documents/{document_id}/content",
        headers={"Authorization": f"Bearer {editor['accessToken']}"},
        json={
            "requestId": "req_save_1",
            "content": "Updated text",
            "baseRevisionId": "rev_1",
        },
    )
    assert save_document.status_code == 200
    assert save_document.json()["revisionId"] == "rev_2"

    versions = client.get(
        f"/documents/{document_id}/versions",
        headers={"Authorization": f"Bearer {owner['accessToken']}"},
    )
    assert versions.status_code == 200
    assert versions.json()["versions"][0]["reason"] == "content_update"

    session = client.post(
        "/sessions",
        headers={"Authorization": f"Bearer {owner['accessToken']}"},
        json={"documentId": document_id},
    )
    assert session.status_code == 200
    assert "token=" in session.json()["wsUrl"]

    target_version_id = versions.json()["versions"][1]["versionId"]
    revert = client.post(
        f"/documents/{document_id}/revert",
        headers={"Authorization": f"Bearer {owner['accessToken']}"},
        json={"requestId": "req_revert_1", "targetVersionId": target_version_id},
    )
    assert revert.status_code == 200

    reverted_document = client.get(
        f"/documents/{document_id}",
        headers={"Authorization": f"Bearer {editor['accessToken']}"},
    )
    assert reverted_document.status_code == 200
    assert reverted_document.json()["content"] == "Initial text"


def test_permissions_and_viewer_update_restrictions(tmp_path: Path):
    client = create_client(tmp_path)
    owner = register_and_login(client, "owner_user")
    viewer = register_and_login(client, "viewer_user")

    create_document = client.post(
        "/documents",
        headers={"Authorization": f"Bearer {owner['accessToken']}"},
        json={"title": "Protected", "content": "Original"},
    )
    document_id = create_document.json()["documentId"]

    grant_viewer = client.put(
        f"/documents/{document_id}/permissions",
        headers={"Authorization": f"Bearer {owner['accessToken']}"},
        json={"requestId": "req_perm_viewer", "targetUserId": "viewer_user", "role": "viewer"},
    )
    assert grant_viewer.status_code == 200

    viewer_permissions = client.get(
        f"/documents/{document_id}/permissions",
        headers={"Authorization": f"Bearer {viewer['accessToken']}"},
    )
    assert viewer_permissions.status_code == 403

    viewer_save = client.put(
        f"/documents/{document_id}/content",
        headers={"Authorization": f"Bearer {viewer['accessToken']}"},
        json={
            "requestId": "req_viewer_save",
            "content": "Viewer update",
            "baseRevisionId": "rev_1",
        },
    )
    assert viewer_save.status_code == 403
    assert viewer_save.json()["detail"]["error"]["code"] == "PERMISSION_DENIED"


def test_ai_placeholder_routes_are_present_and_explicitly_not_implemented(tmp_path: Path):
    client = create_client(tmp_path)
    user = register_and_login(client, "user_ai")

    response = client.post(
        "/ai/rewrite/stream",
        headers={"Authorization": f"Bearer {user['accessToken']}"},
    )
    assert response.status_code == 501
    assert response.json()["detail"]["error"]["code"] == "NOT_IMPLEMENTED"
