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
    parser = argparse.ArgumentParser(description="Seed deterministic KNOT demo data.")
    parser.add_argument("--target", choices=["memory", "firestore"], default="memory")
    parser.add_argument("--project", help="GCP project ID for Firestore target.")
    args = parser.parse_args()

    if args.target == "firestore":
        store = _firestore_store(args.project)
        seed_demo_repository(KnotRepository(store))
        print("Seeded demo Firestore documents for namespace knot-demo-v1.")
        return 0

    memory_store = InMemoryDocumentStore()
    seed_demo_repository(KnotRepository(memory_store))
    print(f"Loaded {memory_store.document_count} demo documents into memory.")
    for path in memory_store.paths():
        print(path)
    return 0


def _firestore_store(project: str | None) -> FirestoreDocumentStore:
    try:
        from google.cloud import firestore
    except ImportError as exc:
        raise SystemExit(
            "google-cloud-firestore is not installed. Run backend dependency install first."
        ) from exc
    return FirestoreDocumentStore(firestore.Client(project=project))


if __name__ == "__main__":
    raise SystemExit(main())
