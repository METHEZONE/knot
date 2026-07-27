import argparse
import os
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
    parser.add_argument(
        "--project",
        default=_default_project_id(),
        help="GCP project ID for Firestore target. Defaults to GOOGLE_CLOUD_PROJECT or GCP_PROJECT_ID.",
    )
    parser.add_argument("--confirm", default="", help="Required confirmation string for Firestore demo seed.")
    args = parser.parse_args()

    if args.target == "firestore":
        _assert_safe_demo_seed(args.project, args.confirm)
        store = _firestore_store(args.project)
        seed_demo_repository(KnotRepository(store), include_business_flow=True)
        print("Seeded demo Firestore documents for namespace knot-demo-v1.")
        return 0

    memory_store = InMemoryDocumentStore()
    seed_demo_repository(KnotRepository(memory_store), include_business_flow=True)
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


def _default_project_id() -> str | None:
    return os.getenv("GOOGLE_CLOUD_PROJECT") or os.getenv("GCP_PROJECT_ID")


def _assert_safe_demo_seed(project: str | None, confirm: str) -> None:
    demo_project = os.getenv("DEMO_PROJECT_ID", "knot-dev-503505")
    if os.getenv("NODE_ENV") == "production":
        raise SystemExit("Refusing to seed demo data when NODE_ENV=production.")
    if os.getenv("ALLOW_DEMO_DATA_RESET") != "true":
        raise SystemExit("Set ALLOW_DEMO_DATA_RESET=true to seed Firestore demo data.")
    if not project or project != demo_project:
        raise SystemExit("Firestore demo seed requires project to match DEMO_PROJECT_ID.")
    if project in {"knot-prod", "production", "prod"}:
        raise SystemExit("Refusing to seed a production-looking project.")
    if confirm != "RESET_KNOT_DEMO_DATA":
        raise SystemExit("Pass --confirm=RESET_KNOT_DEMO_DATA to seed Firestore demo data.")


if __name__ == "__main__":
    raise SystemExit(main())
