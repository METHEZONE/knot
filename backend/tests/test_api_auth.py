import base64
import json

from fastapi.testclient import TestClient

from apps.api.main import create_app
from libs.repositories.firestore_paths import FirestorePaths
from libs.repositories.store import InMemoryDocumentStore, KnotRepository
from libs.settings.config import Settings


def client_and_repository() -> tuple[TestClient, KnotRepository]:
    repository = KnotRepository(InMemoryDocumentStore())
    settings = Settings(auth_mode="emulator", firebase_project_id="knot-dev-503505")
    return TestClient(create_app(repository=repository, settings=settings)), repository


def auth_headers(uid: str = "firebase-uid-1", email: str = "user@example.com") -> dict[str, str]:
    return {"Authorization": f"Bearer {emulator_token(uid=uid, email=email)}"}


def emulator_token(uid: str, email: str) -> str:
    header = _b64({"alg": "none", "typ": "JWT"})
    payload = _b64(
        {
            "sub": uid,
            "user_id": uid,
            "email": email,
            "name": "KNOT Tester",
            "picture": "https://example.com/avatar.png",
            "aud": "knot-dev-503505",
        }
    )
    return f"{header}.{payload}."


def _b64(payload: dict[str, object]) -> str:
    encoded = base64.urlsafe_b64encode(json.dumps(payload).encode("utf-8")).decode("ascii")
    return encoded.rstrip("=")


def test_get_me_rejects_missing_or_invalid_token() -> None:
    client, _ = client_and_repository()

    missing = client.get("/api/v1/me")
    invalid = client.get("/api/v1/me", headers={"Authorization": "Bearer not-a-jwt"})

    assert missing.status_code == 401
    assert missing.json()["detail"]["code"] == "UNAUTHENTICATED"
    assert invalid.status_code == 401
    assert invalid.json()["detail"]["code"] == "UNAUTHENTICATED"


def test_get_me_bootstraps_user_by_verified_uid_idempotently() -> None:
    client, repository = client_and_repository()

    first = client.get("/api/v1/me", headers=auth_headers()).json()["data"]
    second = client.get("/api/v1/me", headers=auth_headers()).json()["data"]

    assert first["account"]["uid"] == "firebase-uid-1"
    assert first["account"]["onboardingStatus"] == "ROLE_REQUIRED"
    assert second["account"]["uid"] == first["account"]["uid"]
    stored = repository.get_raw_document(FirestorePaths.user("firebase-uid-1"))
    assert stored is not None
    assert stored["schemaVersion"] == 2


def test_select_role_is_idempotent_and_rejects_role_change() -> None:
    client, repository = client_and_repository()
    headers = {**auth_headers(), "Idempotency-Key": "role-key-1"}

    created = client.post("/api/v1/me/role", headers=headers, json={"role": "BRAND"})
    repeated = client.post("/api/v1/me/role", headers=headers, json={"role": "BRAND"})
    conflict = client.post(
        "/api/v1/me/role",
        headers={**auth_headers(), "Idempotency-Key": "role-key-2"},
        json={"role": "CREATOR"},
    )

    assert created.status_code == 200
    assert repeated.status_code == 200
    assert conflict.status_code == 409
    user = repository.get_raw_document(FirestorePaths.user("firebase-uid-1"))
    assert user is not None
    assert user["role"] == "BRAND"
    assert user["agentId"] == "brand-agent-firebase-uid-1"


def test_brand_profile_uses_verified_uid_as_owner() -> None:
    client, repository = client_and_repository()
    headers = auth_headers(uid="brand-owner", email="brand@example.com")
    client.get("/api/v1/me", headers=headers)
    client.post(
        "/api/v1/me/role",
        headers={**headers, "Idempotency-Key": "brand-role-key"},
        json={"role": "BRAND"},
    )

    response = client.post(
        "/api/v1/me/brand-profile",
        headers={**headers, "Idempotency-Key": "brand-profile-key"},
        json={
            "brandName": "Brand One",
            "websiteUrl": "https://brand.example",
            "categories": ["beauty"],
            "customCategory": "clean skincare",
            "targetAudience": "skincare shoppers",
            "restrictedClaims": ["medical cure"],
        },
    )

    assert response.status_code == 201
    data = response.json()["data"]
    brand = data["brand"]
    account = data["account"]
    assert brand["ownerUid"] == "brand-owner"
    assert account["brandId"] == brand["brandId"]
    stored_brand = repository.get_raw_document(FirestorePaths.brand(brand["brandId"]))
    assert stored_brand is not None
    assert stored_brand["ownerUid"] == "brand-owner"


def test_brand_source_analysis_requires_brand_role_and_returns_provenance() -> None:
    client, _ = client_and_repository()
    headers = auth_headers(uid="brand-source-owner", email="brand-source@example.com")
    client.get("/api/v1/me", headers=headers)

    unauthorized = client.post(
        "/api/v1/onboarding/brand/analyze-source",
        headers=headers,
        json={"productUrl": "https://demo-skincare.example.com/spf-daily"},
    )
    assert unauthorized.status_code == 403

    client.post(
        "/api/v1/me/role",
        headers={**headers, "Idempotency-Key": "brand-source-role-key"},
        json={"role": "BRAND"},
    )
    response = client.post(
        "/api/v1/onboarding/brand/analyze-source",
        headers=headers,
        json={"productUrl": "https://demo-skincare.example.com/spf-daily"},
    )

    assert response.status_code == 200
    draft = response.json()["data"]
    assert draft["mode"] == "api"
    assert draft["product"]["name"]["value"] == "Spf Daily"
    assert draft["product"]["name"]["source"] == "USER_INPUT"
    assert "price" not in draft["product"]


def test_creator_profile_starts_with_receiving_offers_disabled() -> None:
    client, repository = client_and_repository()
    headers = auth_headers(uid="creator-owner", email="creator@example.com")
    client.get("/api/v1/me", headers=headers)
    client.post(
        "/api/v1/me/role",
        headers={**headers, "Idempotency-Key": "creator-role-key"},
        json={"role": "CREATOR"},
    )

    response = client.post(
        "/api/v1/me/creator-profile",
        headers={**headers, "Idempotency-Key": "creator-profile-key"},
        json={
            "creatorName": "Creator One",
            "snsUrl": "https://instagram.com/creator.one",
            "categories": ["beauty"],
            "minimumUsdc": 500,
            "blockedDomains": ["담배"],
            "preferredContent": ["Instagram Reels"],
        },
    )

    assert response.status_code == 201
    creator = response.json()["data"]["creator"]
    stored_creator = repository.get_raw_document(
        FirestorePaths.creator_profile(creator["creatorId"])
    )
    assert stored_creator is not None
    assert stored_creator["receivingOffers"] is False
    assert stored_creator["acceptingOffers"] is False
    assert stored_creator["availability"] == "OFFLINE"


def test_creator_profile_rejects_wrong_role() -> None:
    client, _ = client_and_repository()
    headers = auth_headers(uid="brand-owner", email="brand@example.com")
    client.get("/api/v1/me", headers=headers)
    client.post(
        "/api/v1/me/role",
        headers={**headers, "Idempotency-Key": "wrong-role-key"},
        json={"role": "BRAND"},
    )

    response = client.post(
        "/api/v1/me/creator-profile",
        headers={**headers, "Idempotency-Key": "creator-profile-key"},
        json={
            "creatorName": "Creator One",
            "snsUrl": "https://instagram.com/creator.one",
            "categories": ["beauty"],
            "minimumUsdc": 500,
            "blockedDomains": ["담배"],
            "preferredContent": ["Instagram Reels"],
        },
    )

    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "FORBIDDEN"
