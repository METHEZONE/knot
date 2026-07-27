from fastapi.testclient import TestClient

from apps.api.main import create_app
from libs.repositories.firestore_paths import FirestorePaths
from libs.repositories.store import InMemoryDocumentStore, KnotRepository
from libs.settings.config import Settings
from tests.test_api_dashboards import auth_headers


def client_and_repository() -> tuple[TestClient, KnotRepository]:
    repository = KnotRepository(InMemoryDocumentStore())
    settings = Settings(auth_mode="emulator", firebase_project_id="knot-dev-503505")
    return TestClient(create_app(repository=repository, settings=settings)), repository


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
        headers={**headers, "Idempotency-Key": f"{uid}-brand-profile"},
        json={
            "brandName": "Brand",
            "websiteUrl": "https://brand.example",
            "categories": ["beauty"],
            "targetAudience": "skincare shoppers",
            "restrictedClaims": [],
        },
    )
    return {
        "Authorization": headers["Authorization"],
        "brandId": response.json()["data"]["brand"]["brandId"],
    }


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
        headers={**headers, "Idempotency-Key": f"{uid}-creator-profile"},
        json={
            "creatorName": "Creator",
            "snsUrl": "https://instagram.com/creator",
            "categories": ["beauty"],
            "minimumUsdc": 500,
            "blockedDomains": [],
            "preferredContent": ["Instagram Reels"],
        },
    )
    account = response.json()["data"]["account"]
    return {
        "Authorization": headers["Authorization"],
        "creatorId": account["creatorId"],
        "agentId": account["agentId"],
    }


def test_brand_can_create_and_read_only_owned_promotions() -> None:
    client, _ = client_and_repository()
    brand = complete_brand(client, "brand-one")
    other = complete_brand(client, "brand-two")

    created = client.post(
        "/api/v1/brand/promotions",
        headers={
            "Authorization": brand["Authorization"],
            "Idempotency-Key": "brand-one-promotion",
        },
        json=promotion_payload("Owned promotion"),
    )
    other_created = client.post(
        "/api/v1/brand/promotions",
        headers={
            "Authorization": other["Authorization"],
            "Idempotency-Key": "brand-two-promotion",
        },
        json=promotion_payload("Other promotion"),
    )

    assert created.status_code == 201
    created_promotion = created.json()["data"]["promotion"]
    promotion_id = created_promotion["promotionId"]
    other_id = other_created.json()["data"]["promotion"]["promotionId"]
    assert created_promotion["postingWindow"] == {
        "start": "2026-08-10",
        "end": "2026-08-10",
    }

    listed = client.get(
        "/api/v1/brand/promotions",
        headers={"Authorization": brand["Authorization"]},
    )
    forbidden = client.get(
        f"/api/v1/brand/promotions/{other_id}",
        headers={"Authorization": brand["Authorization"]},
    )

    assert [item["promotionId"] for item in listed.json()["data"]["promotions"]] == [
        promotion_id
    ]
    assert forbidden.status_code == 403


def test_brand_promotion_create_is_idempotent_and_delete_is_guarded() -> None:
    client, repository = client_and_repository()
    brand = complete_brand(client, "brand-delete")
    headers = {
        "Authorization": brand["Authorization"],
        "Idempotency-Key": "brand-delete-promotion",
    }

    first = client.post(
        "/api/v1/brand/promotions",
        headers=headers,
        json=promotion_payload("Delete guard"),
    )
    second = client.post(
        "/api/v1/brand/promotions",
        headers=headers,
        json=promotion_payload("Delete guard"),
    )

    assert first.status_code == 201
    assert second.status_code == 201
    promotion_id = first.json()["data"]["promotion"]["promotionId"]
    assert second.json()["data"]["promotion"]["promotionId"] == promotion_id

    repository.save_raw_document(
        FirestorePaths.agreement("agreement-delete-guard"),
        {
            "agreementId": "agreement-delete-guard",
            "promotionId": promotion_id,
            "brandId": brand["brandId"],
            "creatorAgentId": "agent-creator-test",
            "status": "ACTIVE",
        },
    )
    blocked = client.delete(
        f"/api/v1/brand/promotions/{promotion_id}",
        headers={
            "Authorization": brand["Authorization"],
            "Idempotency-Key": "delete-blocked",
        },
    )

    assert blocked.status_code == 409


def test_brand_can_soft_delete_promotion_without_agreement() -> None:
    client, _ = client_and_repository()
    brand = complete_brand(client, "brand-soft-delete")
    created = client.post(
        "/api/v1/brand/promotions",
        headers={
            "Authorization": brand["Authorization"],
            "Idempotency-Key": "soft-delete-promotion",
        },
        json=promotion_payload("Soft delete"),
    )
    promotion_id = created.json()["data"]["promotion"]["promotionId"]

    deleted = client.delete(
        f"/api/v1/brand/promotions/{promotion_id}",
        headers={
            "Authorization": brand["Authorization"],
            "Idempotency-Key": "soft-delete-promotion-action",
        },
    )
    listed = client.get(
        "/api/v1/brand/promotions",
        headers={"Authorization": brand["Authorization"]},
    )

    assert deleted.status_code == 200
    assert deleted.json()["data"]["deleted"] is True
    assert listed.json()["data"]["promotions"] == []


def test_creator_offer_and_agreement_routes_are_participation_scoped() -> None:
    client, repository = client_and_repository()
    creator = complete_creator(client, "creator-one")
    other = complete_creator(client, "creator-two")
    repository.save_raw_document(
        FirestorePaths.negotiation("negotiation-owned"),
        {
            "negotiationId": "negotiation-owned",
            "promotionId": "promotion-owned",
            "creatorAgentId": creator["agentId"],
            "status": "OFFERED",
            "currentRound": 1,
            "currentTerms": {},
            "createdAt": "2026-07-27T00:00:00Z",
            "updatedAt": "2026-07-27T00:00:00Z",
        },
    )
    repository.save_raw_document(
        FirestorePaths.agreement("agreement-owned"),
        {
            "agreementId": "agreement-owned",
            "promotionId": "promotion-owned",
            "creatorAgentId": creator["agentId"],
            "status": "AGREED",
            "termsHash": "sha256:owned",
            "createdAt": "2026-07-27T00:00:00Z",
            "updatedAt": "2026-07-27T00:00:00Z",
        },
    )

    offer = client.get(
        "/api/v1/creator/offers/negotiation-owned",
        headers={"Authorization": creator["Authorization"]},
    )
    forbidden = client.get(
        "/api/v1/creator/offers/negotiation-owned",
        headers={"Authorization": other["Authorization"]},
    )
    agreement = client.get(
        "/api/v1/creator/agreements/agreement-owned",
        headers={"Authorization": creator["Authorization"]},
    )

    assert offer.status_code == 200
    assert forbidden.status_code == 403
    assert agreement.status_code == 200


def promotion_payload(title: str) -> dict[str, object]:
    return {
        "productName": "Product",
        "title": title,
        "objective": "awareness",
        "categories": ["beauty"],
        "targetAudience": "skincare shoppers",
        "totalBudget": 2000,
        "initialOffer": 500,
        "maximumPerCreator": 700,
        "autoAcceptCeiling": 650,
        "maximumRounds": 3,
        "deliverables": [{"format": "reel", "count": 1}],
        "usageRights": "organicOnly",
        "deadline": "2026-08-10",
        "prohibitedClaims": [],
    }
