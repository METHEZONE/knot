from copy import deepcopy

from fastapi.testclient import TestClient

from apps.creator_agent.main import create_app
from libs.a2a.store import InMemoryA2ATaskStore
from libs.agents.demo_context import demo_creator_contexts
from libs.settings.config import Settings
from tests.test_domain_models import promotion_payload, terms_payload


def a2a_request(
    *,
    tenant: str = "creator-agent-001",
    message_id: str = "message-001",
    context_id: str = "context-001",
    task_id: str | None = None,
    base_amount_usdc: int = 500,
    category: str = "beauty",
    usage_rights: str = "paidBoost30d",
    round_: int = 1,
) -> dict[str, object]:
    promotion = promotion_payload()
    promotion["category"] = category
    terms = terms_payload(base_amount_usdc=base_amount_usdc)
    terms["usageRights"] = usage_rights
    message: dict[str, object] = {
        "messageId": message_id,
        "contextId": context_id,
        "role": "ROLE_USER",
        "parts": [
            {
                "mediaType": "application/json",
                "data": {
                    "schema": "knot.negotiation.v1",
                    "type": "OFFER",
                    "round": round_,
                    "promotion": promotion,
                    "terms": terms,
                    "changedFields": [],
                    "rationale": "Initial promotion offer",
                },
            }
        ],
    }
    if task_id is not None:
        message["taskId"] = task_id
    return {
        "tenant": tenant,
        "message": message,
        "configuration": {"acceptedOutputModes": ["application/json"]},
    }


def headers() -> dict[str, str]:
    return {"A2A-Version": "1.0", "Content-Type": "application/a2a+json"}


def test_creator_agent_returns_counter_for_low_offer() -> None:
    client = TestClient(create_app())
    response = client.post("/a2a/v1/message:send", json=a2a_request(), headers=headers())

    assert response.status_code == 200
    task = response.json()["task"]
    assert task["status"]["state"] == "TASK_STATE_INPUT_REQUIRED"
    data = task["status"]["message"]["parts"][0]["data"]
    assert data["type"] == "COUNTER"
    assert data["terms"]["compensation"]["baseAmountUsdc"] == 650
    assert data["changedFields"] == ["compensation.baseAmountUsdc"]


def test_creator_agent_accepts_valid_offer_with_artifact() -> None:
    client = TestClient(create_app())
    response = client.post(
        "/a2a/v1/message:send",
        json=a2a_request(base_amount_usdc=650),
        headers=headers(),
    )

    assert response.status_code == 200
    task = response.json()["task"]
    assert task["status"]["state"] == "TASK_STATE_COMPLETED"
    artifact_data = task["artifacts"][0]["parts"][0]["data"]
    assert artifact_data["schema"] == "knot.term-sheet.v1"
    assert artifact_data["result"] == "AGREED"
    assert artifact_data["termsHash"].startswith("sha256:")


def test_creator_agent_002_accepts_paid_boost_demo_offer() -> None:
    client = TestClient(create_app())
    response = client.post(
        "/a2a/v1/message:send",
        json=a2a_request(tenant="creator-agent-002", base_amount_usdc=500),
        headers=headers(),
    )

    assert response.status_code == 200
    task = response.json()["task"]
    assert task["status"]["state"] == "TASK_STATE_COMPLETED"
    assert task["status"]["message"]["parts"][0]["data"]["type"] == "ACCEPT"
    assert task["artifacts"][0]["parts"][0]["data"]["result"] == "AGREED"


def test_creator_agent_can_use_non_authoritative_rationale_provider() -> None:
    class GeneratedRationale:
        text = "정책 검사를 통과한 조건이라 Creator Agent가 수락했습니다."
        provider = "vertex-gemini"
        model = "gemini-2.5-flash"
        fallback_reason = None

    task_store = InMemoryA2ATaskStore(
        demo_creator_contexts(),
        rationale_provider=lambda context, payload, decision: GeneratedRationale(),
    )
    client = TestClient(create_app(task_store=task_store))
    response = client.post(
        "/a2a/v1/message:send",
        json=a2a_request(base_amount_usdc=650),
        headers=headers(),
    )

    assert response.status_code == 200
    task = response.json()["task"]
    data = task["status"]["message"]["parts"][0]["data"]
    assert data["type"] == "ACCEPT"
    assert data["rationale"] == GeneratedRationale.text
    assert data["rationaleProvider"] == "vertex-gemini"
    assert data["rationaleModel"] == "gemini-2.5-flash"
    assert data["rationaleFallbackReason"] is None
    assert task["artifacts"][0]["parts"][0]["data"]["rationale"] == GeneratedRationale.text


def test_creator_agent_reuses_duplicate_message_result() -> None:
    client = TestClient(create_app())
    payload = a2a_request()

    first = client.post("/a2a/v1/message:send", json=payload, headers=headers()).json()["task"]
    second = client.post("/a2a/v1/message:send", json=payload, headers=headers()).json()["task"]

    assert second["id"] == first["id"]
    assert len(second["history"]) == 2


def test_creator_agent_escalates_unsupported_rights() -> None:
    client = TestClient(create_app())
    response = client.post(
        "/a2a/v1/message:send",
        json=a2a_request(base_amount_usdc=650, usage_rights="fullLicense90d"),
        headers=headers(),
    )

    assert response.status_code == 200
    task = response.json()["task"]
    assert task["status"]["state"] == "TASK_STATE_INPUT_REQUIRED"
    assert task["status"]["message"]["parts"][0]["data"]["type"] == "ESCALATE"


def test_creator_agent_task_get_list_and_cancel() -> None:
    client = TestClient(create_app())
    task = client.post("/a2a/v1/message:send", json=a2a_request(), headers=headers()).json()["task"]

    listed = client.get("/a2a/v1/tasks").json()["tasks"]
    fetched = client.get(f"/a2a/v1/tasks/{task['id']}").json()["task"]
    canceled = client.post(f"/a2a/v1/tasks/{task['id']}:cancel").json()["task"]

    assert listed[0]["id"] == task["id"]
    assert fetched["id"] == task["id"]
    assert canceled["status"]["state"] == "TASK_STATE_CANCELED"


def test_creator_agent_rejects_new_message_for_terminal_task() -> None:
    client = TestClient(create_app())
    first = client.post(
        "/a2a/v1/message:send",
        json=a2a_request(base_amount_usdc=650),
        headers=headers(),
    ).json()["task"]
    follow_up = deepcopy(
        a2a_request(message_id="message-002", task_id=first["id"], base_amount_usdc=650)
    )

    response = client.post("/a2a/v1/message:send", json=follow_up, headers=headers())

    assert response.status_code == 409
    assert response.json()["detail"] == "terminal tasks do not accept new messages"


def test_creator_agent_requires_a2a_version_header() -> None:
    client = TestClient(create_app())
    response = client.post(
        "/a2a/v1/message:send",
        json=a2a_request(),
        headers={"Content-Type": "application/a2a+json"},
    )

    assert response.status_code == 400


def test_creator_agent_requires_service_auth_when_configured() -> None:
    client = TestClient(create_app(settings=Settings(a2a_service_token="secret")))

    rejected = client.post("/a2a/v1/message:send", json=a2a_request(), headers=headers())
    accepted_headers = {**headers(), "Authorization": "Bearer secret"}
    accepted = client.post(
        "/a2a/v1/message:send",
        json=a2a_request(message_id="message-auth-001"),
        headers=accepted_headers,
    )

    assert rejected.status_code == 401
    assert accepted.status_code == 200


def test_creator_agent_task_reads_require_service_auth_when_configured() -> None:
    client = TestClient(create_app(settings=Settings(a2a_service_token="secret")))

    response = client.get("/a2a/v1/tasks")

    assert response.status_code == 401
