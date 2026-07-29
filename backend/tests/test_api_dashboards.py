import base64
import json
from datetime import UTC, date, datetime

from fastapi.testclient import TestClient

from apps.api.main import create_app
from libs.domain.models import (
    Deliverable,
    MoneyBudget,
    PostingWindow,
    Promotion,
    PromotionAutonomy,
    PromotionConstraints,
    UsageRights,
)
from libs.repositories.firestore_paths import FirestorePaths
from libs.repositories.seed import seed_demo_repository
from libs.repositories.store import InMemoryDocumentStore, KnotRepository
from libs.settings.config import Settings


def client_and_repository() -> tuple[TestClient, KnotRepository]:
    repository = KnotRepository(InMemoryDocumentStore())
    settings = Settings(auth_mode="emulator", firebase_project_id="knot-dev-503505")
    return TestClient(create_app(repository=repository, settings=settings)), repository


def auth_headers(uid: str, email: str) -> dict[str, str]:
    header = _b64({"alg": "none", "typ": "JWT"})
    payload = _b64({"sub": uid, "user_id": uid, "email": email, "name": uid})
    return {"Authorization": f"Bearer {header}.{payload}."}


def _b64(payload: dict[str, object]) -> str:
    encoded = base64.urlsafe_b64encode(json.dumps(payload).encode("utf-8")).decode("ascii")
    return encoded.rstrip("=")


def complete_brand(client: TestClient, uid: str) -> dict[str, str]:
    headers = auth_headers(uid, f"{uid}@example.com")
    client.get("/api/v1/me", headers=headers)
    client.post(
        "/api/v1/me/role",
        headers={**headers, "Idempotency-Key": f"{uid}-role"},
        json={"role": "BRAND"},
    )
    response = client.post(
        "/api/v1/me/brand-profile",
        headers={**headers, "Idempotency-Key": f"{uid}-profile"},
        json={
            "brandName": "Brand One",
            "websiteUrl": "https://brand.example",
            "categories": ["beauty", "fashion"],
            "customCategory": "clean skincare",
            "targetAudience": "skincare shoppers",
            "restrictedClaims": ["medical cure"],
        },
    )
    brand_id = response.json()["data"]["brand"]["brandId"]
    return {"Authorization": headers["Authorization"], "brandId": brand_id}


def complete_creator(client: TestClient, uid: str) -> dict[str, str]:
    headers = auth_headers(uid, f"{uid}@example.com")
    client.get("/api/v1/me", headers=headers)
    client.post(
        "/api/v1/me/role",
        headers={**headers, "Idempotency-Key": f"{uid}-role"},
        json={"role": "CREATOR"},
    )
    response = client.post(
        "/api/v1/me/creator-profile",
        headers={**headers, "Idempotency-Key": f"{uid}-profile"},
        json={
            "creatorName": "Creator One",
            "snsUrl": "https://instagram.com/creator.one",
            "categories": ["beauty"],
            "minimumUsdc": 500,
            "blockedDomains": ["담배"],
            "preferredContent": ["Instagram Reels"],
            "walletAddress": "creator-wallet",
        },
    )
    data = response.json()["data"]
    return {
        "Authorization": headers["Authorization"],
        "creatorId": data["creator"]["creatorId"],
        "agentId": data["account"]["agentId"],
    }


def test_brand_dashboard_filters_promotions_by_authenticated_brand() -> None:
    client, repository = client_and_repository()
    brand = complete_brand(client, "brand-owner")
    other = complete_brand(client, "other-brand")
    repository.save_promotion(_promotion("owned-promotion", brand["brandId"], "Owned"))
    repository.save_promotion(_promotion("other-promotion", other["brandId"], "Other"))

    response = client.get(
        "/api/v1/brand/dashboard",
        headers={"Authorization": brand["Authorization"]},
    )

    assert response.status_code == 200
    dashboard = response.json()["data"]["dashboard"]
    assert [item["promotionId"] for item in dashboard["activePromotions"]] == [
        "owned-promotion"
    ]
    assert dashboard["summary"]["activePromotions"] == 1


def test_creator_dashboard_filters_by_authenticated_creator_agent() -> None:
    client, repository = client_and_repository()
    creator = complete_creator(client, "creator-owner")
    other = complete_creator(client, "other-creator")
    repository.save_raw_document(
        FirestorePaths.negotiation("negotiation-owned"),
        {
            "negotiationId": "negotiation-owned",
            "promotionId": "promotion-owned",
            "creatorAgentId": creator["agentId"],
            "status": "OFFERED",
            "currentRound": 1,
            "createdAt": "2026-07-27T00:00:00Z",
            "updatedAt": "2026-07-27T00:00:00Z",
        },
    )
    repository.save_raw_document(
        FirestorePaths.negotiation("negotiation-other"),
        {
            "negotiationId": "negotiation-other",
            "promotionId": "promotion-other",
            "creatorAgentId": other["agentId"],
            "status": "OFFERED",
            "currentRound": 1,
            "createdAt": "2026-07-27T00:00:00Z",
            "updatedAt": "2026-07-27T00:00:00Z",
        },
    )

    response = client.get(
        "/api/v1/creator/dashboard",
        headers={"Authorization": creator["Authorization"]},
    )

    assert response.status_code == 200
    offers = response.json()["data"]["dashboard"]["offers"]
    assert [offer["negotiationId"] for offer in offers] == ["negotiation-owned"]


def test_creator_can_toggle_offer_availability() -> None:
    client, repository = client_and_repository()
    creator = complete_creator(client, "creator-availability")

    on_response = client.post(
        "/api/v1/creator/availability",
        headers={"Authorization": creator["Authorization"]},
        json={"acceptingOffers": True},
    )
    off_response = client.post(
        "/api/v1/creator/availability",
        headers={"Authorization": creator["Authorization"]},
        json={"acceptingOffers": False},
    )

    assert on_response.status_code == 200
    assert on_response.json()["data"]["creator"]["availability"] == "RECEIVING"
    assert off_response.status_code == 200
    creator_doc = repository.get_raw_document(
        FirestorePaths.creator_profile(creator["creatorId"])
    )
    assert creator_doc is not None
    assert creator_doc["receivingOffers"] is False
    assert creator_doc["acceptingOffers"] is False
    assert creator_doc["availability"] == "OFFLINE"


def test_seeded_demo_dashboards_show_expected_agreements_and_payouts() -> None:
    repository = KnotRepository(InMemoryDocumentStore())
    seed_demo_repository(repository, include_business_flow=True)
    settings = Settings(auth_mode="emulator", firebase_project_id="knot-dev-503505")
    client = TestClient(create_app(repository=repository, settings=settings))

    brand = client.get(
        "/api/v1/brand/dashboard",
        headers=auth_headers("user-brand-1", "test1@knot.demo"),
    )
    creator_one = client.get(
        "/api/v1/creator/dashboard",
        headers=auth_headers("user-creator-1", "test3@knot.demo"),
    )
    creator_two = client.get(
        "/api/v1/creator/dashboard",
        headers=auth_headers("user-creator-2", "test4@knot.demo"),
    )

    assert brand.status_code == 200
    brand_dashboard = brand.json()["data"]["dashboard"]
    assert brand_dashboard["summary"]["activePromotions"] == 1
    assert brand_dashboard["summary"]["agreements"] == 2
    assert len(brand_dashboard["contractedCreators"]) == 2
    assert len(brand_dashboard["recentAgentActivity"]) >= 2

    assert creator_one.status_code == 200
    creator_one_summary = creator_one.json()["data"]["dashboard"]["summary"]
    assert creator_one_summary["agentNegotiations"] == 1
    assert creator_one_summary["releasedPayoutBaseUnits"] == "500000000"
    assert creator_one_summary["availablePayoutBaseUnits"] == "0"
    assert creator_one_summary["pendingPayoutBaseUnits"] == "0"

    assert creator_two.status_code == 200
    creator_two_summary = creator_two.json()["data"]["dashboard"]["summary"]
    assert creator_two_summary["agentNegotiations"] == 2
    assert creator_two_summary["releasedPayoutBaseUnits"] == "0"
    assert creator_two_summary["availablePayoutBaseUnits"] == "0"
    assert creator_two_summary["pendingPayoutBaseUnits"] == "850000000"


def test_dashboard_wrong_role_and_missing_profile_states() -> None:
    client, repository = client_and_repository()
    creator = complete_creator(client, "creator-owner")
    missing = complete_brand(client, "missing-brand")
    user = repository.get_raw_document(FirestorePaths.user("missing-brand"))
    assert user is not None
    repository.save_raw_document(
        FirestorePaths.user("missing-brand"),
        {**user, "brandId": "missing"},
    )

    forbidden = client.get(
        "/api/v1/brand/dashboard",
        headers={"Authorization": creator["Authorization"]},
    )
    not_found = client.get(
        "/api/v1/brand/dashboard",
        headers={"Authorization": missing["Authorization"]},
    )

    assert forbidden.status_code == 403
    assert forbidden.json()["detail"]["code"] == "FORBIDDEN"
    assert not_found.status_code == 404


def _promotion(promotion_id: str, brand_id: str, title: str) -> Promotion:
    now = datetime(2026, 7, 27, tzinfo=UTC)
    return Promotion(
        promotionId=promotion_id,
        brandId=brand_id,
        brandAgentId=f"agent-{brand_id}",
        title=title,
        objective="awareness",
        category="beauty",
        targetAudience=["skincare"],
        budget=MoneyBudget(totalUsdc=1000, maxPerCreatorUsdc=500),
        deliverables=[Deliverable(format="reel", count=1)],
        postingWindow=PostingWindow(start=date(2026, 8, 1), end=date(2026, 8, 10)),
        usageRights=UsageRights.PAID_BOOST_30D,
        constraints=PromotionConstraints(requiredCategories=["beauty"]),
        autonomy=PromotionAutonomy(maxNegotiationRounds=3, autoEscrow=False, autoRelease=False),
        status="ACTIVE",
        createdAt=now,
        updatedAt=now,
    )
