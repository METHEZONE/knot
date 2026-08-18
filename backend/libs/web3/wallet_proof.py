"""지갑 소유 증명 — 유저가 등록하는 주소의 개인키를 실제로 가졌는지 검증한다.

플랫폼이 유저 키를 보관하지 않기로 했으므로(docs/17 D7), "이 주소가 정말 이 유저
것인가" 를 다른 방법으로 보장해야 한다. 보장하지 못하면 아무도 통제하지 못하는 주소가
정산 수령처로 등록되어 지급된 USDC 가 영구히 잠긴다.

방식: 서버가 nonce 를 담은 챌린지 문구를 발급하고, 유저가 그 문구를 지갑으로 서명해
제출하면 서버가 ed25519 서명을 검증한다. 서버는 개인키를 보지 않는다.
"""
from __future__ import annotations

from dataclasses import dataclass

from solders.pubkey import Pubkey
from solders.signature import Signature

CHALLENGE_PREFIX = "knot-wallet-ownership"
CHALLENGE_TTL_SECONDS = 600


class WalletProofError(ValueError):
    """서명이 주소를 증명하지 못했다."""


@dataclass(frozen=True)
class WalletChallenge:
    challenge_id: str
    wallet_address: str
    message: str


def challenge_message(*, challenge_id: str, wallet_address: str, issued_at: str) -> str:
    """유저가 지갑으로 서명할 문구.

    주소와 nonce 를 함께 넣어야 다른 주소·다른 세션의 서명을 재사용할 수 없다.
    """
    return "\n".join(
        [
            f"{CHALLENGE_PREFIX}:{challenge_id}",
            f"wallet:{wallet_address}",
            f"issuedAt:{issued_at}",
            "이 서명은 지갑 소유 확인에만 쓰이며 자금을 이동시키지 않습니다.",
        ]
    )


def verify_wallet_signature(*, wallet_address: str, message: str, signature: str) -> None:
    """base58 서명이 wallet_address 의 키로 message 를 서명한 것인지 검증한다."""
    try:
        pubkey = Pubkey.from_string(wallet_address)
    except Exception as exc:  # noqa: BLE001 - solders 는 구체 타입을 노출하지 않는다
        raise WalletProofError("walletAddress is not a valid Solana public key.") from exc
    try:
        parsed = Signature.from_string(signature)
    except Exception as exc:  # noqa: BLE001
        raise WalletProofError("signature is not a valid base58 ed25519 signature.") from exc
    if not parsed.verify(pubkey, message.encode("utf-8")):
        raise WalletProofError("signature does not prove ownership of walletAddress.")
