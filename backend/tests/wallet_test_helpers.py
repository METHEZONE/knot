"""지갑 소유 증명을 거쳐 지갑을 연결하는 테스트 헬퍼.

`POST /me/wallet` 이 서명을 요구하므로(docs/17 D7) 테스트도 실제 keypair 로 서명해야
한다. 고정 주소 문자열은 서명할 수 없으니 keypair 를 만들어 쓴다.
"""
from __future__ import annotations

from fastapi.testclient import TestClient
from solders.keypair import Keypair


def issue_challenge(
    client: TestClient,
    headers: dict[str, str],
    wallet_address: str,
) -> dict[str, object]:
    response = client.post(
        "/api/v1/me/wallet/challenge",
        headers=headers,
        json={"walletAddress": wallet_address},
    )
    assert response.status_code == 201, response.text
    challenge = response.json()["data"]["challenge"]
    assert isinstance(challenge, dict)
    return challenge


def sign_challenge(keypair: Keypair, message: str) -> str:
    return str(keypair.sign_message(message.encode("utf-8")))


def connect_wallet(
    client: TestClient,
    headers: dict[str, str],
    keypair: Keypair | None = None,
):
    """챌린지 발급 → 서명 → 등록. (주소, 응답) 을 돌려준다."""
    kp = keypair or Keypair()
    address = str(kp.pubkey())
    challenge = issue_challenge(client, headers, address)
    response = client.post(
        "/api/v1/me/wallet",
        headers=headers,
        json={
            "walletAddress": address,
            "network": "devnet",
            "challengeId": challenge["challengeId"],
            "signature": sign_challenge(kp, str(challenge["message"])),
        },
    )
    return address, response
