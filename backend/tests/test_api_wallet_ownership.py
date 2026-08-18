"""지갑 소유 증명 테스트 — 플랫폼이 키를 보관하지 않는 대신 서명으로 소유를 확인한다.

이 게이트가 뚫리면 아무도 통제하지 못하는 주소가 정산 수령처로 등록되어 지급된 USDC 가
영구히 잠긴다(docs/17 D7). 그래서 우회 경로를 하나씩 막았는지 확인한다.
"""
from __future__ import annotations

from fastapi.testclient import TestClient
from solders.keypair import Keypair

from apps.api.main import create_app
from libs.repositories.firestore_paths import FirestorePaths
from libs.repositories.store import InMemoryDocumentStore, KnotRepository
from libs.settings.config import Settings
from tests.test_api_dashboards import auth_headers
from tests.wallet_test_helpers import connect_wallet, issue_challenge, sign_challenge


def client_and_repository() -> tuple[TestClient, KnotRepository]:
    repository = KnotRepository(InMemoryDocumentStore())
    settings = Settings(auth_mode="emulator", firebase_project_id="knot-dev-503505")
    return TestClient(create_app(repository=repository, settings=settings)), repository


def completed_creator(client: TestClient, uid: str) -> dict[str, str]:
    headers = auth_headers(uid, f"{uid}@example.com")
    client.get("/api/v1/me", headers=headers)
    client.post(
        "/api/v1/me/role",
        headers={**headers, "Idempotency-Key": f"{uid}-role"},
        json={"role": "CREATOR"},
    )
    client.post(
        "/api/v1/me/creator-profile",
        headers={**headers, "Idempotency-Key": f"{uid}-profile"},
        json={
            "creatorName": "Creator",
            "snsUrl": "https://instagram.com/creator",
            "categories": ["beauty"],
            "minimumUsdc": 300,
            "blockedDomains": [],
            "preferredContent": ["Instagram Reels"],
        },
    )
    return headers


def test_signed_challenge_registers_wallet_as_self_custody() -> None:
    client, _ = client_and_repository()
    headers = completed_creator(client, "creator-proof-ok")

    address, response = connect_wallet(client, headers)

    assert response.status_code == 200, response.text
    account = response.json()["data"]["account"]
    assert account["walletAddress"] == address
    assert account["walletCustody"] == "SELF"


def test_wallet_save_rejects_signature_from_a_different_key() -> None:
    """다른 키로 서명하면 등록되지 않는다 — 남의 주소를 수령처로 박는 것을 막는다."""
    client, _ = client_and_repository()
    headers = completed_creator(client, "creator-proof-wrongkey")
    victim = str(Keypair().pubkey())
    attacker = Keypair()

    challenge = issue_challenge(client, headers, victim)
    response = client.post(
        "/api/v1/me/wallet",
        headers=headers,
        json={
            "walletAddress": victim,
            "network": "devnet",
            "challengeId": challenge["challengeId"],
            "signature": sign_challenge(attacker, str(challenge["message"])),
        },
    )

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "WALLET_OWNERSHIP_NOT_PROVEN"


def test_wallet_challenge_cannot_be_replayed() -> None:
    client, _ = client_and_repository()
    headers = completed_creator(client, "creator-proof-replay")
    keypair = Keypair()
    address = str(keypair.pubkey())

    challenge = issue_challenge(client, headers, address)
    body = {
        "walletAddress": address,
        "network": "devnet",
        "challengeId": challenge["challengeId"],
        "signature": sign_challenge(keypair, str(challenge["message"])),
    }
    first = client.post("/api/v1/me/wallet", headers=headers, json=body)
    second = client.post("/api/v1/me/wallet", headers=headers, json=body)

    assert first.status_code == 200, first.text
    assert second.status_code == 422
    assert second.json()["detail"]["code"] == "WALLET_CHALLENGE_ALREADY_USED"


def test_wallet_challenge_is_bound_to_the_issuing_user() -> None:
    """남이 발급받은 챌린지를 가져다 쓸 수 없다."""
    client, _ = client_and_repository()
    owner_headers = completed_creator(client, "creator-proof-owner")
    other_headers = completed_creator(client, "creator-proof-other")
    keypair = Keypair()
    address = str(keypair.pubkey())

    challenge = issue_challenge(client, owner_headers, address)
    response = client.post(
        "/api/v1/me/wallet",
        headers=other_headers,
        json={
            "walletAddress": address,
            "network": "devnet",
            "challengeId": challenge["challengeId"],
            "signature": sign_challenge(keypair, str(challenge["message"])),
        },
    )

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "WALLET_CHALLENGE_MISMATCH"


def test_wallet_challenge_is_bound_to_the_requested_address() -> None:
    """A 주소로 받은 챌린지를 B 주소 등록에 쓸 수 없다."""
    client, _ = client_and_repository()
    headers = completed_creator(client, "creator-proof-addrswap")
    first = Keypair()
    second = Keypair()

    challenge = issue_challenge(client, headers, str(first.pubkey()))
    response = client.post(
        "/api/v1/me/wallet",
        headers=headers,
        json={
            "walletAddress": str(second.pubkey()),
            "network": "devnet",
            "challengeId": challenge["challengeId"],
            "signature": sign_challenge(second, str(challenge["message"])),
        },
    )

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "WALLET_CHALLENGE_MISMATCH"


def test_expired_wallet_challenge_is_rejected() -> None:
    client, repository = client_and_repository()
    headers = completed_creator(client, "creator-proof-expired")
    keypair = Keypair()
    address = str(keypair.pubkey())

    challenge = issue_challenge(client, headers, address)
    path = FirestorePaths.wallet_challenge(str(challenge["challengeId"]))
    stored = repository.get_raw_document(path)
    assert stored is not None
    repository.save_raw_document(path, {**stored, "createdAt": "2020-01-01T00:00:00Z"})

    response = client.post(
        "/api/v1/me/wallet",
        headers=headers,
        json={
            "walletAddress": address,
            "network": "devnet",
            "challengeId": challenge["challengeId"],
            "signature": sign_challenge(keypair, str(challenge["message"])),
        },
    )

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "WALLET_CHALLENGE_EXPIRED"


def test_unknown_wallet_challenge_is_rejected() -> None:
    client, _ = client_and_repository()
    headers = completed_creator(client, "creator-proof-unknown")
    keypair = Keypair()

    response = client.post(
        "/api/v1/me/wallet",
        headers=headers,
        json={
            "walletAddress": str(keypair.pubkey()),
            "network": "devnet",
            "challengeId": "walletchal-does-not-exist",
            "signature": sign_challenge(keypair, "anything"),
        },
    )

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "WALLET_CHALLENGE_NOT_FOUND"
