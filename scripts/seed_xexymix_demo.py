import argparse
import sys
from pathlib import Path

# ruff: noqa: I001

REPO_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = REPO_ROOT / "backend"
SCRIPTS_ROOT = REPO_ROOT / "scripts"
sys.path.insert(0, str(BACKEND_ROOT))
sys.path.insert(0, str(SCRIPTS_ROOT))

import seed_devnet_phantom_demo as base
from libs.a2a.registry import creator_agent_registry_entry
from libs.domain.discovery import build_creator_discovery_projection
from libs.domain.models import CreatorProfile
from libs.repositories.firestore_adapter import FirestoreDocumentStore
from libs.repositories.firestore_paths import FirestorePaths
from libs.repositories.store import InMemoryDocumentStore, KnotRepository


PRODUCT_URL = (
    "https://www.xexymix.com/m/product.html?branduid=2067442&xcode=062&mcode=005"
    "&scode=002&type=Y&sort=manual&current_category=062005002&search=&GfDT=aGl3UQ%3D%3D"
)

PROMOTION_ID = "promotion-xexymix-devnet"
MATCH_RUN_ID = "match-run-xexymix-devnet"
NEGOTIATION_ID = "negotiation-xexymix-devnet"
TASK_ID = "task-xexymix-devnet"
ARTIFACT_ID = "artifact-xexymix-devnet"
AGREEMENT_ID = "agreement-xexymix-devnet"
PAYMENT_EVENT_ID = "agent-payment-xexymix-skipped"


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Seed XEXYMIX sponsorship demo data onto the existing t1/c1 devnet accounts."
    )
    parser.add_argument("--target", choices=["memory", "firestore"], default="memory")
    parser.add_argument("--project", default=base._default_project_id())
    parser.add_argument("--brand-wallet", default=base.DEFAULT_BRAND_WALLET)
    parser.add_argument("--creator-wallet", default=base.DEFAULT_CREATOR_WALLET)
    parser.add_argument("--amount-usdc", type=int, default=5)
    parser.add_argument("--initial-offer-usdc", type=int, default=3)
    parser.add_argument(
        "--confirm",
        default="",
        help="Required for Firestore writes: --confirm=SEED_KNOT_DEVNET_PHANTOM_DEMO",
    )
    args = parser.parse_args()

    if args.amount_usdc < 1:
        raise SystemExit("--amount-usdc must be at least 1.")
    if args.initial_offer_usdc < 1:
        raise SystemExit("--initial-offer-usdc must be at least 1.")
    if args.initial_offer_usdc > args.amount_usdc:
        raise SystemExit("--initial-offer-usdc must be less than or equal to --amount-usdc.")

    _patch_base_ids()
    documents = base.build_documents(
        amount_usdc=args.amount_usdc,
        brand_wallet=args.brand_wallet,
        creator_wallet=args.creator_wallet,
    )
    _apply_xexymix_demo(documents, args.amount_usdc, args.initial_offer_usdc)

    if args.target == "firestore":
        base._assert_safe_firestore_seed(args.project, args.confirm)
        store = FirestoreDocumentStore(base._firestore_client(args.project))
        base.seed_documents(KnotRepository(store), documents)
        _print_summary("Seeded Firestore XEXYMIX demo data.", documents, args)
        return 0

    memory_store = InMemoryDocumentStore()
    base.seed_documents(KnotRepository(memory_store), documents)
    _print_summary("Loaded XEXYMIX demo data into memory.", documents, args)
    for path in memory_store.paths():
        print(path)
    return 0


def _patch_base_ids() -> None:
    base.PROMOTION_ID = PROMOTION_ID
    base.MATCH_RUN_ID = MATCH_RUN_ID
    base.NEGOTIATION_ID = NEGOTIATION_ID
    base.TASK_ID = TASK_ID
    base.ARTIFACT_ID = ARTIFACT_ID
    base.AGREEMENT_ID = AGREEMENT_ID
    base.PAYMENT_EVENT_ID = PAYMENT_EVENT_ID


def _apply_xexymix_demo(
    documents: dict[str, dict[str, object]],
    amount_usdc: int,
    initial_offer_usdc: int,
) -> None:
    now = base._now()
    brand_path = FirestorePaths.brand(base.BRAND_ID)
    creator_path = FirestorePaths.creator_profile(base.CREATOR_ID)
    brand_agent_path = FirestorePaths.agent(base.BRAND_AGENT_ID)
    creator_agent_path = FirestorePaths.agent(base.CREATOR_AGENT_ID)
    promotion_path = FirestorePaths.promotion(PROMOTION_ID)
    candidate_path = FirestorePaths.match_candidate(MATCH_RUN_ID, base.CREATOR_ID)
    negotiation_path = FirestorePaths.negotiation(NEGOTIATION_ID)
    agreement_path = FirestorePaths.agreement(AGREEMENT_ID)
    milestone_path = FirestorePaths.milestone(AGREEMENT_ID, base.MILESTONE_ID)
    policy_path = FirestorePaths.agent_policy(base.CREATOR_AGENT_ID)

    documents[FirestorePaths.user(base.BRAND_UID)].update(
        {
            "displayName": "XEXYMIX Brand Manager",
            "brandId": base.BRAND_ID,
            "agentId": base.BRAND_AGENT_ID,
            "updatedAt": now,
        }
    )
    documents[FirestorePaths.user(base.CREATOR_UID)].update(
        {
            "displayName": "민지핏로그",
            "creatorId": base.CREATOR_ID,
            "agentId": base.CREATOR_AGENT_ID,
            "updatedAt": now,
        }
    )

    documents[brand_path].update(
        {
            "displayName": "젝시믹스 XEXYMIX",
            "brandName": "젝시믹스 XEXYMIX",
            "name": "젝시믹스 XEXYMIX",
            "category": "fitness",
            "categories": ["fitness", "fashion"],
            "productName": "XEXYMIX 애슬레저 퍼포먼스 레깅스",
            "productUrl": PRODUCT_URL,
            "websiteUrl": "https://www.xexymix.com",
            "summary": "운동과 일상을 연결하는 K-애슬레저 브랜드",
            "targetAudience": "20-34 여성, 필라테스/러닝/헬스와 데일리 애슬레저룩 관심 고객",
            "restrictedClaims": ["체형 교정 효과 단정", "의학적 효능 표현", "무검수 게시"],
            "updatedAt": now,
        }
    )
    documents[creator_path].update(
        {
            "displayName": "민지핏로그",
            "categories": ["fitness", "fashion", "lifestyle"],
            "prohibitedIndustries": ["tobacco", "gambling", "alcohol"],
            "supportedDeliverableFormats": ["reel", "short", "post"],
            "minDaysToPost": 5,
            "completedDealCount": 18,
            "rateCard": {"minBaseUsdc": amount_usdc, "maxBaseUsdc": max(amount_usdc, 8)},
            "publicRateBand": {
                "currency": "USDC",
                "minimum": amount_usdc,
                "maximum": max(amount_usdc, 8),
            },
            "socialLinks": [
                {"platform": "instagram", "url": "https://www.instagram.com/minji.fitlog"}
            ],
            "updatedAt": now,
        }
    )
    documents[brand_agent_path].update(
        {
            "displayName": "XEXYMIX Brand Agent",
            "service": "knot-api",
            "updatedAt": now,
        }
    )
    documents[creator_agent_path].update(
        {
            "displayName": "민지핏로그 Creator Agent",
            "updatedAt": now,
        }
    )
    documents[policy_path].update(
        {
            "creator": {
                "minBaseUsdc": amount_usdc,
                "blockedIndustries": ["tobacco", "gambling", "alcohol"],
                "maxDeliverablesPerMonth": 4,
                "minDaysToPost": 5,
                "allowedUsageRights": ["organicOnly", "paidBoost30d"],
                "maxRevisionRounds": 1,
                "maxExclusivityDays": 0,
            },
            "preferredContent": ["릴스", "숏츠", "운동 루틴", "착용 후기"],
            "updatedAt": now,
        }
    )

    documents[promotion_path].update(
        {
            "title": "XEXYMIX 애슬레저 퍼포먼스 레깅스 협찬 프로젝트",
            "productName": "XEXYMIX 애슬레저 퍼포먼스 레깅스",
            "productUrl": PRODUCT_URL,
            "objective": (
                "제품을 직접 착용한 운동 루틴 중심의 릴스 콘텐츠 제작. "
                "착용감, 핏, 움직임, 데일리 활용성을 자연스럽게 보여준다."
            ),
            "category": "fitness",
            "categories": ["fitness"],
            "targetAudience": [
                "20-34 여성",
                "필라테스/러닝/헬스 입문자",
                "애슬레저 데일리룩 관심 고객",
            ],
            "targetAudienceText": (
                "20-34 여성, 필라테스/러닝/헬스 입문자, 애슬레저 데일리룩 관심 고객"
            ),
            "budget": {"totalUsdc": amount_usdc * 4, "maxPerCreatorUsdc": max(amount_usdc, 8)},
            "totalBudget": amount_usdc * 4,
            "initialOffer": initial_offer_usdc,
            "maximumPerCreator": max(amount_usdc, 8),
            "autoAcceptCeiling": max(amount_usdc, 8),
            "deliverables": [{"format": "reel", "count": 1}],
            "postingWindow": {"start": "2026-08-10", "end": "2026-08-18"},
            "deadline": "2026-08-18",
            "usageRights": "organicOnly",
            "constraints": {
                "requiredDisclosures": ["#ad", "#sponsored"],
                "prohibitedClaims": ["체형 교정 효과 단정", "의학적 효능 표현", "비교 비방"],
                "requiredCategories": ["fitness"],
                "prohibitedCategories": [],
                "maxPerformancePct": 0,
            },
            "moodTags": ["운동 루틴", "착용 후기", "데일리 애슬레저"],
            "updatedAt": now,
        }
    )
    documents[candidate_path].update(
        {
            "explanation": (
                "피트니스와 애슬레저 콘텐츠 적합도가 높고 릴스 제작 조건을 만족합니다."
            ),
            "overallScore": 0.94,
            "updatedAt": now,
        }
    )
    documents[negotiation_path].update(
        {
            "promotionTitle": documents[promotion_path]["title"],
            "productName": documents[promotion_path]["productName"],
            "creatorDisplayName": documents[creator_path]["displayName"],
            "initialAmountUsdc": initial_offer_usdc,
            "currentAmountUsdc": amount_usdc,
            "deliverableSummary": "릴스 1개",
            "workItems": [
                {
                    "format": "reel",
                    "count": 1,
                    "dueDate": "2026-08-18",
                    "description": (
                        "XEXYMIX 레깅스를 착용한 운동 루틴 릴스 1개. "
                        "#ad 표기와 착용감/핏 설명 포함."
                    ),
                }
            ],
            "updatedAt": now,
        }
    )
    documents[agreement_path].update(
        {
            "promotionTitle": documents[promotion_path]["title"],
            "productName": documents[promotion_path]["productName"],
            "creatorDisplayName": documents[creator_path]["displayName"],
            "workItems": documents[negotiation_path]["workItems"],
            "deliverableSummary": "릴스 1개",
            "currentAmountUsdc": amount_usdc,
            "promotionSnapshot": {
                "promotionId": PROMOTION_ID,
                "title": documents[promotion_path]["title"],
                "productName": documents[promotion_path]["productName"],
                "category": "fitness",
                "objective": documents[promotion_path]["objective"],
            },
            "creatorSnapshot": {
                "creatorId": base.CREATOR_ID,
                "creatorAgentId": base.CREATOR_AGENT_ID,
                "displayName": documents[creator_path]["displayName"],
                "categories": documents[creator_path]["categories"],
                "completedDealCount": documents[creator_path]["completedDealCount"],
            },
            "updatedAt": now,
        }
    )
    documents[milestone_path].update(
        {
            "title": "릴스 업로드 및 협찬 표기 검증",
            "updatedAt": now,
        }
    )
    _replace_negotiation_messages(documents, amount_usdc, initial_offer_usdc)

    creator_model = CreatorProfile.model_validate(documents[creator_path])
    documents[FirestorePaths.creator_discovery_profile(base.CREATOR_ID)] = (
        build_creator_discovery_projection(
            creator_model,
            documents[creator_agent_path],
            updated_at=now,
        )
    )
    documents[FirestorePaths.agent_registry_entry(base.CREATOR_AGENT_ID)] = (
        creator_agent_registry_entry(documents[creator_agent_path], updated_at=now)
    )


def _replace_negotiation_messages(
    documents: dict[str, dict[str, object]],
    amount_usdc: int,
    initial_offer_usdc: int,
) -> None:
    now = base._now()
    terms_hash_value = str(documents[FirestorePaths.agreement(AGREEMENT_ID)]["termsHash"])
    message_prefix = f"negotiations/{NEGOTIATION_ID}/messages/"
    for path in list(documents):
        if path.startswith(message_prefix):
            del documents[path]
    messages = [
        (
            "message-xexymix-001",
            1,
            "brand_agent",
            {
                "type": "OFFER",
                "summary": (
                    "XEXYMIX 레깅스 착용 운동 루틴 릴스 1개를 "
                    f"{initial_offer_usdc} USDC 조건으로 제안합니다."
                ),
                "amountUsdc": initial_offer_usdc,
                "deliverables": [{"format": "reel", "count": 1}],
            },
        ),
        (
            "message-xexymix-002",
            2,
            "creator_agent",
            {
                "type": "COUNTER",
                "summary": (
                    "릴스 촬영과 착용 후기 구성은 가능하지만, 최소 조건은 "
                    f"{amount_usdc} USDC입니다."
                ),
                "amountUsdc": amount_usdc,
                "requestedChanges": ["보상 금액 상향", "수정 1회 제한", "의학적 효능 표현 제외"],
            },
        ),
        (
            "message-xexymix-003",
            3,
            "brand_agent",
            {
                "type": "ACCEPT",
                "summary": (
                    f"{amount_usdc} USDC counter가 Brand 정책 한도 이내라 자동 수락합니다."
                ),
                "agreementId": AGREEMENT_ID,
                "termsHash": terms_hash_value,
            },
        ),
    ]
    for message_id, sequence, role, payload in messages:
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


def _print_summary(
    headline: str,
    documents: dict[str, dict[str, object]],
    args: argparse.Namespace,
) -> None:
    print(headline)
    print(f"Documents: {len(documents)}")
    print("Brand login: t1@knot.com / 000000")
    print("Creator login: c1@knot.com / 000000")
    print(f"Promotion: {PROMOTION_ID}")
    print(f"Agreement: {AGREEMENT_ID}")
    print(f"Initial offer: {args.initial_offer_usdc} devnet USDC")
    print(f"Counter / Agreement amount: {args.amount_usdc} devnet USDC")
    print(f"Product URL: {PRODUCT_URL}")
    print(f"Brand wallet: {documents[FirestorePaths.brand(base.BRAND_ID)]['walletAddress']}")
    print(
        f"Creator wallet: "
        f"{documents[FirestorePaths.creator_profile(base.CREATOR_ID)]['walletAddress']}"
    )


if __name__ == "__main__":
    raise SystemExit(main())
