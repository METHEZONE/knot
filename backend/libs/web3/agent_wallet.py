"""에이전트 지갑 프로비저닝 — Solana 키페어 생성 + Secret Manager 보관.

top-up 자금흐름 모델(docs/WALLET_AND_MONEY_FLOW.md)의 **에이전트 지갑**을 만든다.
- 비밀키(64바이트)는 Secret Manager 시크릿 `knot-agent-key-{agentId}`에 number[] JSON으로 저장
  → 게이트웨이 `web3/gateway/src/solana.ts`의 `Keypair.fromSecretKey(number[])` 포맷과 호환.
- pubkey(base58)만 반환 → 호출부가 agent 문서에 기록.
- project_id 미구성(로컬/테스트)에선 비밀키를 저장하지 않고 pubkey만 생성(개발 폴백).
- 이 모듈은 opt-in(`KNOT_AGENT_WALLET_PROVISION`)일 때만 호출된다 → 기본 흐름/테스트 무영향.
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass

from solders.keypair import Keypair

logger = logging.getLogger(__name__)


@dataclass
class ProvisionResult:
    pubkey: str
    stored: bool  # Secret Manager에 비밀키 저장 여부


def _secret_id(agent_id: str) -> str:
    return f"knot-agent-key-{agent_id}"


def _secret_payload(kp: Keypair) -> bytes:
    """64바이트 시크릿키를 number[] JSON 으로(게이트웨이 포맷 호환)."""
    return json.dumps(list(bytes(kp))).encode("utf-8")


def provision_agent_wallet(agent_id: str, *, project_id: str | None) -> ProvisionResult:
    """에이전트 키페어 생성. project_id가 있으면 Secret Manager에 비밀키 저장, 없으면 pubkey만.

    프로비저닝 실패가 역할선택(가입)을 막지 않도록 예외는 삼키고 stored=False로 반환한다.
    """
    kp = Keypair()
    pubkey = str(kp.pubkey())
    if not project_id:
        logger.warning("agent wallet: project_id 없음 → SM 저장 생략(로컬/dev) pubkey=%s", pubkey)
        return ProvisionResult(pubkey=pubkey, stored=False)
    try:
        _store_secret(project_id, _secret_id(agent_id), _secret_payload(kp))
        logger.info("agent wallet 저장 완료 agent_id=%s pubkey=%s", agent_id, pubkey)
        return ProvisionResult(pubkey=pubkey, stored=True)
    except Exception:  # noqa: BLE001 — 프로비저닝 실패가 가입을 막지 않도록
        logger.exception("agent wallet: Secret Manager 저장 실패 agent_id=%s", agent_id)
        return ProvisionResult(pubkey=pubkey, stored=False)


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
