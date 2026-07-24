import argparse
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = REPO_ROOT / "backend"
sys.path.insert(0, str(BACKEND_ROOT))

from libs.repositories.firestore_adapter import FirestoreDocumentStore
from libs.repositories.seed import seed_demo_repository
from libs.repositories.store import InMemoryDocumentStore, KnotRepository


def main() -> int:
    parser = argparse.ArgumentParser(description="Run KNOT Firestore repository smoke checks.")
    parser.add_argument("--target", choices=["memory", "firestore"], default="memory")
    parser.add_argument("--project", help="GCP project ID for Firestore target.")
    args = parser.parse_args()

    repository = _repository(args.target, args.project)
    seed_demo_repository(repository)
    _assert_seed_readback(repository)

    print(f"{args.target} repository smoke passed.")
    print("promotion=promotion-001")
    print("brandAgent=brand-agent-001")
    print("creatorAgents=creator-agent-001,creator-agent-002,creator-agent-003")
    return 0


def _repository(target: str, project: str | None) -> KnotRepository:
    if target == "firestore":
        return KnotRepository(FirestoreDocumentStore(_firestore_client(project)))
    return KnotRepository(InMemoryDocumentStore())


def _firestore_client(project: str | None) -> object:
    try:
        from google.cloud import firestore
    except ImportError as exc:
        raise SystemExit(
            "google-cloud-firestore is not installed. Run backend dependency install first."
        ) from exc
    return firestore.Client(project=project)


def _assert_seed_readback(repository: KnotRepository) -> None:
    promotion = repository.get_promotion("promotion-001")
    if promotion is None:
        raise SystemExit("promotion-001 was not found after seed.")
    if promotion.brand_agent_id != "brand-agent-001":
        raise SystemExit("promotion-001 has unexpected brandAgentId.")

    creators = repository.list_creator_profiles()
    if [creator.creator_agent_id for creator in creators] != [
        "creator-agent-001",
        "creator-agent-002",
        "creator-agent-003",
    ]:
        raise SystemExit("creator profile seed order/readback is unexpected.")

    if repository.get_agent_policy("creator-agent-001") is None:
        raise SystemExit("creator-agent-001 policy was not found after seed.")


if __name__ == "__main__":
    raise SystemExit(main())
