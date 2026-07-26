from fastapi.testclient import TestClient

from apps.api.main import create_app
from libs.repositories.seed import seed_demo_repository
from libs.repositories.store import InMemoryDocumentStore, KnotRepository

CLEAN_EVIDENCE_URL = "https://social.example/post/with-brand-and-ad"


def seeded() -> tuple[TestClient, KnotRepository]:
    store = InMemoryDocumentStore()
    repository = KnotRepository(store)
    seed_demo_repository(repository)
    return TestClient(create_app(repository=repository)), repository


def accepted_agreement(client: TestClient) -> dict[str, object]:
    match_run = client.post("/api/v1/promotions/promotion-001/matches:run").json()["data"][
        "matchRun"
    ]
    return client.post(f"/api/v1/match-runs/{match_run['matchRunId']}:start-negotiation").json()[
        "data"
    ]["agreement"]


def pass_evidence(client: TestClient, agreement: dict[str, object], milestone_id: str) -> None:
    evidence = client.post(
        f"/api/v1/agreements/{agreement['agreementId']}/evidence",
        json={
            "url": CLEAN_EVIDENCE_URL,
            "submittedByAgentId": agreement["creatorAgentId"],
            "milestoneId": milestone_id,
        },
    ).json()["data"]["evidence"]
    verify = client.post(f"/api/v1/evidence/{evidence['evidenceId']}:verify")
    assert verify.status_code == 200


def lock(client: TestClient, agreement: dict[str, object], key: str) -> dict[str, object]:
    response = client.post(
        f"/api/v1/agreements/{agreement['agreementId']}/escrow:lock",
        headers={"Idempotency-Key": key},
    )
    assert response.status_code == 200, response.text
    return response.json()["data"]


def timeline_types(client: TestClient) -> list[str]:
    events = client.get("/api/v1/promotions/promotion-001/timeline").json()["data"]["events"]
    return [event["type"] for event in events]


def test_lock_creates_escrow_with_simulated_receipt_and_no_fee() -> None:
    client, _ = seeded()
    agreement = accepted_agreement(client)

    empty_response = client.get(f"/api/v1/agreements/{agreement['agreementId']}/escrow")
    assert empty_response.status_code == 200
    assert empty_response.json()["data"] == {"escrow": None, "settlements": []}

    data = lock(client, agreement, "lock-1")
    escrow = data["escrow"]
    assert escrow["status"] == "LOCKED"
    assert escrow["platformFeeBps"] == 0
    assert escrow["network"] == "solanaDevnet"
    assert escrow["releasedAmountBaseUnits"] == "0"
    assert int(escrow["lockedAmountBaseUnits"]) > 0
    assert escrow["termsHash"] == agreement["termsHash"]
    assert data["receipt"]["status"] == "SIMULATED"
    assert data["receipt"]["signature"] is None
    assert timeline_types(client).count("ESCROW_LOCKED") == 1

    escrow_response = client.get(f"/api/v1/agreements/{agreement['agreementId']}/escrow")
    assert escrow_response.status_code == 200
    assert escrow_response.json()["data"]["escrow"]["escrowId"] == escrow["escrowId"]
    assert escrow_response.json()["data"]["settlements"] == []


def test_lock_requires_idempotency_key() -> None:
    client, _ = seeded()
    agreement = accepted_agreement(client)
    response = client.post(f"/api/v1/agreements/{agreement['agreementId']}/escrow:lock")
    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "VALIDATION_ERROR"


def test_lock_is_idempotent_on_repeated_key() -> None:
    client, _ = seeded()
    agreement = accepted_agreement(client)
    first = lock(client, agreement, "same-key")
    second = lock(client, agreement, "same-key")
    assert first["escrow"]["escrowId"] == second["escrow"]["escrowId"]
    assert timeline_types(client).count("ESCROW_LOCKED") == 1


def test_lock_conflicts_when_already_locked_with_different_key() -> None:
    client, _ = seeded()
    agreement = accepted_agreement(client)
    lock(client, agreement, "key-1")
    response = client.post(
        f"/api/v1/agreements/{agreement['agreementId']}/escrow:lock",
        headers={"Idempotency-Key": "key-2"},
    )
    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "ESCROW_ALREADY_LOCKED"


def test_lock_blocked_when_auto_escrow_disabled() -> None:
    client, repository = seeded()
    promotion = repository.get_promotion("promotion-001")
    assert promotion is not None
    repository.save_promotion(
        promotion.model_copy(
            update={"autonomy": promotion.autonomy.model_copy(update={"auto_escrow": False})}
        )
    )
    agreement = accepted_agreement(client)
    response = client.post(
        f"/api/v1/agreements/{agreement['agreementId']}/escrow:lock",
        headers={"Idempotency-Key": "k"},
    )
    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "POLICY_VIOLATION"


def test_release_after_evidence_pass_settles_and_keeps_escrow_locked() -> None:
    client, _ = seeded()
    agreement = accepted_agreement(client)
    pass_evidence(client, agreement, "content")
    escrow = lock(client, agreement, "lk")["escrow"]

    response = client.post(
        f"/api/v1/escrows/{escrow['escrowId']}/milestones/content:release",
        headers={"Idempotency-Key": "rel-content"},
    )
    assert response.status_code == 200, response.text
    data = response.json()["data"]
    assert data["settlement"]["milestoneId"] == "content"
    assert data["settlement"]["status"] == "SIMULATED"
    assert data["escrow"]["status"] == "LOCKED"  # only 70% released, 30% remains
    assert data["escrow"]["releasedAmountBaseUnits"] == escrow["milestoneAmounts"]["content"]
    assert data["receipt"]["signature"] is None

    receipt_id = data["receipt"]["receiptId"]
    assert client.get(f"/api/v1/transaction-receipts/{receipt_id}").status_code == 200
    assert "MILESTONE_RELEASED" in timeline_types(client)


def test_release_blocked_without_passing_evidence() -> None:
    client, _ = seeded()
    agreement = accepted_agreement(client)
    escrow = lock(client, agreement, "lk")["escrow"]
    response = client.post(
        f"/api/v1/escrows/{escrow['escrowId']}/milestones/contract:release",
        headers={"Idempotency-Key": "rel-contract"},
    )
    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "POLICY_VIOLATION"


def test_release_blocked_when_auto_release_disabled() -> None:
    client, repository = seeded()
    promotion = repository.get_promotion("promotion-001")
    assert promotion is not None
    repository.save_promotion(
        promotion.model_copy(
            update={"autonomy": promotion.autonomy.model_copy(update={"auto_release": False})}
        )
    )
    agreement = accepted_agreement(client)
    pass_evidence(client, agreement, "content")
    escrow = lock(client, agreement, "lk")["escrow"]
    response = client.post(
        f"/api/v1/escrows/{escrow['escrowId']}/milestones/content:release",
        headers={"Idempotency-Key": "rel"},
    )
    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "POLICY_VIOLATION"


def test_releasing_all_milestones_completes_escrow() -> None:
    client, _ = seeded()
    agreement = accepted_agreement(client)
    pass_evidence(client, agreement, "content")
    pass_evidence(client, agreement, "contract")
    escrow = lock(client, agreement, "lk")["escrow"]

    client.post(
        f"/api/v1/escrows/{escrow['escrowId']}/milestones/content:release",
        headers={"Idempotency-Key": "rel-content"},
    )
    final = client.post(
        f"/api/v1/escrows/{escrow['escrowId']}/milestones/contract:release",
        headers={"Idempotency-Key": "rel-contract"},
    ).json()["data"]
    assert final["escrow"]["status"] == "COMPLETED"
    assert final["escrow"]["releasedAmountBaseUnits"] == escrow["lockedAmountBaseUnits"]


def test_release_is_idempotent_on_repeated_key() -> None:
    client, _ = seeded()
    agreement = accepted_agreement(client)
    pass_evidence(client, agreement, "content")
    escrow = lock(client, agreement, "lk")["escrow"]
    path = f"/api/v1/escrows/{escrow['escrowId']}/milestones/content:release"
    first = client.post(path, headers={"Idempotency-Key": "rc"}).json()["data"]
    second = client.post(path, headers={"Idempotency-Key": "rc"}).json()["data"]
    assert first["settlement"]["settlementId"] == second["settlement"]["settlementId"]
