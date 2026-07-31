import argparse
import os
import sys
from datetime import UTC, datetime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = REPO_ROOT / "backend"
sys.path.insert(0, str(BACKEND_ROOT))

from libs.domain.discovery import build_creator_discovery_projection
from libs.repositories.firestore_adapter import FirestoreDocumentStore
from libs.repositories.firestore_paths import FirestorePaths
from libs.repositories.store import KnotRepository


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Backfill creatorDiscoveryProfiles from confirmed Creator profiles."
    )
    parser.add_argument("--project", default=_default_project_id())
    parser.add_argument(
        "--write",
        action="store_true",
        help="Persist changes. Defaults to dry-run.",
    )
    args = parser.parse_args()

    repository = KnotRepository(FirestoreDocumentStore(_firestore_client(args.project)))
    summary = backfill_creator_discovery_profiles(repository, write=args.write)
    mode = "write" if args.write else "dry-run"
    print(
        f"{mode} complete: scanned={summary['scanned']} "
        f"changed={summary['changed']} missingAgents={summary['missingAgents']}"
    )
    return 0


def backfill_creator_discovery_profiles(
    repository: KnotRepository,
    *,
    write: bool = False,
    updated_at: str | None = None,
) -> dict[str, int]:
    timestamp = updated_at or datetime.now(UTC).isoformat()
    scanned = 0
    changed = 0
    missing_agents = 0

    for creator in repository.list_creator_profiles():
        scanned += 1
        agent = repository.get_raw_document(FirestorePaths.agent(creator.creator_agent_id))
        if agent is None:
            missing_agents += 1
            continue

        path = FirestorePaths.creator_discovery_profile(creator.creator_id)
        existing = repository.get_raw_document(path)
        projection = build_creator_discovery_projection(
            creator,
            agent,
            updated_at=str(existing.get("updatedAt") if existing else timestamp),
        )
        if existing == projection:
            continue
        changed += 1
        if write:
            repository.save_raw_document(path, projection)

    return {"scanned": scanned, "changed": changed, "missingAgents": missing_agents}


def _firestore_client(project: str | None) -> object:
    try:
        from google.cloud import firestore
    except ImportError as exc:
        raise SystemExit(
            "google-cloud-firestore is not installed. Run backend dependency install first."
        ) from exc
    return firestore.Client(project=project)


def _default_project_id() -> str | None:
    return os.getenv("GOOGLE_CLOUD_PROJECT") or os.getenv("GCP_PROJECT_ID")


if __name__ == "__main__":
    raise SystemExit(main())
