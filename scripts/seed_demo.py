import argparse
import os
import sys
from pathlib import Path

# ruff: noqa: I001

REPO_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = REPO_ROOT / "backend"
sys.path.insert(0, str(BACKEND_ROOT))

from libs.repositories.firestore_adapter import FirestoreDocumentStore
from libs.repositories.firestore_paths import COLLECTIONS
from libs.repositories.seed import seed_demo_repository
from libs.repositories.store import InMemoryDocumentStore, KnotRepository


DEMO_AUTH_USERS = [
    {
        "uid": "user-brand-1",
        "email": "t1@knot.com",
        "display_name": "루미에르 뷰티 담당자",
    },
    {
        "uid": "user-brand-2",
        "email": "test2@knot.demo",
        "display_name": "바삭데이 담당자",
    },
    {
        "uid": "user-creator-1",
        "email": "c1@knot.com",
        "display_name": "민지의 뷰티룸",
    },
    {
        "uid": "user-creator-2",
        "email": "test4@knot.demo",
        "display_name": "하루한입",
    },
]

RESET_COLLECTIONS = [
    COLLECTIONS.idempotency_records,
    COLLECTIONS.payment_operations,
    COLLECTIONS.transaction_receipts,
    COLLECTIONS.settlements,
    COLLECTIONS.escrows,
    COLLECTIONS.evidence,
    COLLECTIONS.agreements,
    COLLECTIONS.a2a_tasks,
    COLLECTIONS.negotiations,
    COLLECTIONS.match_runs,
    COLLECTIONS.promotions,
    COLLECTIONS.agent_policies,
    COLLECTIONS.agents,
    COLLECTIONS.creator_profiles,
    COLLECTIONS.brands,
    COLLECTIONS.users,
]


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed deterministic KNOT demo data.")
    parser.add_argument("--target", choices=["memory", "firestore"], default="memory")
    parser.add_argument(
        "--project",
        default=_default_project_id(),
        help=(
            "GCP project ID for Firestore target. "
            "Defaults to GOOGLE_CLOUD_PROJECT or GCP_PROJECT_ID."
        ),
    )
    parser.add_argument(
        "--confirm",
        default="",
        help="Required confirmation string for Firestore demo seed.",
    )
    parser.add_argument(
        "--reset-existing",
        action="store_true",
        help="Delete KNOT dev/demo Firestore collections before seeding.",
    )
    parser.add_argument(
        "--create-auth-users",
        action="store_true",
        help="Create or update deterministic Firebase Auth demo users.",
    )
    parser.add_argument(
        "--auth-password",
        default="000000",
        help=(
            "Password for Firebase Auth demo users. "
            "Firebase may reject passwords shorter than 6 chars."
        ),
    )
    args = parser.parse_args()

    if args.target == "firestore":
        _assert_safe_demo_seed(args.project, args.confirm)
        firestore_client = _firestore_client(args.project)
        if args.reset_existing:
            _reset_firestore_demo_data(firestore_client)
        store = FirestoreDocumentStore(firestore_client)
        seed_demo_repository(KnotRepository(store), include_business_flow=True)
        if args.create_auth_users:
            _create_or_update_auth_users(args.project, args.auth_password)
        print("Seeded demo Firestore documents for namespace knot-demo-v1.")
        return 0

    memory_store = InMemoryDocumentStore()
    seed_demo_repository(KnotRepository(memory_store), include_business_flow=True)
    print(f"Loaded {memory_store.document_count} demo documents into memory.")
    for path in memory_store.paths():
        print(path)
    return 0


def _firestore_client(project: str | None):
    try:
        from google.cloud import firestore
    except ImportError as exc:
        raise SystemExit(
            "google-cloud-firestore is not installed. Run backend dependency install first."
        ) from exc
    return firestore.Client(project=project)


def _reset_firestore_demo_data(firestore_client) -> None:
    deleted = 0
    for collection_name in RESET_COLLECTIONS:
        deleted += firestore_client.recursive_delete(firestore_client.collection(collection_name))
    print(f"Deleted {deleted} Firestore documents from KNOT dev/demo collections.")


def _create_or_update_auth_users(project: str | None, password: str) -> None:
    if len(password) < 6:
        raise SystemExit(
            "Firebase Auth requires passwords to be at least 6 characters. "
            "Pass --auth-password with a 6+ character demo password."
        )
    try:
        import firebase_admin
        from firebase_admin import auth, credentials
    except ImportError as exc:
        raise SystemExit(
            "firebase-admin is not installed. Run backend dependency install first."
        ) from exc

    if not firebase_admin._apps:
        firebase_admin.initialize_app(credentials.ApplicationDefault(), {"projectId": project})

    for user in DEMO_AUTH_USERS:
        try:
            auth.update_user(
                user["uid"],
                email=user["email"],
                password=password,
                display_name=user["display_name"],
                email_verified=True,
                disabled=False,
            )
            print(f"Updated Firebase Auth demo user {user['uid']}.")
        except auth.UserNotFoundError:
            auth.create_user(
                uid=user["uid"],
                email=user["email"],
                password=password,
                display_name=user["display_name"],
                email_verified=True,
                disabled=False,
            )
            print(f"Created Firebase Auth demo user {user['uid']}.")


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
