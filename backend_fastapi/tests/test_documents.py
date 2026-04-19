from pathlib import Path

from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.main import app
from app.rate_limit import reset_rate_limits


def create_client(tmp_path: Path) -> TestClient:
    database_url = f"sqlite:///{tmp_path / 'documents.db'}"
    reset_rate_limits()
    app.dependency_overrides.clear()
    app.dependency_overrides[get_settings] = lambda: Settings(
        fastapi_database_url=database_url,
        jwt_secret_key="test-secret",
        jwt_refresh_secret_key="test-refresh-secret",
        realtime_shared_secret="test-realtime-secret",
        realtime_ws_base_url="ws://localhost:3001/ws",
    )
    return TestClient(app)


def register_and_login(client: TestClient, identifier: str) -> dict:
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
    assert login.status_code == 200
    return login.json()


def auth_headers(access_token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {access_token}"}


def test_document_permissions_versions_revert_and_session(tmp_path: Path):
    client = create_client(tmp_path)
    owner = register_and_login(client, "user_1")
    editor = register_and_login(client, "user_2")

    create_document = client.post(
        "/documents",
        headers=auth_headers(owner["accessToken"]),
        json={"title": "Project brief", "content": "Initial text"},
    )
    assert create_document.status_code == 201
    document_id = create_document.json()["documentId"]

    list_documents = client.get("/documents", headers=auth_headers(owner["accessToken"]))
    assert list_documents.status_code == 200
    assert list_documents.json()["owned"][0]["documentId"] == document_id

    grant_editor = client.put(
        f"/documents/{document_id}/permissions",
        headers=auth_headers(owner["accessToken"]),
        json={"requestId": "req_perm_1", "targetUserId": "user_2", "role": "editor"},
    )
    assert grant_editor.status_code == 200

    get_document = client.get(
        f"/documents/{document_id}",
        headers=auth_headers(editor["accessToken"]),
    )
    assert get_document.status_code == 200
    assert get_document.json()["role"] == "editor"

    save_document = client.put(
        f"/documents/{document_id}/content",
        headers=auth_headers(editor["accessToken"]),
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
        headers=auth_headers(owner["accessToken"]),
    )
    assert versions.status_code == 200
    assert versions.json()["versions"][0]["reason"] == "content_update"

    session = client.post(
        "/sessions",
        headers=auth_headers(owner["accessToken"]),
        json={"documentId": document_id},
    )
    assert session.status_code == 200
    assert session.json()["wsUrl"] == "ws://localhost:3001/ws"
    assert session.json()["sessionToken"]

    target_version_id = versions.json()["versions"][1]["versionId"]
    revert = client.post(
        f"/documents/{document_id}/revert",
        headers=auth_headers(owner["accessToken"]),
        json={"requestId": "req_revert_1", "targetVersionId": target_version_id},
    )
    assert revert.status_code == 200

    reverted_document = client.get(
        f"/documents/{document_id}",
        headers=auth_headers(editor["accessToken"]),
    )
    assert reverted_document.status_code == 200
    assert reverted_document.json()["content"] == "Initial text"


def test_permissions_ai_policy_and_viewer_update_restrictions(tmp_path: Path):
    client = create_client(tmp_path)
    owner = register_and_login(client, "owner_user")
    viewer = register_and_login(client, "viewer_user")

    create_document = client.post(
        "/documents",
        headers=auth_headers(owner["accessToken"]),
        json={"title": "Protected", "content": "Original"},
    )
    document_id = create_document.json()["documentId"]

    grant_viewer = client.put(
        f"/documents/{document_id}/permissions",
        headers=auth_headers(owner["accessToken"]),
        json={"requestId": "req_perm_viewer", "targetUserId": "viewer_user", "role": "viewer"},
    )
    assert grant_viewer.status_code == 200

    viewer_permissions = client.get(
        f"/documents/{document_id}/permissions",
        headers=auth_headers(viewer["accessToken"]),
    )
    assert viewer_permissions.status_code == 403
    assert viewer_permissions.json()["error"]["code"] == "PERMISSION_DENIED"

    viewer_save = client.put(
        f"/documents/{document_id}/content",
        headers=auth_headers(viewer["accessToken"]),
        json={
            "requestId": "req_viewer_save",
            "content": "Viewer update",
            "baseRevisionId": "rev_1",
        },
    )
    assert viewer_save.status_code == 403
    assert viewer_save.json()["error"]["code"] == "PERMISSION_DENIED"

    revoke = client.delete(
        f"/documents/{document_id}/permissions/viewer_user",
        headers=auth_headers(owner["accessToken"]),
    )
    assert revoke.status_code == 200
    assert revoke.json()["revoked"] is True


def test_share_links_can_be_created_claimed_and_revoked(tmp_path: Path):
    client = create_client(tmp_path)
    owner = register_and_login(client, "owner_link")
    collaborator = register_and_login(client, "collab_link")

    create_document = client.post(
        "/documents",
        headers=auth_headers(owner["accessToken"]),
        json={"title": "Shared by Link", "content": "Body"},
    )
    document_id = create_document.json()["documentId"]

    create_link = client.post(
        f"/documents/{document_id}/share-links",
        headers=auth_headers(owner["accessToken"]),
        json={"role": "editor", "expiresInHours": 24},
    )
    assert create_link.status_code == 200
    share_token = create_link.json()["shareToken"]
    link_id = create_link.json()["linkId"]

    preview = client.get(f"/share-links/{share_token}")
    assert preview.status_code == 200
    assert preview.json()["documentId"] == document_id
    assert preview.json()["role"] == "editor"

    accept = client.post(
        f"/share-links/{share_token}/accept",
        headers=auth_headers(collaborator["accessToken"]),
    )
    assert accept.status_code == 200
    assert accept.json()["accepted"] is True
    assert accept.json()["role"] == "editor"

    collaborator_document = client.get(
        f"/documents/{document_id}",
        headers=auth_headers(collaborator["accessToken"]),
    )
    assert collaborator_document.status_code == 200
    assert collaborator_document.json()["role"] == "editor"

    revoke_link = client.delete(
        f"/documents/{document_id}/share-links/{link_id}",
        headers=auth_headers(owner["accessToken"]),
    )
    assert revoke_link.status_code == 200
    assert revoke_link.json()["active"] is False

    preview_revoked = client.get(f"/share-links/{share_token}")
    assert preview_revoked.status_code == 410
    assert preview_revoked.json()["error"]["code"] == "LINK_REVOKED"


def test_share_link_revocation_can_optionally_revoke_link_granted_access(tmp_path: Path):
    client = create_client(tmp_path)
    owner = register_and_login(client, "owner_revoke_link")
    collaborator = register_and_login(client, "collab_revoke_link")

    create_document = client.post(
        "/documents",
        headers=auth_headers(owner["accessToken"]),
        json={"title": "Revocable link", "content": "Body"},
    )
    document_id = create_document.json()["documentId"]

    create_link = client.post(
        f"/documents/{document_id}/share-links",
        headers=auth_headers(owner["accessToken"]),
        json={"role": "viewer", "expiresInHours": 24, "requestId": "req_share_1"},
    )
    share_token = create_link.json()["shareToken"]
    link_id = create_link.json()["linkId"]

    accept = client.post(
        f"/share-links/{share_token}/accept",
        headers=auth_headers(collaborator["accessToken"]),
    )
    assert accept.status_code == 200

    revoke_with_access = client.delete(
        f"/documents/{document_id}/share-links/{link_id}?revokeAccess=true",
        headers=auth_headers(owner["accessToken"]),
    )
    assert revoke_with_access.status_code == 200
    assert revoke_with_access.json()["revokedAccessCount"] == 1

    access_after_revoke = client.get(
        f"/documents/{document_id}",
        headers=auth_headers(collaborator["accessToken"]),
    )
    assert access_after_revoke.status_code == 403


def test_idempotent_share_link_save_and_revert_requests(tmp_path: Path):
    client = create_client(tmp_path)
    owner = register_and_login(client, "owner_idempotent")

    create_document = client.post(
        "/documents",
        headers=auth_headers(owner["accessToken"]),
        json={"title": "Idempotent Doc", "content": "Initial text"},
    )
    document_id = create_document.json()["documentId"]

    create_link_first = client.post(
        f"/documents/{document_id}/share-links",
        headers=auth_headers(owner["accessToken"]),
        json={"role": "editor", "expiresInHours": 24, "requestId": "req_share_same"},
    )
    create_link_second = client.post(
        f"/documents/{document_id}/share-links",
        headers=auth_headers(owner["accessToken"]),
        json={"role": "editor", "expiresInHours": 24, "requestId": "req_share_same"},
    )
    assert create_link_first.status_code == 200
    assert create_link_second.status_code == 200
    assert create_link_first.json()["linkId"] == create_link_second.json()["linkId"]
    assert create_link_first.json()["shareToken"] == create_link_second.json()["shareToken"]

    save_first = client.put(
        f"/documents/{document_id}/content",
        headers=auth_headers(owner["accessToken"]),
        json={
            "requestId": "req_save_same",
            "content": "Updated once",
            "baseRevisionId": "rev_1",
        },
    )
    save_second = client.put(
        f"/documents/{document_id}/content",
        headers=auth_headers(owner["accessToken"]),
        json={
            "requestId": "req_save_same",
            "content": "Updated once",
            "baseRevisionId": "rev_1",
        },
    )
    assert save_first.status_code == 200
    assert save_second.status_code == 200
    assert save_first.json()["revisionId"] == save_second.json()["revisionId"]

    versions_after_save = client.get(
        f"/documents/{document_id}/versions",
        headers=auth_headers(owner["accessToken"]),
    )
    assert versions_after_save.status_code == 200
    save_versions = [version for version in versions_after_save.json()["versions"] if version["reason"] == "content_update"]
    assert len(save_versions) == 1

    target_version_id = versions_after_save.json()["versions"][-1]["versionId"]
    revert_first = client.post(
        f"/documents/{document_id}/revert",
        headers=auth_headers(owner["accessToken"]),
        json={"requestId": "req_revert_same", "targetVersionId": target_version_id},
    )
    revert_second = client.post(
        f"/documents/{document_id}/revert",
        headers=auth_headers(owner["accessToken"]),
        json={"requestId": "req_revert_same", "targetVersionId": target_version_id},
    )
    assert revert_first.status_code == 200
    assert revert_second.status_code == 200
    assert revert_first.json()["currentVersionId"] == revert_second.json()["currentVersionId"]

    versions_after_revert = client.get(
        f"/documents/{document_id}/versions",
        headers=auth_headers(owner["accessToken"]),
    )
    assert versions_after_revert.status_code == 200
    revert_versions = [version for version in versions_after_revert.json()["versions"] if version["reason"] == "revert"]
    assert len(revert_versions) == 1


def test_sync_and_async_export_routes(tmp_path: Path):
    client = create_client(tmp_path)
    owner = register_and_login(client, "export_owner")

    create_document = client.post(
        "/documents",
        headers=auth_headers(owner["accessToken"]),
        json={"title": "Export Doc", "content": "Body"},
    )
    document_id = create_document.json()["documentId"]

    txt_export = client.post(
        f"/documents/{document_id}/export",
        headers=auth_headers(owner["accessToken"]),
        json={"format": "txt", "requestId": "req_export_txt"},
    )
    assert txt_export.status_code == 200
    assert txt_export.json()["contentType"].startswith("text/plain")

    pdf_export = client.post(
        f"/documents/{document_id}/export",
        headers=auth_headers(owner["accessToken"]),
        json={"format": "pdf", "requestId": "req_export_pdf"},
    )
    assert pdf_export.status_code == 200
    job_id = pdf_export.json()["jobId"]

    status_response = client.get(f"/exports/{job_id}", headers=auth_headers(owner["accessToken"]))
    assert status_response.status_code == 200
    assert status_response.json()["status"] == "SUCCEEDED"

    download = client.get(f"/exports/{job_id}/download", headers=auth_headers(owner["accessToken"]))
    assert download.status_code == 200
    assert download.headers["content-type"] == "application/pdf"
    assert download.content.startswith(b"%PDF")

    docx_export = client.post(
        f"/documents/{document_id}/export",
        headers=auth_headers(owner["accessToken"]),
        json={"format": "docx", "requestId": "req_export_docx"},
    )
    assert docx_export.status_code == 200
    docx_job_id = docx_export.json()["jobId"]

    docx_status = client.get(f"/exports/{docx_job_id}", headers=auth_headers(owner["accessToken"]))
    assert docx_status.status_code == 200
    assert docx_status.json()["status"] == "SUCCEEDED"

    docx_download = client.get(f"/exports/{docx_job_id}/download", headers=auth_headers(owner["accessToken"]))
    assert docx_download.status_code == 200
    assert docx_download.headers["content-type"] == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    assert docx_download.content.startswith(b"PK")
