"""온체인 신원/평판 — Reputation PDA 조회.

평판은 마일스톤 정산(approve_and_release) 시 프로그램이 갱신한다(campaigns_completed, total_settled).
매칭/신뢰 판단 시 브랜드/크리에이터 에이전트가 상대 평판을 읽어 참고한다.
"""
from __future__ import annotations

from solders.pubkey import Pubkey

from ..escrow import pdas


def reputation_address(wallet: Pubkey) -> Pubkey:
    """지갑의 Reputation PDA 주소."""
    return pdas.reputation_pda(wallet)[0]


async def fetch_reputation(program, wallet: Pubkey):
    """평판 계정 조회(anchorpy Program 필요). 아직 없으면 None."""
    addr = reputation_address(wallet)
    try:
        return await program.account["Reputation"].fetch(addr)
    except Exception:
        return None
