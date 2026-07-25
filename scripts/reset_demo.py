import argparse
import os
import sys
from collections.abc import Callable
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = REPO_ROOT / "backend"
sys.path.insert(0, str(BACKEND_ROOT))

from libs.repositories.firestore_adapter import FirestoreDocumentStore
from libs.repositories.firestore_paths import COLLECTIONS, FirestorePaths
from libs.repositories.store import InMemoryDocumentStore, KnotRepository

SEEDED_BRAND_ID = "brand-001"
SEEDED_AGENT_IDS = [
    "brand-agent-001",
    "creator-agent-001",
    "creator-agent-002",
    "creator-agent-003",
]
SEEDED_POLICY_AGENT_IDS = ["creator-agent-001", "creator-agent-002", "creator-agent-003"]
SEEDED_CREATOR_IDS = ["creator-001", "creator-002", "creator-003"]


def main() -> int:
    parser = argparse.ArgumentParser(description="Reset KNOT v1 demo Firestore documents.")
    parser.add_argument("--target", choices=["memory", "firestore"], default="memory")
    parser.add_argument(
        "--project",
        default=_default_project_id(),
        help="GCP project ID for Firestore target. Defaults to GOOGLE_CLOUD_PROJECT or GCP_PROJECT_ID.",
    )
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    repository = _repository(args.target, args.project)
    paths = _demo_document_paths(repository)
    for path in paths:
        if args.dry_run:
            print(path)
        else:
            repository.delete_raw_document(path)
    action = "Would delete" if args.dry_run else "Deleted"
    print(f"{action} {len(paths)} demo documents.")
    return 0


def _repository(target: str, project: str | None) -> KnotRepository:
    if target == "firestore":
        try:
            from google.cloud import firestore
        except ImportError as exc:
            raise SystemExit(
                "google-cloud-firestore is not installed. Run backend dependency install first."
            ) from exc
        return KnotRepository(FirestoreDocumentStore(firestore.Client(project=project)))
    return KnotRepository(InMemoryDocumentStore())


def _demo_document_paths(repository: KnotRepository) -> list[str]:
    paths: set[str] = set()
    promotion_ids = _demo_promotion_ids(repository)
    match_run_ids = _demo_match_run_ids(repository, promotion_ids)
    negotiation_ids = _demo_negotiation_ids(repository, promotion_ids, match_run_ids)
    task_ids = _demo_task_ids(repository, negotiation_ids)
    agreement_ids = _demo_agreement_ids(repository, promotion_ids, negotiation_ids)

    for promotion_id in promotion_ids:
        _add_subcollection_paths(
            repository,
            paths,
            f"{COLLECTIONS.promotions}/{promotion_id}/{COLLECTIONS.promotion_events}",
            "eventId",
            FirestorePaths.promotion_event,
            promotion_id,
        )
        paths.add(FirestorePaths.promotion(promotion_id))

    for match_run_id in match_run_ids:
        for candidate in repository.list_raw_documents(
            f"{COLLECTIONS.match_runs}/{match_run_id}/{COLLECTIONS.match_candidates}"
        ):
            creator_id = str(candidate.get("creatorId") or "")
            if creator_id:
                paths.add(FirestorePaths.match_candidate(match_run_id, creator_id))
        paths.add(FirestorePaths.match_run(match_run_id))

    for negotiation_id in negotiation_ids:
        _add_subcollection_paths(
            repository,
            paths,
            f"{COLLECTIONS.negotiations}/{negotiation_id}/{COLLECTIONS.negotiation_messages}",
            "messageId",
            FirestorePaths.negotiation_message,
            negotiation_id,
        )
        _add_subcollection_paths(
            repository,
            paths,
            f"{COLLECTIONS.negotiations}/{negotiation_id}/{COLLECTIONS.negotiation_decisions}",
            "decisionId",
            FirestorePaths.negotiation_decision,
            negotiation_id,
        )
        paths.add(FirestorePaths.negotiation(negotiation_id))

    for task_id in task_ids:
        _add_subcollection_paths(
            repository,
            paths,
            f"{COLLECTIONS.a2a_tasks}/{task_id}/{COLLECTIONS.a2a_events}",
            "eventId",
            FirestorePaths.a2a_task_event,
            task_id,
        )
        _add_subcollection_paths(
            repository,
            paths,
            f"{COLLECTIONS.a2a_tasks}/{task_id}/{COLLECTIONS.a2a_artifacts}",
            "artifactId",
            FirestorePaths.a2a_task_artifact,
            task_id,
        )
        paths.add(FirestorePaths.a2a_task(task_id))

    for agreement_id in agreement_ids:
        _add_subcollection_paths(
            repository,
            paths,
            f"{COLLECTIONS.agreements}/{agreement_id}/{COLLECTIONS.milestones}",
            "milestoneId",
            FirestorePaths.milestone,
            agreement_id,
        )
        paths.add(FirestorePaths.agreement(agreement_id))

    _add_top_level_demo_documents(
        repository,
        paths,
        collection=COLLECTIONS.evidence,
        id_field="evidenceId",
        path_builder=FirestorePaths.evidence,
        promotion_ids=promotion_ids,
        prefixes=("evidence-",),
    )
    _add_top_level_demo_documents(
        repository,
        paths,
        collection=COLLECTIONS.escrows,
        id_field="escrowId",
        path_builder=FirestorePaths.escrow,
        promotion_ids=promotion_ids,
        prefixes=("escrow-",),
    )
    _add_top_level_demo_documents(
        repository,
        paths,
        collection=COLLECTIONS.settlements,
        id_field="settlementId",
        path_builder=FirestorePaths.settlement,
        promotion_ids=promotion_ids,
        prefixes=("settlement-",),
    )
    _add_top_level_demo_documents(
        repository,
        paths,
        collection=COLLECTIONS.payment_operations,
        id_field="operationId",
        path_builder=FirestorePaths.payment_operation,
        promotion_ids=promotion_ids,
        prefixes=("operation-",),
    )
    _add_top_level_demo_documents(
        repository,
        paths,
        collection=COLLECTIONS.transaction_receipts,
        id_field="receiptId",
        path_builder=FirestorePaths.transaction_receipt,
        promotion_ids=promotion_ids,
        prefixes=("receipt-",),
    )
    _add_top_level_demo_documents(
        repository,
        paths,
        collection=COLLECTIONS.audit_events,
        id_field="eventId",
        path_builder=FirestorePaths.audit_event,
        promotion_ids=promotion_ids,
        prefixes=("event-",),
    )

    for key in SEEDED_AGENT_IDS:
        paths.add(FirestorePaths.agent(key))
    for key in SEEDED_POLICY_AGENT_IDS:
        paths.add(FirestorePaths.agent_policy(key))
    for creator_id in SEEDED_CREATOR_IDS:
        paths.add(FirestorePaths.creator_profile(creator_id))
    paths.add(FirestorePaths.brand(SEEDED_BRAND_ID))

    return sorted(paths)


def _demo_promotion_ids(repository: KnotRepository) -> set[str]:
    promotion_ids: set[str] = {"promotion-001"}
    for promotion in repository.list_promotions():
        if promotion.brand_id == SEEDED_BRAND_ID or promotion.promotion_id.startswith("promotion-"):
            promotion_ids.add(promotion.promotion_id)
    return promotion_ids


def _demo_match_run_ids(repository: KnotRepository, promotion_ids: set[str]) -> set[str]:
    match_run_ids: set[str] = set()
    for document in repository.list_raw_documents(COLLECTIONS.match_runs):
        match_run_id = str(document.get("matchRunId") or "")
        if document.get("promotionId") in promotion_ids or match_run_id.startswith("match-"):
            match_run_ids.add(match_run_id)
    return {match_run_id for match_run_id in match_run_ids if match_run_id}


def _demo_negotiation_ids(
    repository: KnotRepository,
    promotion_ids: set[str],
    match_run_ids: set[str],
) -> set[str]:
    negotiation_ids: set[str] = set()
    for document in repository.list_raw_documents(COLLECTIONS.negotiations):
        negotiation_id = str(document.get("negotiationId") or "")
        if (
            document.get("promotionId") in promotion_ids
            or document.get("matchRunId") in match_run_ids
            or negotiation_id.startswith("negotiation-")
        ):
            negotiation_ids.add(negotiation_id)
    return {negotiation_id for negotiation_id in negotiation_ids if negotiation_id}


def _demo_task_ids(repository: KnotRepository, negotiation_ids: set[str]) -> set[str]:
    task_ids: set[str] = set()
    for document in repository.list_raw_documents(COLLECTIONS.a2a_tasks):
        task_id = str(document.get("taskId") or "")
        if document.get("negotiationId") in negotiation_ids or task_id.startswith("task-"):
            task_ids.add(task_id)
    return {task_id for task_id in task_ids if task_id}


def _demo_agreement_ids(
    repository: KnotRepository,
    promotion_ids: set[str],
    negotiation_ids: set[str],
) -> set[str]:
    agreement_ids: set[str] = set()
    for document in repository.list_raw_documents(COLLECTIONS.agreements):
        agreement_id = str(document.get("agreementId") or "")
        if (
            document.get("promotionId") in promotion_ids
            or document.get("negotiationId") in negotiation_ids
            or agreement_id.startswith("agreement-")
        ):
            agreement_ids.add(agreement_id)
    return {agreement_id for agreement_id in agreement_ids if agreement_id}


def _add_subcollection_paths(
    repository: KnotRepository,
    paths: set[str],
    collection_path: str,
    id_field: str,
    path_builder: Callable[[str, str], str],
    parent_id: str,
) -> None:
    for document in repository.list_raw_documents(collection_path):
        document_id = str(document.get(id_field) or "")
        if document_id:
            paths.add(path_builder(parent_id, document_id))


def _add_top_level_demo_documents(
    repository: KnotRepository,
    paths: set[str],
    *,
    collection: str,
    id_field: str,
    path_builder: Callable[[str], str],
    promotion_ids: set[str],
    prefixes: tuple[str, ...],
) -> None:
    for document in repository.list_raw_documents(collection):
        document_id = str(document.get(id_field) or "")
        if document.get("promotionId") in promotion_ids or document_id.startswith(prefixes):
            paths.add(path_builder(document_id))


def _default_project_id() -> str | None:
    return os.getenv("GOOGLE_CLOUD_PROJECT") or os.getenv("GCP_PROJECT_ID")


if __name__ == "__main__":
    raise SystemExit(main())
