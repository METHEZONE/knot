import importlib.util
from collections.abc import Iterable
from pathlib import Path

from libs.agents.discovery import FirestoreCreatorDiscoveryRepository
from libs.repositories.firestore_paths import COLLECTIONS, FirestorePaths
from libs.repositories.seed import seed_demo_repository
from libs.repositories.store import DocumentQueryFilter, InMemoryDocumentStore, KnotRepository

SCRIPT_PATH = (
    Path(__file__).resolve().parents[2] / "scripts" / "backfill_creator_discovery_profiles.py"
)
SPEC = importlib.util.spec_from_file_location(
    "backfill_creator_discovery_profiles",
    SCRIPT_PATH,
)
assert SPEC is not None
backfill_module = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(backfill_module)


class MissingCompositeIndexStore(InMemoryDocumentStore):
    def query_documents(
        self,
        collection_path: str,
        filters: Iterable[DocumentQueryFilter],
        *,
        limit: int,
    ) -> list[dict[str, object]]:
        if collection_path == COLLECTIONS.creator_discovery_profiles:
            raise RuntimeError("400 The query requires an index.")
        return super().query_documents(collection_path, filters, limit=limit)


def test_creator_discovery_backfill_is_dry_run_then_idempotent_write() -> None:
    repository = KnotRepository(InMemoryDocumentStore())
    seed_demo_repository(repository)
    agent = repository.get_raw_document(FirestorePaths.agent("creator-agent-001"))
    assert agent is not None
    repository.save_raw_document(
        FirestorePaths.agent("creator-agent-001"),
        {
            **agent,
            "publicationStatus": "PUBLISHED",
            "acceptingOffers": True,
            "availability": "AVAILABLE",
            "activeNegotiations": 0,
            "maxConcurrentNegotiations": 1,
            "activeCollaborations": 0,
            "maxActiveCollaborations": 1,
        },
    )
    projection_path = FirestorePaths.creator_discovery_profile("creator-001")
    existing_projection = repository.get_raw_document(projection_path)
    assert existing_projection is not None
    repository.save_raw_document(
        projection_path,
        {
            **existing_projection,
            "agentStatus": "DRAFT",
        },
    )

    dry_run = backfill_module.backfill_creator_discovery_profiles(
        repository,
        updated_at="2026-07-31T00:00:00+00:00",
    )
    assert dry_run == {"scanned": 12, "changed": 1, "missingAgents": 0}
    assert (
        repository.get_raw_document(FirestorePaths.creator_discovery_profile("creator-1"))
        is not None
    )

    written = backfill_module.backfill_creator_discovery_profiles(
        repository,
        write=True,
        updated_at="2026-07-31T00:00:00+00:00",
    )
    assert written == {"scanned": 12, "changed": 1, "missingAgents": 0}
    projection = repository.get_raw_document(
        FirestorePaths.creator_discovery_profile("creator-001")
    )
    assert projection is not None
    assert projection["agentStatus"] == "PUBLISHED"
    assert projection["acceptingOffers"] is True
    assert projection["capacityAvailable"] is True
    assert "minBaseUsdc" not in projection
    assert "blockedIndustries" not in projection

    repeated = backfill_module.backfill_creator_discovery_profiles(
        repository,
        write=True,
        updated_at="2026-07-31T00:00:00+00:00",
    )
    assert repeated == {"scanned": 12, "changed": 0, "missingAgents": 0}


def test_creator_discovery_falls_back_to_real_scan_when_index_is_missing() -> None:
    repository = KnotRepository(MissingCompositeIndexStore())
    seed_demo_repository(repository)
    promotion = repository.get_promotion("promotion-001")
    assert promotion is not None

    result = FirestoreCreatorDiscoveryRepository(repository).search(promotion)

    assert result.projections
    assert result.metrics.query_limit == 100
    assert result.metrics.returned_count == len(result.projections)
    assert all(projection["agentStatus"] == "PUBLISHED" for projection in result.projections)
