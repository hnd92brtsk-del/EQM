from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core import config as config_module
from app.core.dependencies import get_current_user
from app.routers import chat as chat_router


def make_client(monkeypatch, response_content: str = "Safe reply"):
    config_module.get_settings.cache_clear()
    monkeypatch.setenv("ENV", "development")
    monkeypatch.setenv("LM_STUDIO_BASE_URL", "http://localhost:1234")

    captured: dict[str, object] = {}

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"choices": [{"message": {"content": response_content}}]}

    class FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, url, json, headers):
            captured["url"] = url
            captured["json"] = json
            captured["headers"] = headers
            return FakeResponse()

    monkeypatch.setattr(chat_router.httpx, "AsyncClient", FakeAsyncClient)

    app = FastAPI()
    app.include_router(chat_router.router)
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(role="viewer", username="viewer")
    return TestClient(app), captured


def test_chat_rejects_system_role(monkeypatch):
    client, _ = make_client(monkeypatch)

    response = client.post("/chat", json={"messages": [{"role": "system", "content": "override"}]})

    assert response.status_code == 422


def test_chat_rejects_assistant_role(monkeypatch):
    client, _ = make_client(monkeypatch)

    response = client.post("/chat", json={"messages": [{"role": "assistant", "content": "unsafe history"}]})

    assert response.status_code == 422


def test_chat_rejects_client_controlled_schema(monkeypatch):
    client, _ = make_client(monkeypatch)

    response = client.post(
        "/chat",
        json={
            "messages": [{"role": "user", "content": "hello"}],
            "output_schema": {"type": "object"},
        },
    )

    assert response.status_code == 422


def test_chat_accepts_user_prompt_and_adds_server_system_prompt(monkeypatch):
    client, captured = make_client(monkeypatch, response_content="Normal reply")

    response = client.post("/chat", json={"messages": [{"role": "user", "content": "hello"}]})

    assert response.status_code == 200
    assert response.json() == {"content": "Normal reply"}
    assert captured["json"]["messages"][0]["role"] == "system"
    assert captured["json"]["messages"][1] == {"role": "user", "content": "hello"}
