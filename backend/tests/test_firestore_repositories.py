import pytest

from libs.domain.models import CreatorProfile, Promotion
from libs.repositories import (
    DocumentAlreadyExistsError,
    FirestorePaths,
    IdempotencyConflictError,
    InMemoryDocumentStore,
    KnotRepository,
    document_to_model,
    model_to_document,
)
from libs.repositories.seed import seed_demo_repository


def test_firestore_paths_match_documented_collections() -> None:
    assert FirestorePaths.brand("brand-001") == "brands/brand-001"
    assert FirestorePaths.creator_profile("creator-001") == "creatorProfiles/creator-001"
    assert FirestorePaths.agent("creator-agent-001") == "agents/creator-agent-001"
    assert FirestorePaths.agent_policy("creator-agent-001") == "agentPolicies/creator-agent-001"
    assert FirestorePaths.promotion("promotion-001") == "promotions/promotion-001"
    assert (
        FirestorePaths.promotion_event("promotion-001", "event-001")
        == "promotions/promotion-001/events/event-001"
    )
    assert FirestorePaths.match_candidate("match-001", "creator-001") == (
        "matchRuns/match-001/candidates/creator-001"
    )
    assert FirestorePaths.negotiation_message("negotiation-001", "message-001") == (
        "negotiations/negotiation-001/messages/message-001"
    )
    assert FirestorePaths.a2a_task_artifact("task-001", "artifact-001") == (
        "a2aTasks/task-001/artifacts/artifact-001"
    )
    assert FirestorePaths.milestone("agreement-001", "content") == (
        "agreements/agreement-001/milestones/content"
    )
    assert FirestorePaths.payment_operation("operation-001") == (
        "paymentOperations/operation-001"
    )
    assert FirestorePaths.transaction_receipt("receipt-001") == (
        "transactionReceipts/receipt-001"
    )
    assert FirestorePaths.idempotency_record("lock:escrow-001") == (
        "idempotencyRecords/lock:escrow-001"
    )


def test_path_segments_reject_nested_ids() -> None:
    with pytest.raises(ValueError):
        FirestorePaths.promotion("tenant-a/promotion-001")


def test_model_serialization_round_trips_with_camel_case() -> None:
    store = InMemoryDocumentStore()
    repository = KnotRepository(store)
    seed_demo_repository(repository)

    promotion = repository.get_promotion("promotion-001")
    assert promotion is not None
    document = model_to_document(promotion)

    assert document["promotionId"] == "promotion-001"
    assert "promotion_id" not in document
    assert document["postingWindow"] == {"start": "2026-08-05", "end": "2026-08-10"}

    restored = document_to_model(Promotion, document)
    assert restored == promotion


def test_demo_seed_is_idempotent_and_loads_core_collections() -> None:
    store = InMemoryDocumentStore()
    repository = KnotRepository(store)

    seed_demo_repository(repository)
    first_count = store.document_count
    seed_demo_repository(repository)

    assert store.document_count == first_count
    assert repository.get_promotion("promotion-001") is not None
    assert repository.get_agent_policy("creator-agent-001") is not None
    assert [creator.creator_id for creator in repository.list_creator_profiles()] == [
        "creator-001",
        "creator-002",
        "creator-003",
    ]
    assert "brands/brand-001" in store.paths()
    assert "agents/brand-agent-001" in store.paths()
    assert "users/user-test1" in store.paths()
    assert "users/user-test4" in store.paths()


def test_repository_returns_copies_not_mutable_store_references() -> None:
    store = InMemoryDocumentStore()
    repository = KnotRepository(store)
    seed_demo_repository(repository)

    document = store.get_document("creatorProfiles/creator-001")
    assert document is not None
    document["displayName"] = "Mutated"

    creator = repository.get_creator_profile("creator-001")
    assert isinstance(creator, CreatorProfile)
    assert creator.display_name == "Demo Beauty Creator"


def test_idempotency_record_allows_replay_but_rejects_conflicting_payload() -> None:
    store = InMemoryDocumentStore()
    repository = KnotRepository(store)

    assert repository.claim_idempotency_record(
        "lock:escrow-001",
        payload_hash="sha256:first",
        owner_path=FirestorePaths.escrow("escrow-001"),
    )
    assert not repository.claim_idempotency_record(
        "lock:escrow-001",
        payload_hash="sha256:first",
        owner_path=FirestorePaths.escrow("escrow-001"),
    )
    with pytest.raises(IdempotencyConflictError):
        repository.claim_idempotency_record(
            "lock:escrow-001",
            payload_hash="sha256:changed",
            owner_path=FirestorePaths.escrow("escrow-001"),
        )


def test_audit_events_are_append_only() -> None:
    store = InMemoryDocumentStore()
    repository = KnotRepository(store)

    repository.create_audit_event("event-001", {"eventId": "event-001", "type": "seeded"})

    with pytest.raises(DocumentAlreadyExistsError):
        repository.create_audit_event("event-001", {"eventId": "event-001", "type": "changed"})
