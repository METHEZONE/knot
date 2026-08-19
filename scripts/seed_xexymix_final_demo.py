import argparse
import os
import sys
from datetime import UTC, datetime
from pathlib import Path

# ruff: noqa: I001

REPO_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = REPO_ROOT / "backend"
SCRIPTS_ROOT = REPO_ROOT / "scripts"
sys.path.insert(0, str(BACKEND_ROOT))
sys.path.insert(0, str(SCRIPTS_ROOT))

import seed_devnet_phantom_demo as base
import seed_xexymix_demo as xexymix
from libs.a2a.registry import creator_agent_registry_entry
from libs.domain.discovery import build_creator_discovery_projection
from libs.domain.models import CreatorProfile
from libs.repositories.firestore_adapter import FirestoreDocumentStore
from libs.repositories.firestore_paths import COLLECTIONS, FirestorePaths
from libs.repositories.store import InMemoryDocumentStore, KnotRepository


PROJECT_ID = "knot-dev-503505"
CONFIRM_TOKEN = "SEED_KNOT_XEXYMIX_FINAL_DEMO"
BRAND_AUTH_UID = "jP4WsYPfApR6Vy5NS4A5sNEzRki2"
CREATOR_AUTH_UID = base.CREATOR_UID
DEMO_OWNER_PREFIX = "demo-xexymix-final"
CREATOR_PREFIX = "creator-xexymix-demo"
AGENT_PREFIX = "agent-creator-xexymix-demo"
TOTAL_CREATOR_COUNT = 30
CONTRACT_AMOUNT_USDC = 1
INITIAL_OFFER_USDC = 1


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Seed the final XEXYMIX demo with one live Promotion and a 30 creator "
            "candidate pool. The seed is scoped so it can be reset and replayed."
        )
    )
    parser.add_argument("--target", choices=["memory", "firestore"], default="memory")
    parser.add_argument("--project", default=_default_project_id())
    parser.add_argument("--brand-uid", default=BRAND_AUTH_UID)
    parser.add_argument("--creator-uid", default=CREATOR_AUTH_UID)
    parser.add_argument("--brand-wallet", default=base.DEFAULT_BRAND_WALLET)
    parser.add_argument("--creator-wallet", default=base.DEFAULT_CREATOR_WALLET)
    parser.add_argument("--creator-count", type=int, default=TOTAL_CREATOR_COUNT)
    parser.add_argument("--amount-usdc", type=int, default=CONTRACT_AMOUNT_USDC)
    parser.add_argument("--initial-offer-usdc", type=int, default=INITIAL_OFFER_USDC)
    parser.add_argument("--reset-demo", action="store_true")
    parser.add_argument(
        "--confirm",
        default="",
        help=f"Required for Firestore writes: --confirm={CONFIRM_TOKEN}",
    )
    args = parser.parse_args()

    _validate_args(args)
    _patch_base_ids()
    documents = xexymix.base.build_documents(
        amount_usdc=args.amount_usdc,
        brand_wallet=args.brand_wallet,
        creator_wallet=args.creator_wallet,
    )
    xexymix._apply_xexymix_demo(documents, args.amount_usdc, args.initial_offer_usdc)
    _strip_prebuilt_run_documents(documents)
    _apply_final_demo_account_ids(documents, args)
    _apply_final_demo_promotion(documents, args)
    _add_candidate_pool(documents, args)

    if args.target == "firestore":
        _assert_safe_firestore_seed(args.project, args.confirm)
        client = base._firestore_client(args.project)
        if args.reset_demo:
            _reset_firestore_demo(client)
        repository = KnotRepository(FirestoreDocumentStore(client))
        base.seed_documents(repository, documents)
        _print_summary("Seeded Firestore XEXYMIX final demo data.", documents, args)
        return 0

    memory_store = InMemoryDocumentStore()
    if args.reset_demo:
        print("memory reset requested; no remote documents deleted")
    base.seed_documents(KnotRepository(memory_store), documents)
    _print_summary("Loaded XEXYMIX final demo data into memory.", documents, args)
    for path in memory_store.paths():
        print(path)
    return 0


def _validate_args(args: argparse.Namespace) -> None:
    if args.creator_count < 20:
        raise SystemExit("--creator-count must be at least 20 for the final demo.")
    if args.creator_count > 60:
        raise SystemExit("--creator-count must be 60 or less to keep reset bounded.")
    if args.amount_usdc < 1:
        raise SystemExit("--amount-usdc must be at least 1.")
    if args.initial_offer_usdc < 1:
        raise SystemExit("--initial-offer-usdc must be at least 1.")
    if args.initial_offer_usdc > args.amount_usdc:
        raise SystemExit("--initial-offer-usdc must be less than or equal to amount.")


def _patch_base_ids() -> None:
    xexymix._patch_base_ids()


def _strip_prebuilt_run_documents(documents: dict[str, dict[str, object]]) -> None:
    prefixes = (
        f"{COLLECTIONS.match_runs}/",
        f"{COLLECTIONS.negotiations}/",
        f"{COLLECTIONS.agreements}/",
        f"{COLLECTIONS.agent_payment_events}/",
    )
    for path in list(documents):
        if path.startswith(prefixes):
            del documents[path]


def _apply_final_demo_account_ids(
    documents: dict[str, dict[str, object]],
    args: argparse.Namespace,
) -> None:
    now = _now()
    old_brand_user_path = FirestorePaths.user(base.BRAND_UID)
    brand_user = dict(documents.pop(old_brand_user_path))
    brand_user.update(
        {
            "uid": args.brand_uid,
            "userId": args.brand_uid,
            "email": "t1@knot.com",
            "displayName": "XEXYMIX Brand Manager",
            "brandId": base.BRAND_ID,
            "agentId": base.BRAND_AGENT_ID,
            "walletAddress": args.brand_wallet,
            "walletNetwork": "devnet",
            "walletCustody": "SELF",
            "onboardingStatus": "COMPLETED",
            "status": "ACTIVE",
            "schemaVersion": 2,
            "updatedAt": now,
        }
    )
    documents[FirestorePaths.user(args.brand_uid)] = brand_user

    creator_user_path = FirestorePaths.user(base.CREATOR_UID)
    creator_user = documents[creator_user_path]
    creator_user.update(
        {
            "uid": args.creator_uid,
            "userId": args.creator_uid,
            "email": "c1@knot.com",
            "displayName": "민지핏로그",
            "creatorId": base.CREATOR_ID,
            "agentId": base.CREATOR_AGENT_ID,
            "walletAddress": args.creator_wallet,
            "walletNetwork": "devnet",
            "onboardingStatus": "COMPLETED",
            "status": "ACTIVE",
            "schemaVersion": 2,
            "updatedAt": now,
        }
    )
    if args.creator_uid != base.CREATOR_UID:
        documents[FirestorePaths.user(args.creator_uid)] = dict(creator_user)
        del documents[creator_user_path]

    documents[FirestorePaths.brand(base.BRAND_ID)].update(
        {
            "ownerUid": args.brand_uid,
            "walletAddress": args.brand_wallet,
            "walletNetwork": "devnet",
            "updatedAt": now,
        }
    )
    documents[FirestorePaths.agent(base.BRAND_AGENT_ID)].update(
        {
            "ownerUid": args.brand_uid,
            "ownerId": base.BRAND_ID,
            "ownerType": "BRAND",
            "updatedAt": now,
        }
    )
    documents[FirestorePaths.creator_profile(base.CREATOR_ID)].update(
        {
            "ownerUid": args.creator_uid,
            "walletAddress": args.creator_wallet,
            "walletNetwork": "devnet",
            "updatedAt": now,
        }
    )
    documents[FirestorePaths.agent(base.CREATOR_AGENT_ID)].update(
        {
            "ownerUid": args.creator_uid,
            "ownerId": base.CREATOR_ID,
            "ownerType": "CREATOR",
            "updatedAt": now,
        }
    )
    documents[FirestorePaths.agent_policy(base.CREATOR_AGENT_ID)].update(
        {"ownerUid": args.creator_uid, "updatedAt": now}
    )
    _refresh_creator_projection(documents, base.CREATOR_ID)


def _apply_final_demo_promotion(
    documents: dict[str, dict[str, object]],
    args: argparse.Namespace,
) -> None:
    now = _now()
    promotion = documents[FirestorePaths.promotion(xexymix.PROMOTION_ID)]
    promotion.update(
        {
            "ownerUid": args.brand_uid,
            "title": "XEXYMIX 애슬레저 퍼포먼스 레깅스 협찬",
            "objective": (
                "필라테스/러닝 루틴에서 제품 착용감, 핏, 움직임을 자연스럽게 보여주는 "
                "인스타그램 릴스 1개를 제작한다."
            ),
            "budget": {
                "totalUsdc": args.creator_count * args.amount_usdc,
                "maxPerCreatorUsdc": args.amount_usdc,
            },
            "totalBudget": args.creator_count * args.amount_usdc,
            "initialOffer": args.initial_offer_usdc,
            "maximumPerCreator": args.amount_usdc,
            "autoAcceptCeiling": args.amount_usdc,
            "deliverables": [{"format": "reel", "count": 1}],
            "postingWindow": {"start": "2026-09-01", "end": "2026-09-08"},
            "deadline": "2026-09-08",
            "usageRights": "organicOnly",
            "constraints": {
                "requiredDisclosures": ["#ad", "#sponsored"],
                "prohibitedClaims": ["체형 교정 효과 단정", "의학적 효능 표현", "비교 비방"],
                "requiredCategories": ["fitness"],
                "prohibitedCategories": [],
                "maxPerformancePct": 0,
            },
            "autonomy": {
                "maxNegotiationRounds": 5,
                "autoEscrow": False,
                "autoRelease": True,
            },
            "moodTags": ["운동 루틴", "착용 후기", "데일리 애슬레저"],
            "status": "OPEN",
            "updatedAt": now,
        }
    )


def _add_candidate_pool(
    documents: dict[str, dict[str, object]],
    args: argparse.Namespace,
) -> None:
    _apply_top_creator_profile(documents, args)
    for index in range(2, args.creator_count + 1):
        creator_id = f"{CREATOR_PREFIX}-{index:02d}"
        agent_id = f"{AGENT_PREFIX}-{index:02d}"
        creator, agent, policy = _candidate_documents(index, creator_id, agent_id, args)
        documents[FirestorePaths.creator_profile(creator_id)] = creator
        documents[FirestorePaths.agent(agent_id)] = agent
        documents[FirestorePaths.agent_policy(agent_id)] = policy
        documents[FirestorePaths.creator_discovery_profile(creator_id)] = (
            build_creator_discovery_projection(
                CreatorProfile.model_validate(creator),
                agent,
                updated_at=str(creator["updatedAt"]),
            )
        )
        documents[FirestorePaths.agent_registry_entry(agent_id)] = creator_agent_registry_entry(
            agent,
            updated_at=str(creator["updatedAt"]),
        )


def _apply_top_creator_profile(
    documents: dict[str, dict[str, object]],
    args: argparse.Namespace,
) -> None:
    now = _now()
    creator = documents[FirestorePaths.creator_profile(base.CREATOR_ID)]
    creator.update(
        {
            "displayName": "민지핏로그",
            "categories": ["fitness", "fashion", "lifestyle"],
            "supportedDeliverableFormats": ["reel", "short", "post"],
            "allowedUsageRights": ["organicOnly", "paidBoost30d"],
            "minDaysToPost": 5,
            "availableFrom": "2026-08-20",
            "monthlyCapacity": 5,
            "activeDeliverablesThisMonth": 0,
            "completedDealCount": 28,
            "rateCard": {"minBaseUsdc": args.amount_usdc, "maxBaseUsdc": args.amount_usdc},
            "publicRateBand": {
                "currency": "USDC",
                "minimum": args.amount_usdc,
                "maximum": args.amount_usdc,
            },
            "socialLinks": [
                {"platform": "instagram", "url": "https://www.instagram.com/minji.fitlog"}
            ],
            "active": True,
            "status": "ACTIVE",
            "receivingOffers": True,
            "updatedAt": now,
        }
    )
    agent = documents[FirestorePaths.agent(base.CREATOR_AGENT_ID)]
    agent.update(
        {
            "displayName": "민지핏로그 Creator Agent",
            "publicationStatus": "PUBLISHED",
            "acceptingOffers": True,
            "availability": "AVAILABLE",
            "activeNegotiations": 0,
            "maxConcurrentNegotiations": 3,
            "activeCollaborations": 0,
            "maxActiveCollaborations": 3,
            "updatedAt": now,
        }
    )
    policy = documents[FirestorePaths.agent_policy(base.CREATOR_AGENT_ID)]
    policy.update(
        {
            "creator": {
                "minBaseUsdc": args.amount_usdc,
                "blockedIndustries": ["tobacco", "gambling", "alcohol"],
                "maxDeliverablesPerMonth": 5,
                "minDaysToPost": 5,
                "allowedUsageRights": ["organicOnly", "paidBoost30d"],
                "maxRevisionRounds": 1,
                "maxExclusivityDays": 0,
            },
            "preferredContent": ["필라테스 루틴", "착용 후기", "데일리 애슬레저"],
            "active": True,
            "updatedAt": now,
        }
    )
    _refresh_creator_projection(documents, base.CREATOR_ID)


def _candidate_documents(
    index: int,
    creator_id: str,
    agent_id: str,
    args: argparse.Namespace,
) -> tuple[dict[str, object], dict[str, object], dict[str, object]]:
    now = _now()
    persona = _persona(index)
    primary_format = "short" if index % 3 else "post"
    supported_formats = [primary_format, "reel", "post"] if primary_format != "post" else ["post", "reel", "short"]
    completed_deals = max(2, 28 - index)
    min_rate = args.amount_usdc if index <= 24 else args.amount_usdc + 1
    active_deliverables = 0 if index <= 24 else 1
    owner_uid = f"{DEMO_OWNER_PREFIX}-creator-{index:02d}"
    creator = {
        "creatorId": creator_id,
        "creatorAgentId": agent_id,
        "ownerUid": owner_uid,
        "displayName": persona["displayName"],
        "categories": persona["categories"],
        "prohibitedIndustries": ["tobacco", "gambling", "alcohol"],
        "supportedDeliverableFormats": supported_formats,
        "allowedUsageRights": ["organicOnly", "paidBoost30d"],
        "minDaysToPost": 5 + (index % 2),
        "availableFrom": "2026-08-20" if index <= 26 else "2026-08-27",
        "monthlyCapacity": 4,
        "activeDeliverablesThisMonth": active_deliverables,
        "completedDealCount": completed_deals,
        "rateCard": {"minBaseUsdc": min_rate, "maxBaseUsdc": max(min_rate, args.amount_usdc + 1)},
        "publicRateBand": {
            "currency": "USDC",
            "minimum": min_rate,
            "maximum": max(min_rate, args.amount_usdc + 1),
        },
        "socialLinks": [{"platform": "instagram", "url": persona["instagram"]}],
        "walletAddress": None,
        "walletNetwork": "devnet",
        "receivingOffers": True,
        "status": "ACTIVE",
        "active": True,
        "createdAt": now,
        "updatedAt": now,
    }
    agent = {
        "agentId": agent_id,
        "agentType": "CREATOR",
        "ownerUid": owner_uid,
        "ownerId": creator_id,
        "ownerType": "CREATOR",
        "displayName": f"{persona['displayName']} Creator Agent",
        "service": "knot-creator-agent",
        "a2aEndpoint": "/a2a/v1",
        "status": "ACTIVE",
        "publicationStatus": "PUBLISHED",
        "acceptingOffers": True,
        "availability": "AVAILABLE",
        "activeNegotiations": 0,
        "maxConcurrentNegotiations": 2,
        "activeCollaborations": 0,
        "maxActiveCollaborations": 3,
        "createdAt": now,
        "updatedAt": now,
    }
    policy = {
        "agentId": agent_id,
        "policyVersion": 1,
        "agentType": "CREATOR",
        "ownerUid": owner_uid,
        "creator": {
            "minBaseUsdc": min_rate,
            "blockedIndustries": ["tobacco", "gambling", "alcohol"],
            "maxDeliverablesPerMonth": 4,
            "minDaysToPost": 5 + (index % 2),
            "allowedUsageRights": ["organicOnly", "paidBoost30d"],
            "maxRevisionRounds": 1,
            "maxExclusivityDays": 0,
        },
        "preferredContent": persona["preferredContent"],
        "active": True,
        "createdAt": now,
        "updatedAt": now,
    }
    return creator, agent, policy


def _persona(index: int) -> dict[str, object]:
    personas = [
        ("서연무브", ["fitness", "fashion", "lifestyle"], ["러닝 루틴", "착용 후기"]),
        ("하린필라테스", ["fitness", "wellness", "fashion"], ["필라테스", "자세 교정 표현 제외"]),
        ("유나데일리핏", ["fashion", "fitness", "lifestyle"], ["데일리룩", "레깅스 스타일링"]),
        ("지아러닝로그", ["fitness", "outdoor", "fashion"], ["러닝", "기능성 착용감"]),
        ("나은홈트", ["fitness", "lifestyle", "wellness"], ["홈트", "초보자 루틴"]),
        ("채원요가룸", ["wellness", "fitness", "fashion"], ["요가", "차분한 리뷰"]),
        ("다인핏체크", ["fitness", "fashion", "beauty"], ["착용 비교", "핏 체크"]),
        ("수아애슬레저", ["fashion", "fitness", "lifestyle"], ["애슬레저", "출근룩 전환"]),
        ("예린헬스노트", ["fitness", "wellness", "lifestyle"], ["헬스장 루틴", "하체 운동"]),
        ("민아모닝런", ["fitness", "outdoor", "lifestyle"], ["모닝런", "가벼운 리뷰"]),
    ]
    name, categories, preferred = personas[(index - 2) % len(personas)]
    suffix = (index - 2) // len(personas) + 1
    display_name = name if suffix == 1 else f"{name} {suffix}"
    handle = display_name.lower().replace(" ", ".")
    return {
        "displayName": display_name,
        "categories": categories,
        "preferredContent": preferred,
        "instagram": f"https://www.instagram.com/{handle}",
    }


def _refresh_creator_projection(documents: dict[str, dict[str, object]], creator_id: str) -> None:
    creator_path = FirestorePaths.creator_profile(creator_id)
    creator = documents[creator_path]
    agent = documents[FirestorePaths.agent(str(creator["creatorAgentId"]))]
    documents[FirestorePaths.creator_discovery_profile(creator_id)] = (
        build_creator_discovery_projection(
            CreatorProfile.model_validate(creator),
            agent,
            updated_at=str(creator["updatedAt"]),
        )
    )
    documents[FirestorePaths.agent_registry_entry(str(creator["creatorAgentId"]))] = (
        creator_agent_registry_entry(agent, updated_at=str(creator["updatedAt"]))
    )


def _reset_firestore_demo(client: object) -> None:
    for collection_name, field_name in (
        (COLLECTIONS.match_runs, "promotionId"),
        (COLLECTIONS.negotiations, "promotionId"),
        (COLLECTIONS.agreements, "promotionId"),
        (COLLECTIONS.agent_payment_events, "promotionId"),
        (COLLECTIONS.payment_operations, "promotionId"),
    ):
        for snapshot in client.collection(collection_name).where(
            field_name,
            "==",
            xexymix.PROMOTION_ID,
        ).stream():
            _delete_document_tree(snapshot.reference)
    for collection_name in (
        COLLECTIONS.creator_profiles,
        COLLECTIONS.creator_discovery_profiles,
    ):
        _delete_prefix_documents(client.collection(collection_name), f"{CREATOR_PREFIX}-")
    for collection_name in (
        COLLECTIONS.agents,
        COLLECTIONS.agent_policies,
        COLLECTIONS.agent_registry,
    ):
        _delete_prefix_documents(client.collection(collection_name), f"{AGENT_PREFIX}-")
    _delete_promotion_events(client)


def _delete_prefix_documents(collection: object, prefix: str) -> None:
    for snapshot in collection.stream():
        if snapshot.id.startswith(prefix):
            _delete_document_tree(snapshot.reference)


def _delete_promotion_events(client: object) -> None:
    promotion_ref = client.collection(COLLECTIONS.promotions).document(xexymix.PROMOTION_ID)
    events_ref = promotion_ref.collection(COLLECTIONS.promotion_events)
    for snapshot in events_ref.stream():
        _delete_document_tree(snapshot.reference)


def _delete_document_tree(reference: object) -> None:
    for child_collection in reference.collections():
        for child_snapshot in child_collection.stream():
            _delete_document_tree(child_snapshot.reference)
    reference.delete()


def _assert_safe_firestore_seed(project: str | None, confirm: str) -> None:
    if os.getenv("NODE_ENV") == "production":
        raise SystemExit("Refusing to seed demo data when NODE_ENV=production.")
    if os.getenv("ALLOW_DEVNET_DEMO_SEED") != "true":
        raise SystemExit("Set ALLOW_DEVNET_DEMO_SEED=true to seed Firestore.")
    if not project or project != os.getenv("DEMO_PROJECT_ID", PROJECT_ID):
        raise SystemExit("Firestore seed requires --project to match DEMO_PROJECT_ID.")
    if project in {"knot-prod", "production", "prod"}:
        raise SystemExit("Refusing to seed a production-looking project.")
    if confirm != CONFIRM_TOKEN:
        raise SystemExit(f"Pass --confirm={CONFIRM_TOKEN}.")


def _print_summary(
    headline: str,
    documents: dict[str, dict[str, object]],
    args: argparse.Namespace,
) -> None:
    creator_paths = [
        path for path in documents
        if path.startswith(f"{COLLECTIONS.creator_discovery_profiles}/")
    ]
    print(headline)
    print(f"Documents: {len(documents)}")
    print(f"Creator discovery profiles: {len(creator_paths)}")
    print("Brand login: t1@knot.com / 000000")
    print("Creator login: c1@knot.com / 000000")
    print(f"Promotion: {xexymix.PROMOTION_ID}")
    print(f"Contract amount: {args.amount_usdc} devnet USDC")
    print("pay.sh verification: sandbox quote, expected 0.02 USDC")
    print(f"Top creator: {base.CREATOR_ID} / {base.CREATOR_AGENT_ID}")
    print(f"Reset scope: {CREATOR_PREFIX}-*, {AGENT_PREFIX}-*, promotion operational docs")


def _default_project_id() -> str:
    return os.getenv("GOOGLE_CLOUD_PROJECT") or os.getenv("GCP_PROJECT_ID") or PROJECT_ID


def _now() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


if __name__ == "__main__":
    raise SystemExit(main())
