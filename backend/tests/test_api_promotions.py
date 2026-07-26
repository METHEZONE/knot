from fastapi.testclient import TestClient

from apps.api.main import create_app
from libs.domain.hashing import terms_hash
from libs.domain.models import AgreementTerms
from libs.repositories.firestore_paths import COLLECTIONS
from libs.repositories.seed import seed_demo_repository
from libs.repositories.store import InMemoryDocumentStore, KnotRepository
from libs.settings.config import Settings


class FakeHttpResponse:
    def __init__(self, payload: dict[str, object]) -> None:
        self._payload = payload

    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict[str, object]:
        return self._payload


def client_with_seed(settings: Settings | None = None) -> TestClient:
    store = InMemoryDocumentStore()
    repository = KnotRepository(store)
    seed_demo_repository(repository)
    return TestClient(create_app(settings=settings, repository=repository))


def client_and_repository_with_seed(
    settings: Settings | None = None,
) -> tuple[TestClient, KnotRepository]:
    store = InMemoryDocumentStore()
    repository = KnotRepository(store)
    seed_demo_repository(repository)
    return TestClient(create_app(settings=settings, repository=repository)), repository


def accepted_agreement(client: TestClient) -> dict[str, object]:
    match_run = client.post("/api/v1/promotions/promotion-001/matches:run").json()["data"][
        "matchRun"
    ]
    return client.post(f"/api/v1/match-runs/{match_run['matchRunId']}:start-negotiation").json()[
        "data"
    ]["agreement"]


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
    assert candidates[0]["creatorId"] == "creator-003"
    assert candidates[0]["creatorProfilePath"] == "creatorProfiles/creator-003"
    assert candidates[0]["rank"] == 1
    assert candidates[0]["eligible"] is True
    assert candidates[0]["analysisProvider"] == "deterministic"
    assert candidates[0]["analysisModel"] is None
    assert candidates[0]["analysisFallbackReason"] == "gemini_mode_off"

    timeline_response = client.get("/api/v1/promotions/promotion-001/timeline")
    event_types = [event["type"] for event in timeline_response.json()["data"]["events"]]
    assert "MATCH_RUN_COMPLETED" in event_types


def test_run_match_normalizes_korean_category_aliases() -> None:
    client = client_with_seed()
    payload = {
        "promotionId": "promotion-korean-beauty",
        "title": "Korean skincare launch",
        "objective": "awareness",
        "category": "스킨케어",
        "targetAudience": ["20s"],
        "budget": {"totalUsdc": 1500, "maxPerCreatorUsdc": 800},
        "deliverables": [{"format": "reel", "count": 1}],
        "postingWindow": {"start": "2026-08-05", "end": "2026-08-10"},
        "usageRights": "paidBoost30d",
        "constraints": {"requiredCategories": ["뷰티"], "requiredDisclosures": ["ad"]},
    }
    assert client.post("/api/v1/promotions", json=payload).status_code == 201

    run_response = client.post("/api/v1/promotions/promotion-korean-beauty/matches:run")

    assert run_response.status_code == 201
    match_run = run_response.json()["data"]["matchRun"]
    assert match_run["selectedCreatorAgentId"] == "creator-agent-003"
    start_response = client.post(f"/api/v1/match-runs/{match_run['matchRunId']}:start-negotiation")
    assert start_response.status_code == 201
    assert start_response.json()["data"]["negotiation"]["status"] == "AGREED"


def test_start_negotiation_reports_no_eligible_creator() -> None:
    client = client_with_seed()
    payload = {
        "promotionId": "promotion-no-eligible",
        "title": "Restricted Promotion",
        "objective": "awareness",
        "category": "도박",
        "targetAudience": ["20s"],
        "budget": {"totalUsdc": 100, "maxPerCreatorUsdc": 100},
        "deliverables": [{"format": "reel", "count": 1}],
        "postingWindow": {"start": "2026-08-05", "end": "2026-08-10"},
        "usageRights": "paidBoost30d",
        "constraints": {"requiredCategories": ["도박"], "requiredDisclosures": ["ad"]},
    }
    assert client.post("/api/v1/promotions", json=payload).status_code == 201
    match_run = client.post("/api/v1/promotions/promotion-no-eligible/matches:run").json()[
        "data"
    ]["matchRun"]

    response = client.post(f"/api/v1/match-runs/{match_run['matchRunId']}:start-negotiation")

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "NO_ELIGIBLE_CREATOR"


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
    assert negotiation["matchRunId"] == match_run["matchRunId"]
    assert negotiation["matchCandidateId"] == "creator-003"
    assert negotiation["creatorAgentId"] == "creator-agent-003"
    assert agreement["status"] == "AGREED"
    assert agreement["artifactId"].startswith("artifact-")
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

    negotiation_agreement_response = client.get(
        f"/api/v1/negotiations/{negotiation_id}/agreement"
    )
    assert negotiation_agreement_response.status_code == 200
    assert (
        negotiation_agreement_response.json()["data"]["agreement"]["agreementId"]
        == agreement["agreementId"]
    )


def test_start_negotiation_uses_creator_a2a_http_when_configured(monkeypatch) -> None:
    captured: dict[str, object] = {}

    class FakeHttpClient:
        def __init__(self, *args: object, **kwargs: object) -> None:
            return None

        def __enter__(self) -> "FakeHttpClient":
            return self

        def __exit__(self, *args: object) -> None:
            return None

        def post(
            self,
            url: str,
            *,
            headers: dict[str, str],
            json: dict[str, object],
        ) -> FakeHttpResponse:
            captured["url"] = url
            captured["headers"] = headers
            captured["request"] = json
            message = json["message"]
            assert isinstance(message, dict)
            data = message["parts"][0]["data"]  # type: ignore[index]
            assert isinstance(data, dict)
            terms = data["terms"]
            agreement_terms = AgreementTerms.model_validate(terms)
            decision = {
                "schema": "knot.negotiation.v1",
                "type": "ACCEPT",
                "round": 1,
                "terms": terms,
                "changedFields": [],
                "rationale": "Accepted through Creator A2A HTTP.",
                "policyDecision": {
                    "allowed": True,
                    "ruleVersion": "creator-policy-v1",
                    "violations": [],
                },
                "agreementId": "agreement-http-001",
                "termsHash": terms_hash(agreement_terms),
            }
            response_message = {
                "messageId": "message-http-agent-001",
                "contextId": message["contextId"],
                "taskId": "task-http-001",
                "role": "ROLE_AGENT",
                "parts": [{"mediaType": "application/json", "data": decision}],
            }
            artifact = {
                "artifactId": "artifact-http-001",
                "name": "Negotiation Result",
                "parts": [
                    {
                        "mediaType": "application/json",
                        "data": {
                            "schema": "knot.term-sheet.v1",
                            "result": "AGREED",
                            "agreementId": "agreement-http-001",
                            "terms": terms,
                            "termsHash": decision["termsHash"],
                            "rationale": decision["rationale"],
                        },
                    }
                ],
            }
            return FakeHttpResponse(
                {
                    "task": {
                        "id": "task-http-001",
                        "contextId": message["contextId"],
                        "status": {"state": "TASK_STATE_COMPLETED", "message": response_message},
                        "artifacts": [artifact],
                        "history": [message, response_message],
                    }
                }
            )

    monkeypatch.setattr("libs.a2a.client.httpx.Client", FakeHttpClient)
    client = client_with_seed(
        Settings(
            creator_a2a_mode="http",
            creator_agent_base_url="http://creator-agent.test/a2a/v1",
        )
    )
    match_run = client.post("/api/v1/promotions/promotion-001/matches:run").json()["data"][
        "matchRun"
    ]

    response = client.post(f"/api/v1/match-runs/{match_run['matchRunId']}:start-negotiation")

    assert response.status_code == 201, response.text
    body = response.json()["data"]
    assert captured["url"] == "http://creator-agent.test/a2a/v1/message:send"
    assert captured["headers"] == {
        "A2A-Version": "1.0",
        "Content-Type": "application/a2a+json",
    }
    assert captured["request"]["tenant"] == "creator-agent-003"  # type: ignore[index]
    assert body["negotiation"]["taskId"] == "task-http-001"
    assert body["agreement"]["agreementId"] == "agreement-http-001"
    messages = client.get(
        f"/api/v1/negotiations/{body['negotiation']['negotiationId']}/messages"
    ).json()["data"]["messages"]
    assert [message["role"] for message in messages] == ["ROLE_USER", "ROLE_AGENT"]


def test_start_negotiation_http_failure_does_not_create_fake_agreement(monkeypatch) -> None:
    class BrokenHttpClient:
        def __init__(self, *args: object, **kwargs: object) -> None:
            return None

        def __enter__(self) -> "BrokenHttpClient":
            return self

        def __exit__(self, *args: object) -> None:
            return None

        def post(self, *args: object, **kwargs: object) -> object:
            import httpx

            raise httpx.ConnectError("creator unavailable")

    monkeypatch.setattr("libs.a2a.client.httpx.Client", BrokenHttpClient)
    client, repository = client_and_repository_with_seed(
        Settings(creator_a2a_mode="http", creator_agent_base_url="http://creator-agent.test/a2a/v1")
    )
    match_run = client.post("/api/v1/promotions/promotion-001/matches:run").json()["data"][
        "matchRun"
    ]

    response = client.post(f"/api/v1/match-runs/{match_run['matchRunId']}:start-negotiation")

    assert response.status_code == 502
    assert response.json()["detail"]["code"] == "A2A_CREATOR_AGENT_UNAVAILABLE"
    assert repository.list_raw_documents(COLLECTIONS.agreements) == []


def test_start_negotiation_counter_a2a_task_does_not_materialize_agreement(monkeypatch) -> None:
    class CounterHttpClient:
        def __init__(self, *args: object, **kwargs: object) -> None:
            return None

        def __enter__(self) -> "CounterHttpClient":
            return self

        def __exit__(self, *args: object) -> None:
            return None

        def post(
            self,
            url: str,
            *,
            headers: dict[str, str],
            json: dict[str, object],
        ) -> object:
            message = json["message"]
            assert isinstance(message, dict)
            data = message["parts"][0]["data"]  # type: ignore[index]
            assert isinstance(data, dict)
            decision = {
                "schema": "knot.negotiation.v1",
                "type": "COUNTER",
                "round": 1,
                "terms": data["terms"],
                "changedFields": ["compensation.baseAmountUsdc"],
                "rationale": "Counter through Creator A2A HTTP.",
                "policyDecision": {
                    "allowed": False,
                    "ruleVersion": "creator-policy-v1",
                    "violations": [
                        {
                            "code": "CREATOR_MIN_BASE_NOT_MET",
                            "field": "terms.compensation.baseAmountUsdc",
                            "message": "below minimum",
                        }
                    ],
                },
            }
            response_message = {
                "messageId": "message-http-agent-counter",
                "contextId": message["contextId"],
                "taskId": "task-http-counter",
                "role": "ROLE_AGENT",
                "parts": [{"mediaType": "application/json", "data": decision}],
            }
            return FakeHttpResponse(
                {
                    "task": {
                        "id": "task-http-counter",
                        "contextId": message["contextId"],
                        "status": {
                            "state": "TASK_STATE_INPUT_REQUIRED",
                            "message": response_message,
                        },
                        "artifacts": [],
                        "history": [message, response_message],
                    }
                }
            )

    monkeypatch.setattr("libs.a2a.client.httpx.Client", CounterHttpClient)
    client, repository = client_and_repository_with_seed(
        Settings(creator_a2a_mode="http", creator_agent_base_url="http://creator-agent.test/a2a/v1")
    )
    match_run = client.post("/api/v1/promotions/promotion-001/matches:run").json()["data"][
        "matchRun"
    ]

    response = client.post(f"/api/v1/match-runs/{match_run['matchRunId']}:start-negotiation")

    assert response.status_code == 201, response.text
    body = response.json()["data"]
    assert body["negotiation"]["status"] == "COUNTERED"
    assert body["agreement"] is None
    assert repository.list_raw_documents(COLLECTIONS.agreements) == []


def test_submit_and_verify_evidence_persists_policy_result_and_timeline_event() -> None:
    client = client_with_seed()
    agreement = accepted_agreement(client)

    submit_response = client.post(
        f"/api/v1/agreements/{agreement['agreementId']}/evidence",
        json={
            "url": "https://social.example/post/with-brand-and-ad",
            "submittedByAgentId": agreement["creatorAgentId"],
            "milestoneId": "content",
        },
    )
    assert submit_response.status_code == 201
    evidence = submit_response.json()["data"]["evidence"]
    assert evidence["status"] == "SUBMITTED"
    assert evidence["milestoneId"] == "content"
    assert evidence["milestoneSnapshot"]["releasePct"] == 70

    verify_response = client.post(f"/api/v1/evidence/{evidence['evidenceId']}:verify")
    assert verify_response.status_code == 200
    verified = verify_response.json()["data"]["evidence"]
    assert verified["status"] == "PASSED"
    assert verified["policyDecision"]["allowed"] is True
    assert verified["policyDecision"]["ruleVersion"] == "verification-v1"

    get_response = client.get(f"/api/v1/evidence/{evidence['evidenceId']}")
    assert get_response.status_code == 200
    assert get_response.json()["data"]["evidence"]["status"] == "PASSED"

    timeline_response = client.get("/api/v1/promotions/promotion-001/timeline")
    event_types = [event["type"] for event in timeline_response.json()["data"]["events"]]
    assert "EVIDENCE_SUBMITTED" in event_types
    assert "EVIDENCE_VERIFIED" in event_types


def test_verify_evidence_failure_is_persisted_and_returns_problem() -> None:
    client = client_with_seed()
    agreement = accepted_agreement(client)
    evidence = client.post(
        f"/api/v1/agreements/{agreement['agreementId']}/evidence",
        json={
            "url": "https://social.example/post/missing-disclosure",
            "submittedByAgentId": agreement["creatorAgentId"],
            "milestoneId": "content",
        },
    ).json()["data"]["evidence"]

    response = client.post(f"/api/v1/evidence/{evidence['evidenceId']}:verify")

    assert response.status_code == 409
    detail = response.json()["detail"]
    assert detail["code"] == "EVIDENCE_VERIFICATION_FAILED"
    assert detail["evidence"]["status"] == "FAILED"
    assert detail["evidence"]["policyDecision"]["violations"][0]["code"] == (
        "EVIDENCE_DISCLOSURE_MISSING"
    )

    get_response = client.get(f"/api/v1/evidence/{evidence['evidenceId']}")
    assert get_response.json()["data"]["evidence"]["status"] == "FAILED"


def test_submit_evidence_rejects_wrong_creator_agent() -> None:
    client = client_with_seed()
    agreement = accepted_agreement(client)

    response = client.post(
        f"/api/v1/agreements/{agreement['agreementId']}/evidence",
        json={
            "url": "https://social.example/post/with-brand-and-ad",
            "submittedByAgentId": "creator-agent-001",
        },
    )

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "POLICY_VIOLATION"
