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


def test_wallet_save_is_returned_in_current_user_context() -> None:
    client, repository = client_and_repository()
    headers = auth_headers(uid="brand-wallet-owner", email="brand-wallet@example.com")
    wallet_address = "8keJx2mcKFENHcUs4ti79aUurAHrWt8Z4XcQTnKGKks6"
    client.get("/api/v1/me", headers=headers)
    client.post(
        "/api/v1/me/role",
        headers={**headers, "Idempotency-Key": "wallet-role-key"},
        json={"role": "BRAND"},
    )
    profile = client.post(
        "/api/v1/me/brand-profile",
        headers={**headers, "Idempotency-Key": "wallet-profile-key"},
        json={
            "brandName": "Wallet Brand",
            "websiteUrl": "https://wallet.example",
            "categories": ["beauty"],
            "targetAudience": "skincare shoppers",
            "restrictedClaims": [],
        },
    ).json()["data"]

    response = client.post(
        "/api/v1/me/wallet",
        headers=headers,
        json={"walletAddress": wallet_address, "network": "devnet"},
    )
    current = client.get("/api/v1/me", headers=headers).json()["data"]

    assert response.status_code == 200
    assert response.json()["data"]["account"]["walletAddress"] == wallet_address
    assert current["account"]["walletAddress"] == wallet_address
    assert current["profileSummary"]["walletAddress"] == wallet_address
    stored_brand = repository.get_raw_document(FirestorePaths.brand(profile["brand"]["brandId"]))
    assert stored_brand is not None
    assert stored_brand["walletAddress"] == wallet_address


def test_wallet_save_rejects_non_base58_demo_value() -> None:
    client, _ = client_and_repository()
    headers = auth_headers(uid="creator-wallet-owner", email="creator-wallet@example.com")
    client.get("/api/v1/me", headers=headers)
    client.post(
        "/api/v1/me/role",
        headers={**headers, "Idempotency-Key": "creator-wallet-role-key"},
        json={"role": "CREATOR"},
    )
    client.post(
        "/api/v1/me/creator-profile",
        headers={**headers, "Idempotency-Key": "creator-wallet-profile-key"},
        json={
            "creatorName": "Creator One",
            "snsUrl": "https://instagram.com/creator.one",
            "categories": ["beauty"],
            "minimumUsdc": 300,
            "blockedDomains": [],
            "preferredContent": ["Instagram Reels"],
        },
    )

    response = client.post(
        "/api/v1/me/wallet",
        headers=headers,
        json={"walletAddress": "DemoWallet111111111111111111111111111111111", "network": "devnet"},
    )

    assert response.status_code == 422


def test_get_me_links_completed_seed_account_by_email_when_firebase_uid_differs() -> None:
    client, repository = client_and_repository()
    repository.save_raw_document(
        FirestorePaths.user("user-brand-devnet"),
        {
            "uid": "user-brand-devnet",
            "userId": "user-brand-devnet",
            "email": "t1@knot.com",
            "displayName": "KNOT Devnet Brand",
            "role": "BRAND",
            "onboardingStatus": "COMPLETED",
            "brandId": "brand-devnet-phantom",
            "agentId": "agent-brand-devnet-phantom",
            "walletAddress": "8keJx2mcKFENHcUs4ti79aUurAHrWt8Z4XcQTnKGKks6",
            "walletNetwork": "devnet",
            "status": "ACTIVE",
        },
    )
    repository.save_raw_document(
        FirestorePaths.brand("brand-devnet-phantom"),
        {
            "brandId": "brand-devnet-phantom",
            "displayName": "KNOT Devnet Brand",
            "walletAddress": "8keJx2mcKFENHcUs4ti79aUurAHrWt8Z4XcQTnKGKks6",
            "walletNetwork": "devnet",
        },
    )

    response = client.get(
        "/api/v1/me",
        headers=auth_headers(uid="firebase-generated-uid", email="t1@knot.com"),
    )

    assert response.status_code == 200
    account = response.json()["data"]["account"]
    assert account["uid"] == "firebase-generated-uid"
    assert account["role"] == "BRAND"
    assert account["onboardingStatus"] == "COMPLETED"
    assert account["brandId"] == "brand-devnet-phantom"
    assert account["walletAddress"] == "8keJx2mcKFENHcUs4ti79aUurAHrWt8Z4XcQTnKGKks6"
    linked = repository.get_raw_document(FirestorePaths.user("firebase-generated-uid"))
    assert linked is not None
    assert linked["linkedSourceUserId"] == "user-brand-devnet"


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
