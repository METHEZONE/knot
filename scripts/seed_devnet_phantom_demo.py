import argparse
import os
import sys
from datetime import UTC, datetime
from pathlib import Path

# ruff: noqa: I001

REPO_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = REPO_ROOT / "backend"
sys.path.insert(0, str(BACKEND_ROOT))

from libs.a2a.registry import creator_agent_registry_entry
from libs.domain.discovery import build_creator_discovery_projection
from libs.domain.hashing import canonical_terms_json, terms_hash
from libs.domain.models import AgreementTerms, CreatorProfile
from libs.payments.settlement import lock_amount_base_units, milestone_amounts_base_units
from libs.repositories.firestore_adapter import FirestoreDocumentStore
from libs.repositories.firestore_paths import FirestorePaths
from libs.repositories.store import InMemoryDocumentStore, KnotRepository


DEFAULT_BRAND_WALLET = "8keJx2mcKFENHcUs4ti79aUurAHrWt8Z4XcQTnKGKks6"
DEFAULT_CREATOR_WALLET = "63T8p6c4p1fFC7HmYDEqNtyheqMxnYKmiGqTafpzh8zJ"
DEFAULT_PROJECT_ID = "knot-dev-503505"
DEVNET_USDC_MINT = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"

BRAND_UID = "user-brand-devnet"
CREATOR_UID = "user-creator-devnet"
BRAND_ID = "brand-devnet-phantom"
CREATOR_ID = "creator-devnet-phantom"
BRAND_AGENT_ID = "agent-brand-devnet-phantom"
CREATOR_AGENT_ID = "agent-creator-devnet-phantom"
PROMOTION_ID = "promotion-devnet-1usdc"
MATCH_RUN_ID = "match-run-devnet-1usdc"
NEGOTIATION_ID = "negotiation-devnet-1usdc"
TASK_ID = "task-devnet-1usdc"
ARTIFACT_ID = "artifact-devnet-1usdc"
AGREEMENT_ID = "agreement-devnet-1usdc"
MILESTONE_ID = "content-post"
PAYMENT_EVENT_ID = "agent-payment-devnet-skipped"


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Seed a tiny Phantom/devnet KNOT flow: Brand and Creator accounts, "
            "published agents, an A2A negotiation, and a 1 USDC funding-required Agreement."
        )
    )
    parser.add_argument("--target", choices=["memory", "firestore"], default="memory")
    parser.add_argument("--project", default=_default_project_id())
    parser.add_argument("--brand-wallet", default=DEFAULT_BRAND_WALLET)
    parser.add_argument("--creator-wallet", default=DEFAULT_CREATOR_WALLET)
    parser.add_argument("--amount-usdc", type=int, default=1)
    parser.add_argument("--create-auth-users", action="store_true")
    parser.add_argument("--auth-password", default="000000")
    parser.add_argument(
        "--confirm",
        default="",
        help="Required for Firestore writes: --confirm=SEED_KNOT_DEVNET_PHANTOM_DEMO",
    )
    args = parser.parse_args()

    if args.amount_usdc < 1:
        raise SystemExit("--amount-usdc must be at least 1.")

    documents = build_documents(
        amount_usdc=args.amount_usdc,
        brand_wallet=args.brand_wallet,
        creator_wallet=args.creator_wallet,
    )

    if args.target == "firestore":
        _assert_safe_firestore_seed(args.project, args.confirm)
        store = FirestoreDocumentStore(_firestore_client(args.project))
        seed_documents(KnotRepository(store), documents)
        if args.create_auth_users:
            _create_or_update_auth_users(args.project, args.auth_password)
        _print_summary("Seeded Firestore devnet Phantom demo data.", documents, args.amount_usdc)
        return 0

    memory_store = InMemoryDocumentStore()
    seed_documents(KnotRepository(memory_store), documents)
    _print_summary("Loaded devnet Phantom demo data into memory.", documents, args.amount_usdc)
    for path in memory_store.paths():
        print(path)
    return 0


def build_documents(
    *,
    amount_usdc: int,
    brand_wallet: str,
    creator_wallet: str,
) -> dict[str, dict[str, object]]:
    now = _now()
    terms = _agreement_terms(amount_usdc)
    terms_hash_value = terms_hash(terms)
    canonical_terms = canonical_terms_json(terms)
    locked_amount = lock_amount_base_units(terms)
    milestone_amounts = milestone_amounts_base_units(locked_amount, terms.milestones)
    milestone_amount = milestone_amounts[MILESTONE_ID]

    brand_user = {
        "userId": BRAND_UID,
        "uid": BRAND_UID,
        "email": "t1@knot.com",
        "displayName": "KNOT Devnet Brand",
        "role": "BRAND",
        "onboardingStatus": "COMPLETED",
        "brandId": BRAND_ID,
        "agentId": BRAND_AGENT_ID,
        "walletAddress": brand_wallet,
        "walletNetwork": "devnet",
        "createdAt": now,
        "updatedAt": now,
    }
    creator_user = {
        "userId": CREATOR_UID,
        "uid": CREATOR_UID,
        "email": "c1@knot.com",
        "displayName": "KNOT Devnet Creator",
        "role": "CREATOR",
        "onboardingStatus": "COMPLETED",
        "creatorId": CREATOR_ID,
        "agentId": CREATOR_AGENT_ID,
        "walletAddress": creator_wallet,
        "walletNetwork": "devnet",
        "createdAt": now,
        "updatedAt": now,
    }
    brand = {
        "brandId": BRAND_ID,
        "ownerUid": BRAND_UID,
        "displayName": "KNOT Devnet SPF",
        "brandName": "KNOT Devnet SPF",
        "category": "beauty",
        "productName": "Daily Clear SPF Cream",
        "productUrl": "https://example.com/knot-devnet-spf",
        "summary": "데모용 SPF 크림 협찬 브랜드",
        "walletAddress": brand_wallet,
        "walletNetwork": "devnet",
        "status": "ACTIVE",
        "createdAt": now,
        "updatedAt": now,
    }
    creator = {
        "creatorId": CREATOR_ID,
        "creatorAgentId": CREATOR_AGENT_ID,
        "ownerUid": CREATOR_UID,
        "displayName": "Mina Devnet Studio",
        "categories": ["beauty", "skincare"],
        "prohibitedIndustries": ["gambling"],
        "supportedDeliverableFormats": ["reel", "shorts", "post"],
        "allowedUsageRights": ["organicOnly", "paidBoost30d"],
        "minDaysToPost": 3,
        "availableFrom": "2026-08-03",
        "monthlyCapacity": 4,
        "activeDeliverablesThisMonth": 0,
        "completedDealCount": 3,
        "rateCard": {"minBaseUsdc": 1, "maxBaseUsdc": 5},
        "publicRateBand": {"currency": "USDC", "minimum": 1, "maximum": 5},
        "socialLinks": [{"platform": "instagram", "url": "https://instagram.com/mina.devnet"}],
        "walletAddress": creator_wallet,
        "walletNetwork": "devnet",
        "receivingOffers": True,
        "status": "ACTIVE",
        "active": True,
        "createdAt": now,
        "updatedAt": now,
    }
    brand_agent = {
        "agentId": BRAND_AGENT_ID,
        "agentType": "BRAND",
        "ownerUid": BRAND_UID,
        "ownerId": BRAND_ID,
        "ownerType": "BRAND",
        "displayName": "KNOT Devnet Brand Agent",
        "service": "knot-brand-agent",
        "a2aEndpoint": "/a2a/v1",
        "status": "ACTIVE",
        "publicationStatus": "PUBLISHED",
        "acceptingOffers": True,
        "availability": "AVAILABLE",
        "activeNegotiations": 0,
        "maxConcurrentNegotiations": 3,
        "activeCollaborations": 0,
        "maxActiveCollaborations": 3,
        "createdAt": now,
        "updatedAt": now,
    }
    creator_agent = {
        "agentId": CREATOR_AGENT_ID,
        "agentType": "CREATOR",
        "ownerUid": CREATOR_UID,
        "ownerId": CREATOR_ID,
        "ownerType": "CREATOR",
        "displayName": "Mina Devnet Creator Agent",
        "service": "knot-creator-agent",
        "a2aEndpoint": "/a2a/v1",
        "status": "ACTIVE",
        "publicationStatus": "PUBLISHED",
        "acceptingOffers": True,
        "availability": "AVAILABLE",
        "activeNegotiations": 0,
        "maxConcurrentNegotiations": 2,
        "activeCollaborations": 0,
        "maxActiveCollaborations": 2,
        "createdAt": now,
        "updatedAt": now,
    }
    creator_policy = {
        "agentId": CREATOR_AGENT_ID,
        "policyVersion": 1,
        "agentType": "CREATOR",
        "ownerUid": CREATOR_UID,
        "creator": {
            "minBaseUsdc": 1,
            "blockedIndustries": ["gambling"],
            "maxDeliverablesPerMonth": 4,
            "minDaysToPost": 3,
            "allowedUsageRights": ["organicOnly", "paidBoost30d"],
            "maxRevisionRounds": 1,
            "maxExclusivityDays": 0,
        },
        "active": True,
        "createdAt": now,
    }
    promotion = {
        "promotionId": PROMOTION_ID,
        "brandId": BRAND_ID,
        "brandAgentId": BRAND_AGENT_ID,
        "ownerUid": BRAND_UID,
        "title": "Daily Clear SPF Cream Devnet 협찬",
        "productName": "Daily Clear SPF Cream",
        "productUrl": "https://example.com/knot-devnet-spf",
        "objective": "제품 사용감이 드러나는 인스타그램 릴스 1개 업로드",
        "category": "beauty",
        "categories": ["beauty", "skincare"],
        "targetAudience": ["20대 민감성 피부", "데일리 선케어 관심층"],
        "targetAudienceText": "20대 민감성 피부와 데일리 선케어 관심층",
        "budget": {"totalUsdc": amount_usdc, "maxPerCreatorUsdc": amount_usdc},
        "currency": "USDC",
        "totalBudget": amount_usdc,
        "initialOffer": amount_usdc,
        "maximumPerCreator": amount_usdc,
        "autoAcceptCeiling": amount_usdc,
        "deliverables": [{"format": "reel", "count": 1}],
        "postingWindow": {"start": "2026-08-10", "end": "2026-08-17"},
        "deadline": "2026-08-17",
        "usageRights": "organicOnly",
        "constraints": {
            "requiredDisclosures": ["#ad", "#sponsored"],
            "prohibitedClaims": ["의학적 치료 효과"],
            "requiredCategories": ["beauty"],
            "prohibitedCategories": [],
            "maxPerformancePct": 0,
        },
        "autonomy": {
            "maxNegotiationRounds": 5,
            "autoEscrow": False,
            "autoRelease": True,
        },
        "moodTags": ["clean", "daily", "skincare"],
        "maximumRounds": 5,
        "status": "OPEN",
        "createdAt": now,
        "updatedAt": now,
    }
    match_run = {
        "matchRunId": MATCH_RUN_ID,
        "promotionId": PROMOTION_ID,
        "brandId": BRAND_ID,
        "brandAgentId": BRAND_AGENT_ID,
        "status": "AGREED",
        "selectedCreatorId": CREATOR_ID,
        "selectedCreatorAgentId": CREATOR_AGENT_ID,
        "createdAt": now,
        "updatedAt": now,
    }
    match_candidate = {
        "candidateId": CREATOR_ID,
        "matchCandidateId": CREATOR_ID,
        "matchRunId": MATCH_RUN_ID,
        "promotionId": PROMOTION_ID,
        "creatorId": CREATOR_ID,
        "creatorAgentId": CREATOR_AGENT_ID,
        "rank": 1,
        "eligible": True,
        "overallScore": 0.91,
        "status": "AGREED",
        "explanation": "Devnet escrow smoke test candidate with real Creator Phantom destination.",
        "negotiationId": NEGOTIATION_ID,
        "negotiationStatus": "AGREED",
        "createdAt": now,
        "updatedAt": now,
    }
    negotiation = {
        "negotiationId": NEGOTIATION_ID,
        "matchRunId": MATCH_RUN_ID,
        "matchCandidateId": CREATOR_ID,
        "promotionId": PROMOTION_ID,
        "promotionTitle": promotion["title"],
        "productName": promotion["productName"],
        "brandId": BRAND_ID,
        "brandAgentId": BRAND_AGENT_ID,
        "creatorId": CREATOR_ID,
        "creatorAgentId": CREATOR_AGENT_ID,
        "creatorDisplayName": creator["displayName"],
        "contextId": f"context-{NEGOTIATION_ID}",
        "taskId": TASK_ID,
        "status": "AGREED",
        "currentRound": 3,
        "maxRounds": 5,
        "initialAmountUsdc": amount_usdc,
        "currentAmountUsdc": amount_usdc,
        "currentTerms": terms.model_dump(by_alias=True, mode="json"),
        "deliverableSummary": "reel 1개",
        "workItems": [
            {
                "format": "reel",
                "count": 1,
                "dueDate": "2026-08-17",
                "description": "제품 사용감과 #ad 표기가 포함된 인스타그램 릴스 1개",
            }
        ],
        "createdAt": now,
        "updatedAt": now,
    }
    agreement = {
        "agreementId": AGREEMENT_ID,
        "negotiationId": NEGOTIATION_ID,
        "taskId": TASK_ID,
        "artifactId": ARTIFACT_ID,
        "promotionId": PROMOTION_ID,
        "promotionTitle": promotion["title"],
        "productName": promotion["productName"],
        "brandId": BRAND_ID,
        "brandAgentId": BRAND_AGENT_ID,
        "creatorId": CREATOR_ID,
        "creatorAgentId": CREATOR_AGENT_ID,
        "creatorDisplayName": creator["displayName"],
        "terms": terms.model_dump(by_alias=True, mode="json"),
        "workItems": negotiation["workItems"],
        "deliverableSummary": negotiation["deliverableSummary"],
        "currentAmountUsdc": amount_usdc,
        "promotionSnapshot": {
            "promotionId": PROMOTION_ID,
            "title": promotion["title"],
            "productName": promotion["productName"],
            "category": promotion["category"],
            "objective": promotion["objective"],
        },
        "creatorSnapshot": {
            "creatorId": CREATOR_ID,
            "creatorAgentId": CREATOR_AGENT_ID,
            "displayName": creator["displayName"],
            "categories": creator["categories"],
            "completedDealCount": creator["completedDealCount"],
        },
        "canonicalTermsJson": canonical_terms,
        "termsHash": terms_hash_value,
        "hashAlgorithm": "sha256",
        "hashVersion": "knot.agreement-terms.v1",
        "status": "FUNDING_REQUIRED",
        "brandAuthority": brand_wallet,
        "creatorDestination": creator_wallet,
        "escrowId": None,
        "fundingTransactionSignature": None,
        "createdAt": now,
        "updatedAt": now,
    }
    milestone = {
        "milestoneId": MILESTONE_ID,
        "agreementId": AGREEMENT_ID,
        "title": "릴스 업로드 및 조건 검증",
        "amountUsdc": str(amount_usdc),
        "amountBaseUnits": str(milestone_amount),
        "releasePct": 100,
        "status": "PENDING",
        "evidence": {},
        "verificationResult": {},
        "releaseTransactionSignature": None,
        "releasedAt": None,
        "createdAt": now,
        "updatedAt": now,
    }
    payment_event = {
        "eventId": PAYMENT_EVENT_ID,
        "agentId": BRAND_AGENT_ID,
        "promotionId": PROMOTION_ID,
        "matchRunId": MATCH_RUN_ID,
        "candidateId": CREATOR_ID,
        "purpose": "CREATOR_VERIFICATION",
        "provider": "PAYSH",
        "protocol": "X402_OR_MPP",
        "resourceId": "",
        "quotedAmountUsdc": "0",
        "paidAmountUsdc": "0",
        "status": "SKIPPED",
        "skipReason": "PAYSH_RESOURCE_ID is not configured for this devnet seed.",
        "paymentReceipt": {},
        "responseSummary": {},
        "createdAt": now,
    }
    message_documents = _negotiation_messages(amount_usdc, terms_hash_value, now)
    creator_model = CreatorProfile.model_validate(creator)
    creator_discovery = build_creator_discovery_projection(
        creator_model,
        creator_agent,
        updated_at=now,
    )
    registry_entry = creator_agent_registry_entry(creator_agent, updated_at=now)

    documents: dict[str, dict[str, object]] = {
        FirestorePaths.user(BRAND_UID): brand_user,
        FirestorePaths.user(CREATOR_UID): creator_user,
        FirestorePaths.brand(BRAND_ID): brand,
        FirestorePaths.creator_profile(CREATOR_ID): creator,
        FirestorePaths.agent(BRAND_AGENT_ID): brand_agent,
        FirestorePaths.agent(CREATOR_AGENT_ID): creator_agent,
        FirestorePaths.agent_policy(CREATOR_AGENT_ID): creator_policy,
        FirestorePaths.creator_discovery_profile(CREATOR_ID): creator_discovery,
        FirestorePaths.agent_registry_entry(CREATOR_AGENT_ID): registry_entry,
        FirestorePaths.promotion(PROMOTION_ID): promotion,
        FirestorePaths.match_run(MATCH_RUN_ID): match_run,
        FirestorePaths.match_candidate(MATCH_RUN_ID, CREATOR_ID): match_candidate,
        FirestorePaths.negotiation(NEGOTIATION_ID): negotiation,
        FirestorePaths.agreement(AGREEMENT_ID): agreement,
        FirestorePaths.milestone(AGREEMENT_ID, MILESTONE_ID): milestone,
        FirestorePaths.agent_payment_event(PAYMENT_EVENT_ID): payment_event,
    }
    documents.update(message_documents)
    return documents


def seed_documents(repository: KnotRepository, documents: dict[str, dict[str, object]]) -> None:
    for path, document in documents.items():
        repository.save_raw_document(path, document)


def _agreement_terms(amount_usdc: int) -> AgreementTerms:
    return AgreementTerms.model_validate(
        {
            "compensation": {
                "structure": "flat",
                "baseAmountUsdc": amount_usdc,
                "performancePct": 0,
            },
            "deliverables": [
                {
                    "format": "reel",
                    "count": 1,
                    "postWindow": {"start": "2026-08-10", "end": "2026-08-17"},
                    "revisionRounds": 1,
                }
            ],
            "usageRights": "organicOnly",
            "milestones": [
                {
                    "id": MILESTONE_ID,
                    "trigger": "POST_VERIFIED",
                    "releasePct": 100,
                }
            ],
            "constraints": {
                "requiredDisclosures": ["#ad", "#sponsored"],
                "prohibitedClaims": ["의학적 치료 효과"],
                "exclusivityDays": 0,
            },
        }
    )


def _negotiation_messages(
    amount_usdc: int,
    terms_hash_value: str,
    now: str,
) -> dict[str, dict[str, object]]:
    messages = [
        (
            "message-devnet-001",
            1,
            "brand_agent",
            "OFFER",
            {
                "type": "OFFER",
                "summary": (
                    "릴스 1개, organicOnly 사용권, "
                    f"총액 {amount_usdc} USDC 조건으로 제안합니다."
                ),
                "amountUsdc": amount_usdc,
                "deliverables": [{"format": "reel", "count": 1}],
            },
        ),
        (
            "message-devnet-002",
            2,
            "creator_agent",
            "COUNTER",
            {
                "type": "COUNTER",
                "summary": "마감은 8월 17일이면 가능하고, 필수 문구는 #ad와 #sponsored까지 수용합니다.",
                "amountUsdc": amount_usdc,
                "requestedChanges": ["의학적 치료 효과 표현 금지", "수정 1회 제한"],
            },
        ),
        (
            "message-devnet-003",
            3,
            "brand_agent",
            "ACCEPT",
            {
                "type": "ACCEPT",
                "summary": "금지 문구와 수정 1회 조건을 수용하고 Agreement를 생성합니다.",
                "agreementId": AGREEMENT_ID,
                "termsHash": terms_hash_value,
            },
        ),
    ]
    documents: dict[str, dict[str, object]] = {}
    for message_id, sequence, role, message_type, payload in messages:
        documents[FirestorePaths.negotiation_message(NEGOTIATION_ID, message_id)] = {
            "messageId": message_id,
            "negotiationId": NEGOTIATION_ID,
            "contextId": f"context-{NEGOTIATION_ID}",
            "taskId": TASK_ID,
            "role": role,
            "sequence": sequence,
            "payload": payload,
            "a2aMessage": {
                "messageId": message_id,
                "kind": "message",
                "role": "agent",
                "parts": [{"kind": "data", "data": payload}],
            },
            "createdAt": now,
        }
    return documents


def _firestore_client(project: str | None):
    try:
        from google.cloud import firestore
    except ImportError as exc:
        raise SystemExit(
            "google-cloud-firestore is not installed. Run backend dependency install first."
        ) from exc
    return firestore.Client(project=project)


def _create_or_update_auth_users(project: str | None, password: str) -> None:
    if len(password) < 6:
        raise SystemExit("Firebase Auth demo password must be at least 6 characters.")
    try:
        import firebase_admin
        from firebase_admin import auth, credentials
    except ImportError as exc:
        raise SystemExit(
            "firebase-admin is not installed. Run backend dependency install first."
        ) from exc

    if not firebase_admin._apps:
        firebase_admin.initialize_app(credentials.ApplicationDefault(), {"projectId": project})

    users = [
        {
            "uid": BRAND_UID,
            "email": "t1@knot.com",
            "display_name": "KNOT Devnet Brand",
        },
        {
            "uid": CREATOR_UID,
            "email": "c1@knot.com",
            "display_name": "KNOT Devnet Creator",
        },
    ]
    for user in users:
        try:
            auth.update_user(
                user["uid"],
                email=user["email"],
                password=password,
                display_name=user["display_name"],
                email_verified=True,
                disabled=False,
            )
            print(f"Updated Firebase Auth user {user['email']}.")
        except auth.UserNotFoundError:
            try:
                auth.create_user(
                    uid=user["uid"],
                    email=user["email"],
                    password=password,
                    display_name=user["display_name"],
                    email_verified=True,
                    disabled=False,
                )
                print(f"Created Firebase Auth user {user['email']}.")
            except auth.EmailAlreadyExistsError:
                existing = auth.get_user_by_email(user["email"])
                auth.update_user(
                    existing.uid,
                    password=password,
                    display_name=user["display_name"],
                    email_verified=True,
                    disabled=False,
                )
                print(
                    f"Updated existing Firebase Auth user {user['email']} "
                    f"with uid {existing.uid}."
                )


def _assert_safe_firestore_seed(project: str | None, confirm: str) -> None:
    expected_project = os.getenv("DEMO_PROJECT_ID", DEFAULT_PROJECT_ID)
    if os.getenv("NODE_ENV") == "production":
        raise SystemExit("Refusing to seed devnet demo data when NODE_ENV=production.")
    if os.getenv("ALLOW_DEVNET_DEMO_SEED") != "true":
        raise SystemExit("Set ALLOW_DEVNET_DEMO_SEED=true to seed Firestore.")
    if not project or project != expected_project:
        raise SystemExit("Firestore seed requires --project to match DEMO_PROJECT_ID.")
    if project in {"knot-prod", "production", "prod"}:
        raise SystemExit("Refusing to seed a production-looking project.")
    if confirm != "SEED_KNOT_DEVNET_PHANTOM_DEMO":
        raise SystemExit("Pass --confirm=SEED_KNOT_DEVNET_PHANTOM_DEMO.")


def _print_summary(
    headline: str,
    documents: dict[str, dict[str, object]],
    amount_usdc: int,
) -> None:
    print(headline)
    print(f"Documents: {len(documents)}")
    print("Brand login: t1@knot.com / 000000")
    print("Creator login: c1@knot.com / 000000")
    brand = documents[FirestorePaths.brand(BRAND_ID)]
    creator = documents[FirestorePaths.creator_profile(CREATOR_ID)]
    print(f"Brand wallet: {brand['walletAddress']}")
    print(f"Creator wallet: {creator['walletAddress']}")
    print(f"Agreement: {AGREEMENT_ID}")
    print(f"Negotiation: {NEGOTIATION_ID}")
    print(f"Escrow amount: {amount_usdc} devnet USDC")
    print(f"USDC mint: {DEVNET_USDC_MINT}")
    print("Brand needs devnet USDC in addition to SOL before Phantom funding can succeed.")


def _default_project_id() -> str | None:
    return os.getenv("GOOGLE_CLOUD_PROJECT") or os.getenv("GCP_PROJECT_ID") or DEFAULT_PROJECT_ID


def _now() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


if __name__ == "__main__":
    raise SystemExit(main())
