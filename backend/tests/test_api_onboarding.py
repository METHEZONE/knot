from fastapi.testclient import TestClient

from apps.api.main import create_app
from libs.repositories.firestore_paths import FirestorePaths
from libs.repositories.store import InMemoryDocumentStore, KnotRepository
from libs.settings.config import Settings
from tests.test_api_dashboards import auth_headers


def client_and_repository() -> tuple[TestClient, KnotRepository]:
    repository = KnotRepository(InMemoryDocumentStore())
    return TestClient(create_app(repository=repository)), repository


def authed_client_and_repository() -> tuple[TestClient, KnotRepository]:
    repository = KnotRepository(InMemoryDocumentStore())
    settings = Settings(auth_mode="emulator", firebase_project_id="knot-dev-503505")
    return TestClient(create_app(repository=repository, settings=settings)), repository


def test_bootstrap_user_and_brand_onboarding_persist_profile_context() -> None:
    client, repository = client_and_repository()

    user_response = client.post(
        "/api/v1/users:bootstrap",
        json={"email": "brand@example.com", "displayName": "Yewon", "role": "brand"},
    )
    assert user_response.status_code == 201
    user = user_response.json()["data"]["user"]

    onboard_response = client.post(
        "/api/v1/brands:onboard",
        json={
            "userId": user["userId"],
            "brandName": "Glow Bar Labs",
            "websiteUrl": "https://glowbar.example",
            "category": "beauty",
            "targetAudience": ["skincare", "20s"],
            "restrictedClaims": ["medical cure"],
        },
    )

    assert onboard_response.status_code == 201
    data = onboard_response.json()["data"]
    brand = data["brand"]
    agent = data["agent"]
    assert brand["brandId"].startswith("brand-")
    assert agent["ownerId"] == brand["brandId"]
    assert data["session"]["role"] == "brand"

    stored_user = repository.get_raw_document(FirestorePaths.user(user["userId"]))
    assert stored_user is not None
    assert stored_user["brandId"] == brand["brandId"]
    assert stored_user["brandAgentId"] == agent["agentId"]


def test_creator_onboarding_and_criteria_update_persist_agent_policy() -> None:
    client, _ = client_and_repository()

    user = client.post(
        "/api/v1/users:bootstrap",
        json={"email": "creator@example.com", "displayName": "Mina", "role": "creator"},
    ).json()["data"]["user"]
    onboard = client.post(
        "/api/v1/creators:onboard",
        json={
            "userId": user["userId"],
            "creatorName": "Mina Studio",
            "snsUrl": "https://instagram.com/mina.studio",
            "primaryCategory": "beauty",
        },
    ).json()["data"]
    creator = onboard["creator"]

    criteria_response = client.post(
        f"/api/v1/creators/{creator['creatorId']}/criteria",
        json={
            "minimumUsdc": 750,
            "blockedDomains": ["담배", "도박"],
            "preferredContent": ["Instagram Reels", "스토리 링크"],
            "usageRights": "paidBoost30d",
            "notes": "No hidden medical claims.",
        },
    )

    assert criteria_response.status_code == 200
    policy = criteria_response.json()["data"]["policy"]
    assert policy["creator"]["minBaseUsdc"] == 750
    assert policy["creator"]["blockedIndustries"] == ["담배", "도박"]
    assert policy["creator"]["allowedUsageRights"] == ["organicOnly", "paidBoost30d"]


def test_authenticated_brand_product_analysis_persists_resume_state() -> None:
    client, repository = authed_client_and_repository()
    headers = auth_headers("brand-analysis", "brand-analysis@example.com")
    client.get("/api/v1/me", headers=headers)
    client.post(
        "/api/v1/me/role",
        headers={**headers, "Idempotency-Key": "brand-analysis-role"},
        json={"role": "BRAND"},
    )

    response = client.post(
        "/api/v1/analyses/product",
        headers={**headers, "Idempotency-Key": "brand-analysis-product"},
        json={"sourceUrl": "https://brand.example/products/spf"},
    )
    repeated = client.post(
        "/api/v1/analyses/product",
        headers={**headers, "Idempotency-Key": "brand-analysis-product"},
        json={"sourceUrl": "https://brand.example/products/spf"},
    )
    session = client.get("/api/v1/onboarding", headers=headers)

    assert response.status_code == 202
    analysis = response.json()["data"]["analysis"]
    assert repeated.json()["data"]["analysis"]["analysisId"] == analysis["analysisId"]
    assert analysis["status"] == "READY_FOR_CONFIRMATION"
    assert analysis["draft"]["unknownFields"] == ["price", "reviews", "sales", "audienceMetrics"]
    assert "brand.example/products/spf" not in analysis["sourceDigest"]
    assert session.json()["data"]["onboarding"]["analysisJobId"] == analysis["analysisId"]
    assert (
        repository.get_raw_document(FirestorePaths.analysis_job(analysis["analysisId"]))
        is not None
    )


def test_creator_profile_analysis_and_confirmation_are_owner_scoped() -> None:
    client, _ = authed_client_and_repository()
    creator_headers = auth_headers("creator-analysis", "creator-analysis@example.com")
    other_headers = auth_headers("other-analysis", "other-analysis@example.com")
    client.get("/api/v1/me", headers=creator_headers)
    client.post(
        "/api/v1/me/role",
        headers={**creator_headers, "Idempotency-Key": "creator-analysis-role"},
        json={"role": "CREATOR"},
    )
    client.get("/api/v1/me", headers=other_headers)
    client.post(
        "/api/v1/me/role",
        headers={**other_headers, "Idempotency-Key": "other-analysis-role"},
        json={"role": "CREATOR"},
    )

    response = client.post(
        "/api/v1/analyses/creator-profile",
        headers={**creator_headers, "Idempotency-Key": "creator-profile-analysis"},
        json={"sourceUrl": "https://instagram.com/mood.creator"},
    )
    analysis_id = response.json()["data"]["analysis"]["analysisId"]
    forbidden = client.get(f"/api/v1/analyses/{analysis_id}", headers=other_headers)
    confirmed = client.post(
        f"/api/v1/analyses/{analysis_id}:confirm",
        headers={**creator_headers, "Idempotency-Key": "confirm-creator-analysis"},
        json={
            "confirmedFields": ["handle", "displayName"],
            "edits": {"displayName": "Mood Creator"},
        },
    )

    assert response.status_code == 202
    assert response.json()["data"]["analysis"]["draft"]["handle"]["value"] == "@mood.creator"
    assert forbidden.status_code == 403
    assert confirmed.status_code == 200
    assert confirmed.json()["data"]["analysis"]["status"] == "CONFIRMED"


def test_analysis_rejects_unsafe_source_urls() -> None:
    client, _ = authed_client_and_repository()
    headers = auth_headers("unsafe-analysis", "unsafe-analysis@example.com")
    client.get("/api/v1/me", headers=headers)
    client.post(
        "/api/v1/me/role",
        headers={**headers, "Idempotency-Key": "unsafe-analysis-role"},
        json={"role": "BRAND"},
    )

    response = client.post(
        "/api/v1/analyses/product",
        headers={**headers, "Idempotency-Key": "unsafe-product-analysis"},
        json={"sourceUrl": "https://127.0.0.1/product"},
    )

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "UNSAFE_SOURCE_URL"
