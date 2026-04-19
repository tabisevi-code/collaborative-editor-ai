import json
from pathlib import Path

from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.main import app
from app.rate_limit import reset_rate_limits


def create_client(tmp_path: Path) -> TestClient:
    database_url = f"sqlite:///{tmp_path / 'ai.db'}"
    reset_rate_limits()
    app.dependency_overrides.clear()
    app.dependency_overrides[get_settings] = lambda: Settings(
        fastapi_database_url=database_url,
        jwt_secret_key="test-secret",
        jwt_refresh_secret_key="test-refresh-secret",
        realtime_shared_secret="test-realtime-secret",
        ai_stream_provider="stub",
    )
    return TestClient(app)


def auth_headers(access_token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {access_token}"}


def register_and_login(client: TestClient, identifier: str) -> dict:
    client.post(
        "/auth/register",
        json={"identifier": identifier, "displayName": identifier, "password": "demo-pass-123"},
    )
    login = client.post(
        "/auth/login",
        json={"identifier": identifier, "password": "demo-pass-123"},
    )
    return login.json()


def test_ai_stream_feedback_history_and_cancel(tmp_path: Path):
    client = create_client(tmp_path)
    owner = register_and_login(client, "user_ai")

    create_document = client.post(
        "/documents",
        headers=auth_headers(owner["accessToken"]),
        json={"title": "AI Doc", "content": "Original selected text"},
    )
    document_id = create_document.json()["documentId"]

    stream = client.post(
        "/ai/rewrite/stream",
        headers=auth_headers(owner["accessToken"]),
        json={
            "documentId": document_id,
            "selection": {"start": 0, "end": 22},
            "selectedText": "Original selected text",
            "contextBefore": "",
            "contextAfter": "",
            "instruction": "Make this more concise",
            "baseVersionId": create_document.json()["currentVersionId"],
        },
    )
    assert stream.status_code == 200
    assert "event: token" in stream.text
    assert "event: done" in stream.text

    done_payload = stream.text.split("event: done\ndata: ", 1)[1].split("\n\n", 1)[0]
    assert '"jobId":' in done_payload
    job_id = done_payload.split('"jobId": "', 1)[1].split('"', 1)[0]

    feedback = client.post(
        f"/ai/jobs/{job_id}/feedback",
        headers=auth_headers(owner["accessToken"]),
        json={
            "disposition": "applied_full",
            "appliedText": "Edited output",
            "appliedRange": {"start": 0, "end": 13},
        },
    )
    assert feedback.status_code == 200
    assert feedback.json()["jobId"] == job_id

    history = client.get(
        f"/documents/{document_id}/ai-history",
        headers=auth_headers(owner["accessToken"]),
    )
    assert history.status_code == 200
    assert history.json()[0]["jobId"] == job_id
    assert history.json()[0]["status"] == "edited"

    usage = client.get(
        f"/documents/{document_id}/ai-usage",
        headers=auth_headers(owner["accessToken"]),
    )
    assert usage.status_code == 200
    assert usage.json()["usedToday"] == 1
    assert usage.json()["remainingToday"] == 4
    assert usage.json()["canUseAi"] is True

    cancel = client.post(f"/ai/jobs/{job_id}/cancel", headers=auth_headers(owner["accessToken"]))
    assert cancel.status_code == 200
    assert cancel.json()["cancelled"] is False


def test_stub_translate_stream_returns_actual_language_output_for_common_phrase(tmp_path: Path):
    client = create_client(tmp_path)
    owner = register_and_login(client, "user_translate")

    create_document = client.post(
        "/documents",
        headers=auth_headers(owner["accessToken"]),
        json={"title": "Translate Doc", "content": "project brief for testing"},
    )
    document_id = create_document.json()["documentId"]

    stream = client.post(
        "/ai/translate/stream",
        headers=auth_headers(owner["accessToken"]),
        json={
            "documentId": document_id,
            "selection": {"start": 0, "end": 25},
            "selectedText": "project brief for testing",
            "contextBefore": "",
            "contextAfter": "",
            "targetLanguage": "Chinese",
            "instruction": "Use natural Chinese",
            "baseVersionId": create_document.json()["currentVersionId"],
        },
    )
    assert stream.status_code == 200
    done_payload = json.loads(stream.text.split("event: done\ndata: ", 1)[1].split("\n\n", 1)[0])
    assert done_payload["fullText"] == "测试用项目简介"
