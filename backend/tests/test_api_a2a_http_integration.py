import socket
import threading
import time

import httpx
import uvicorn
from fastapi.testclient import TestClient

from apps.api.main import create_app as create_api_app
from apps.creator_agent.main import create_app as create_creator_app
from libs.a2a.store import InMemoryA2ATaskStore
from libs.agents.demo_context import demo_creator_contexts
from libs.repositories.seed import seed_demo_repository
from libs.repositories.store import InMemoryDocumentStore, KnotRepository
from libs.settings.config import Settings


def test_product_api_runs_real_http_a2a_counter_accept_golden_path() -> None:
    port = _free_port()
    base_url = f"http://127.0.0.1:{port}/a2a/v1"
    token = "test-a2a-token"

    contexts = demo_creator_contexts()
    selected_context = contexts["creator-agent-003"]
    selected_context = selected_context.model_copy(
        update={"policy": selected_context.policy.model_copy(update={"min_base_usdc": 650})}
    )
    contexts["creator-agent-003"] = selected_context

    creator_app = create_creator_app(
        settings=Settings(
            service_name="knot-creator-agent",
            creator_agent_base_url=base_url,
            a2a_service_token=token,
        ),
        task_store=InMemoryA2ATaskStore(contexts),
    )
    server = uvicorn.Server(
        uvicorn.Config(
            creator_app,
            host="127.0.0.1",
            port=port,
            log_level="warning",
        )
    )
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()

    try:
        _wait_for_health(f"http://127.0.0.1:{port}/healthz")
        store = InMemoryDocumentStore()
        repository = KnotRepository(store)
        seed_demo_repository(repository)
        api_client = TestClient(
            create_api_app(
                settings=Settings(
                    creator_a2a_mode="http",
                    creator_agent_base_url=base_url,
                    creator_a2a_timeout_seconds=5,
                    a2a_service_token=token,
                ),
                repository=repository,
            )
        )

        match_run = api_client.post("/api/v1/promotions/promotion-001/matches:run").json()[
            "data"
        ]["matchRun"]
        response = api_client.post(
            f"/api/v1/match-runs/{match_run['matchRunId']}:start-negotiation"
        )

        assert response.status_code == 201, response.text
        body = response.json()["data"]
        negotiation = body["negotiation"]
        agreement = body["agreement"]
        assert negotiation["status"] == "AGREED"
        assert negotiation["contextId"].startswith("context-")
        assert negotiation["taskId"].startswith("task-")
        assert negotiation["currentRound"] == 2
        assert negotiation["creatorPolicySnapshot"] == {"redacted": True}
        assert agreement["agreementId"].startswith("agreement-")
        assert agreement["terms"]["compensation"]["baseAmountUsdc"] == 650

        messages = api_client.get(
            f"/api/v1/negotiations/{negotiation['negotiationId']}/messages"
        ).json()["data"]["messages"]
        assert [message["payload"]["type"] for message in messages] == [
            "OFFER",
            "COUNTER",
            "ACCEPT",
            "ACCEPT",
        ]

        events = api_client.get("/api/v1/promotions/promotion-001/timeline").json()["data"][
            "events"
        ]
        event_types = [event["type"] for event in events]
        assert "A2A_AGENT_CARD_DISCOVERED" in event_types
        assert "A2A_COUNTER_RECEIVED" in event_types
        assert "A2A_ACCEPT_SENT" in event_types
        assert "AGREEMENT_CREATED" in event_types
    finally:
        server.should_exit = True
        thread.join(timeout=5)


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def _wait_for_health(url: str) -> None:
    deadline = time.monotonic() + 5
    last_error: Exception | None = None
    while time.monotonic() < deadline:
        try:
            response = httpx.get(url, timeout=0.2)
            if response.status_code == 200:
                return
        except httpx.HTTPError as exc:
            last_error = exc
        time.sleep(0.05)
    raise AssertionError(f"Creator A2A server did not become ready: {last_error}")
