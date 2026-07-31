from fastapi.testclient import TestClient

from apps.api.main import create_app as create_api_app
from apps.creator_agent.main import create_app as create_creator_app


def test_api_healthz() -> None:
    client = TestClient(create_api_app())
    response = client.get("/healthz")
    assert response.status_code == 200
    assert response.json()["service"] == "knot-api"


def test_creator_agent_card() -> None:
    client = TestClient(create_creator_app())
    response = client.get("/a2a/v1/.well-known/agent-card.json")
    assert response.status_code == 200
    body = response.json()
    assert body["supportedInterfaces"][0]["protocolVersion"] == "1.0"
    assert "tenant" not in body["supportedInterfaces"][0]
