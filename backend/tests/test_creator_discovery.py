import importlib.util
from pathlib import Path

from libs.repositories.firestore_paths import FirestorePaths
from libs.repositories.seed import seed_demo_repository
from libs.repositories.store import InMemoryDocumentStore, KnotRepository

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

    dry_run = backfill_module.backfill_creator_discovery_profiles(
        repository,
        updated_at="2026-07-31T00:00:00+00:00",
    )
    assert dry_run == {"scanned": 5, "changed": 2, "missingAgents": 0}
    assert (
        repository.get_raw_document(FirestorePaths.creator_discovery_profile("creator-1"))
        is None
    )

    written = backfill_module.backfill_creator_discovery_profiles(
        repository,
        write=True,
        updated_at="2026-07-31T00:00:00+00:00",
    )
    assert written == {"scanned": 5, "changed": 2, "missingAgents": 0}
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
    assert repeated == {"scanned": 5, "changed": 0, "missingAgents": 0}
