from fastapi.testclient import TestClient

from apps.api.main import create_app
from libs.repositories.firestore_paths import FirestorePaths
from libs.repositories.store import InMemoryDocumentStore, KnotRepository


def client_and_repository() -> tuple[TestClient, KnotRepository]:
    repository = KnotRepository(InMemoryDocumentStore())
    return TestClient(create_app(repository=repository)), repository


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
