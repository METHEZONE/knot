"""유저 임베디드 지갑 프로비저닝 — 구글 로그인만으로 Solana 주소를 갖게 한다.

`agent_wallet.py`(에이전트 수탁 지갑)와 같은 구조지만 주체가 다르다.
- 에이전트 지갑: 에이전트가 자율 서명하는 운영 지갑 (`knot-agent-key-{agentId}`)
- 유저 지갑: 유저의 정산 수령/예치 주소 (`knot-user-key-{uid}`)

유저는 Phantom 설치도 시드 문구도 없이 주소를 갖는다. 지갑을 직접 소유하고 싶으면
`POST /api/v1/me/wallet` 으로 외부 Phantom 주소를 연결해 `walletCustody: "SELF"` 로 승격한다.

주의: 이 지갑의 비밀키는 플랫폼이 보관한다(커스터디). devnet 데모 범위 전용이며,
실서비스에는 키 로테이션·복구 정책이 선행돼야 한다.
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass

from solders.keypair import Keypair

logger = logging.getLogger(__name__)

CUSTODY_PLATFORM = "PLATFORM"
CUSTODY_SELF = "SELF"


@dataclass
class UserWalletProvisionResult:
    pubkey: str
    stored: bool  # Secret Manager에 비밀키 저장 여부


def _secret_id(uid: str) -> str:
    return f"knot-user-key-{uid}"


def _secret_payload(kp: Keypair) -> bytes:
    """64바이트 시크릿키를 number[] JSON 으로(게이트웨이 Keypair.fromSecretKey 포맷 호환)."""
    return json.dumps(list(bytes(kp))).encode("utf-8")


def provision_user_wallet(uid: str, *, project_id: str | None) -> UserWalletProvisionResult:
    """유저 키페어 생성. project_id가 있으면 Secret Manager에 저장, 없으면 pubkey만.

    프로비저닝 실패가 가입/역할선택을 막지 않도록 예외는 삼키고 stored=False로 반환한다.
    """
    kp = Keypair()
    pubkey = str(kp.pubkey())
    if not project_id:
        logger.warning("user wallet: project_id 없음 → SM 저장 생략(로컬/dev) uid=%s", uid)
        return UserWalletProvisionResult(pubkey=pubkey, stored=False)
    try:
        _store_secret(project_id, _secret_id(uid), _secret_payload(kp))
        logger.info("user wallet 저장 완료 uid=%s pubkey=%s", uid, pubkey)
        return UserWalletProvisionResult(pubkey=pubkey, stored=True)
    except Exception:  # noqa: BLE001 — 프로비저닝 실패가 가입을 막지 않도록
        logger.exception("user wallet: Secret Manager 저장 실패 uid=%s", uid)
        return UserWalletProvisionResult(pubkey=pubkey, stored=False)


def _store_secret(project_id: str, secret_id: str, payload: bytes) -> None:
    from google.api_core.exceptions import AlreadyExists
    from google.cloud import secretmanager

    client = secretmanager.SecretManagerServiceClient()
    parent = f"projects/{project_id}"
    try:
        client.create_secret(
            request={
                "parent": parent,
                "secret_id": secret_id,
                "secret": {"replication": {"automatic": {}}},
            }
        )
    except AlreadyExists:
        pass
    client.add_secret_version(
        request={"parent": f"{parent}/secrets/{secret_id}", "payload": {"data": payload}}
    )
