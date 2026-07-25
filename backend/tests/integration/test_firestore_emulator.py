import os
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from apps.api.main import create_app
from libs.repositories.firestore_adapter import FirestoreDocumentStore
from libs.repositories.firestore_paths import FirestorePaths
from libs.repositories.seed import seed_demo_repository
from libs.repositories.store import (
    DocumentAlreadyExistsError,
    IdempotencyConflictError,
    KnotRepository,
)

pytestmark = pytest.mark.skipif(
    not os.getenv("FIRESTORE_EMULATOR_HOST"),
    reason="FIRESTORE_EMULATOR_HOST is not set",
)


def firestore_repository() -> KnotRepository:
    from google.cloud import firestore

    project_id = os.getenv("GOOGLE_CLOUD_PROJECT", "knot-dev-503505")
    return KnotRepository(FirestoreDocumentStore(firestore.Client(project=project_id)))


def test_firestore_emulator_seed_readback() -> None:
    repository = firestore_repository()

    seed_demo_repository(repository)

    promotion = repository.get_promotion("promotion-001")
    assert promotion is not None
    assert promotion.brand_agent_id == "brand-agent-001"
    assert [creator.creator_agent_id for creator in repository.list_creator_profiles()] == [
        "creator-agent-001",
        "creator-agent-002",
        "creator-agent-003",
    ]
    assert repository.get_agent_policy("creator-agent-001") is not None


def test_firestore_emulator_append_only_and_idempotency_guards() -> None:
    repository = firestore_repository()
    event_id = f"event-{uuid4()}"
    idempotency_key = f"test:{uuid4()}"

    repository.create_audit_event(event_id, {"eventId": event_id, "type": "TEST"})
    with pytest.raises(DocumentAlreadyExistsError):
        repository.create_audit_event(event_id, {"eventId": event_id, "type": "CHANGED"})

    assert repository.claim_idempotency_record(
        idempotency_key,
        payload_hash="sha256:first",
        owner_path=FirestorePaths.payment_operation(f"operation-{uuid4()}"),
    )
    assert not repository.claim_idempotency_record(
        idempotency_key,
        payload_hash="sha256:first",
        owner_path=FirestorePaths.payment_operation(f"operation-{uuid4()}"),
    )
    with pytest.raises(IdempotencyConflictError):
        repository.claim_idempotency_record(
            idempotency_key,
            payload_hash="sha256:changed",
            owner_path=FirestorePaths.payment_operation(f"operation-{uuid4()}"),
        )


def test_firestore_emulator_api_flow_persists_documents() -> None:
    repository = firestore_repository()
    seed_demo_repository(repository)
    client = TestClient(create_app(repository=repository))

    match_run = client.post("/api/v1/promotions/promotion-001/matches:run").json()["data"][
        "matchRun"
    ]
    negotiation_response = client.post(
        f"/api/v1/match-runs/{match_run['matchRunId']}:start-negotiation"
    )
    assert negotiation_response.status_code == 201
    agreement = negotiation_response.json()["data"]["agreement"]

    evidence_response = client.post(
        f"/api/v1/agreements/{agreement['agreementId']}/evidence",
        json={
            "url": "https://social.example/post/with-brand-and-ad",
            "submittedByAgentId": agreement["creatorAgentId"],
            "milestoneId": "content",
        },
    )
    assert evidence_response.status_code == 201
    evidence = evidence_response.json()["data"]["evidence"]

    verify_response = client.post(f"/api/v1/evidence/{evidence['evidenceId']}:verify")
    assert verify_response.status_code == 200

    assert repository.get_raw_document(
        FirestorePaths.match_candidate(match_run["matchRunId"], "creator-003")
    )["negotiationId"] == negotiation_response.json()["data"]["negotiation"]["negotiationId"]
    assert repository.get_raw_document(
        FirestorePaths.milestone(agreement["agreementId"], "content")
    )["releasePct"] == 70
    assert repository.get_raw_document(FirestorePaths.evidence(evidence["evidenceId"]))[
        "status"
    ] == "PASSED"
