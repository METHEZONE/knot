from fastapi.testclient import TestClient

from apps.api.main import create_app
from libs.repositories.seed import seed_demo_repository
from libs.repositories.store import InMemoryDocumentStore, KnotRepository


def client_with_seed() -> TestClient:
    store = InMemoryDocumentStore()
    repository = KnotRepository(store)
    seed_demo_repository(repository)
    return TestClient(create_app(repository=repository))


def test_list_and_get_seeded_promotions() -> None:
    client = client_with_seed()

    list_response = client.get("/api/v1/promotions")
    assert list_response.status_code == 200
    promotions = list_response.json()["data"]["promotions"]
    assert [promotion["promotionId"] for promotion in promotions] == ["promotion-001"]

    get_response = client.get("/api/v1/promotions/promotion-001")
    assert get_response.status_code == 200
    assert get_response.json()["data"]["promotion"]["title"] == "Summer skincare launch"


def test_create_and_activate_promotion_records_timeline_events() -> None:
    client = client_with_seed()
    payload = {
        "promotionId": "promotion-api-001",
        "title": "Creator capsule launch",
        "objective": "awareness",
        "category": "beauty",
        "targetAudience": ["20s"],
        "budget": {"totalUsdc": 1500, "maxPerCreatorUsdc": 750},
        "deliverables": [{"format": "reel", "count": 1}],
        "postingWindow": {"start": "2026-08-05", "end": "2026-08-10"},
        "usageRights": "paidBoost30d",
        "constraints": {"requiredCategories": ["beauty"], "requiredDisclosures": ["ad"]},
    }

    create_response = client.post("/api/v1/promotions", json=payload)
    assert create_response.status_code == 201
    assert create_response.json()["data"]["promotion"]["status"] == "DRAFT"

    activate_response = client.post("/api/v1/promotions/promotion-api-001:activate")
    assert activate_response.status_code == 200
    assert activate_response.json()["data"]["promotion"]["status"] == "ACTIVE"

    timeline_response = client.get("/api/v1/promotions/promotion-api-001/timeline")
    assert timeline_response.status_code == 200
    assert [event["type"] for event in timeline_response.json()["data"]["events"]] == [
        "PROMOTION_CREATED",
        "PROMOTION_ACTIVATED",
    ]


def test_run_match_persists_run_candidates_and_timeline_event() -> None:
    client = client_with_seed()

    run_response = client.post("/api/v1/promotions/promotion-001/matches:run")
    assert run_response.status_code == 201
    match_run = run_response.json()["data"]["matchRun"]
    assert match_run["status"] == "COMPLETED"
    assert match_run["selectedCreatorAgentId"] == "creator-agent-003"

    candidates_response = client.get(f"/api/v1/match-runs/{match_run['matchRunId']}/candidates")
    assert candidates_response.status_code == 200
    candidates = candidates_response.json()["data"]["candidates"]
    assert candidates[0]["creatorAgentId"] == "creator-agent-003"
    assert candidates[0]["rank"] == 1
    assert candidates[0]["eligible"] is True

    timeline_response = client.get("/api/v1/promotions/promotion-001/timeline")
    event_types = [event["type"] for event in timeline_response.json()["data"]["events"]]
    assert "MATCH_RUN_COMPLETED" in event_types


def test_select_candidate_rejects_ineligible_candidate() -> None:
    client = client_with_seed()
    match_run = client.post("/api/v1/promotions/promotion-001/matches:run").json()["data"][
        "matchRun"
    ]

    response = client.post(
        f"/api/v1/match-runs/{match_run['matchRunId']}/candidates/creator-agent-002:select"
    )

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "POLICY_VIOLATION"


def test_start_negotiation_persists_messages_events_and_agreement() -> None:
    client = client_with_seed()
    match_run = client.post("/api/v1/promotions/promotion-001/matches:run").json()["data"][
        "matchRun"
    ]

    start_response = client.post(f"/api/v1/match-runs/{match_run['matchRunId']}:start-negotiation")

    assert start_response.status_code == 201
    body = start_response.json()["data"]
    negotiation = body["negotiation"]
    agreement = body["agreement"]
    assert negotiation["status"] == "AGREED"
    assert negotiation["creatorAgentId"] == "creator-agent-003"
    assert agreement["status"] == "AGREED"
    assert agreement["termsHash"].startswith("sha256:")
    assert agreement["canonicalTermsJson"].startswith("{")

    negotiation_id = negotiation["negotiationId"]
    messages_response = client.get(f"/api/v1/negotiations/{negotiation_id}/messages")
    assert messages_response.status_code == 200
    messages = messages_response.json()["data"]["messages"]
    assert [message["role"] for message in messages] == ["ROLE_USER", "ROLE_AGENT"]

    events_response = client.get(f"/api/v1/negotiations/{negotiation_id}/events")
    assert events_response.status_code == 200
    assert events_response.json()["data"]["events"][0]["type"] == "NEGOTIATION_ACCEPT"

    agreement_response = client.get(f"/api/v1/agreements/{agreement['agreementId']}")
    assert agreement_response.status_code == 200
    assert agreement_response.json()["data"]["agreement"]["agreementId"] == agreement["agreementId"]
