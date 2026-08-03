from fastapi.testclient import TestClient

from apps.api import routes
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


def test_product_analysis_uses_secure_fetched_source_when_available(monkeypatch) -> None:
    client, _ = authed_client_and_repository()
    headers = auth_headers("brand-secure-fetch", "brand-secure-fetch@example.com")
    client.get("/api/v1/me", headers=headers)
    client.post(
        "/api/v1/me/role",
        headers={**headers, "Idempotency-Key": "brand-secure-fetch-role"},
        json={"role": "BRAND"},
    )

    def fetched_source_page(source_url: str, _settings: Settings):
        return (
            routes.FetchedSourcePage(
                final_url=source_url,
                title="Daily SPF Moisturizer",
                description="A daily skincare cream with SPF for a morning routine.",
                text="Daily skincare routine cream SPF review ingredient texture.",
            ),
            None,
        )

    monkeypatch.setattr(routes, "_secure_fetch_source_page", fetched_source_page)

    response = client.post(
        "/api/v1/analyses/product",
        headers={**headers, "Idempotency-Key": "brand-secure-fetch-product"},
        json={"sourceUrl": "https://brand.example/products/spf"},
    )

    assert response.status_code == 202
    analysis = response.json()["data"]["analysis"]
    assert analysis["provider"] == "secure-fetch"
    assert analysis["fallbackReason"] == "gemini_mode_off"
    assert analysis["draft"]["product"]["name"]["value"] == "Daily SPF Moisturizer"
    assert analysis["draft"]["product"]["category"]["value"] == "beauty"


def test_product_analysis_normalizes_bare_https_domain(monkeypatch) -> None:
    client, _ = authed_client_and_repository()
    headers = auth_headers("brand-bare-url", "brand-bare-url@example.com")
    client.get("/api/v1/me", headers=headers)
    client.post(
        "/api/v1/me/role",
        headers={**headers, "Idempotency-Key": "brand-bare-url-role"},
        json={"role": "BRAND"},
    )

    def fetched_source_page(source_url: str, _settings: Settings):
        return (
            routes.FetchedSourcePage(
                final_url=source_url,
                title="The Zone Bio SPF",
                description="Daily SPF skincare product.",
                text="SPF cream daily skincare.",
            ),
            None,
        )

    monkeypatch.setattr(routes, "_secure_fetch_source_page", fetched_source_page)

    response = client.post(
        "/api/v1/analyses/product",
        headers={**headers, "Idempotency-Key": "brand-bare-url-product"},
        json={"sourceUrl": "thezonebio.com/products/spf"},
    )

    assert response.status_code == 202
    analysis = response.json()["data"]["analysis"]
    assert analysis["sourceUrl"] == "https://thezonebio.com/products/spf"


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


def test_creator_profile_analysis_extracts_public_metrics_when_present(monkeypatch) -> None:
    client, _ = authed_client_and_repository()
    headers = auth_headers("creator-metrics", "creator-metrics@example.com")
    client.get("/api/v1/me", headers=headers)
    client.post(
        "/api/v1/me/role",
        headers={**headers, "Idempotency-Key": "creator-metrics-role"},
        json={"role": "CREATOR"},
    )

    def fetched_source_page(source_url: str, _settings: Settings):
        return (
            routes.FetchedSourcePage(
                final_url=source_url,
                title="@ye__5o profile",
                description=(
                    "12.4K Followers, 320 Following, 27 Posts, "
                    "평균 조회 8,200, 참여율 4.8%, 릴스 비중 65%"
                ),
                text=(
                    "12.4K followers, 320 following, 27 posts, and average views 8,200. "
                    "Engagement 4.8%. Reels 65%. #skincare #daily"
                ),
                links=(
                    "https://www.instagram.com/reel/demo-reel-1",
                    "https://www.instagram.com/p/demo-post-1",
                ),
            ),
            None,
        )

    monkeypatch.setattr(routes, "_secure_fetch_source_page", fetched_source_page)

    response = client.post(
        "/api/v1/analyses/creator-profile",
        headers={**headers, "Idempotency-Key": "creator-metrics-analysis"},
        json={"sourceUrl": "instagram.com/ye__5o"},
    )

    assert response.status_code == 202
    draft = response.json()["data"]["analysis"]["draft"]
    assert draft["sourceUrl"] == "https://instagram.com/ye__5o"
    assert draft["followerCount"]["value"] == 12_400
    assert draft["averageViews"]["value"] == 8_200
    assert draft["engagementRate"]["value"] == 5
    assert draft["reelShare"]["value"] == 65
    assert draft["publicSignals"]["fetchStatus"] == "FETCHED"
    assert draft["publicSignals"]["profileCounts"]["followerCount"] == 12_400
    assert draft["publicSignals"]["profileCounts"]["followingCount"] == 320
    assert draft["publicSignals"]["profileCounts"]["postCount"] == 27
    assert draft["publicSignals"]["profileCounts"]["publicReelLinkCount"] == 1
    assert draft["publicSignals"]["profileCounts"]["publicPostLinkCount"] == 1
    assert "skincare" in draft["publicSignals"]["contentHints"]
    assert draft["publicSignals"]["recentPostUrls"] == [
        "https://www.instagram.com/reel/demo-reel-1",
        "https://www.instagram.com/p/demo-post-1",
    ]
    assert "followerCount" not in draft["unknownFields"]
    assert "averageViews" not in draft["unknownFields"]


def test_product_analysis_normalizes_http_and_reuses_without_idempotency(monkeypatch) -> None:
    client, _ = authed_client_and_repository()
    headers = auth_headers("product-http", "product-http@example.com")
    client.get("/api/v1/me", headers=headers)
    client.post(
        "/api/v1/me/role",
        headers={**headers, "Idempotency-Key": "product-http-role"},
        json={"role": "BRAND"},
    )
    monkeypatch.setattr(routes, "_secure_fetch_source_page", lambda *_args: (None, "test_no_fetch"))

    first = client.post(
        "/api/v1/analyses/product",
        headers=headers,
        json={"sourceUrl": "http://example.com/products/spf"},
    )
    second = client.post(
        "/api/v1/analyses/product",
        headers=headers,
        json={"sourceUrl": "example.com/products/spf"},
    )

    assert first.status_code == 202
    assert second.status_code == 202
    first_analysis = first.json()["data"]["analysis"]
    second_analysis = second.json()["data"]["analysis"]
    assert first_analysis["sourceUrl"] == "https://example.com/products/spf"
    assert second_analysis["sourceUrl"] == "https://example.com/products/spf"
    assert second_analysis["analysisId"] == first_analysis["analysisId"]


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
