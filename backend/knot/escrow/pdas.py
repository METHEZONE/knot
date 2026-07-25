"""knot-escrow PDA 유도.

solders만 사용하므로 검증기(validator) 없이도 오프라인 단위 테스트가 가능하다.
프로그램 ID는 `anchor keys list`로 확인하며, 환경변수 KNOT_ESCROW_PROGRAM_ID로 override 가능.
"""
from __future__ import annotations

import os

from solders.pubkey import Pubkey

# `anchor keys list` 로 확인한 knot-escrow 프로그램 ID (기본값)
_DEFAULT_PROGRAM_ID = "Aj63B5hLtvJdNQiAi61rMrgfW3pt8Lak3GQB59B6jysj"
PROGRAM_ID = Pubkey.from_string(os.environ.get("KNOT_ESCROW_PROGRAM_ID", _DEFAULT_PROGRAM_ID))


def campaign_pda(brand: Pubkey, campaign_id: int) -> tuple[Pubkey, int]:
    """seeds = [b"campaign", brand, campaign_id(u64 LE)]"""
    return Pubkey.find_program_address(
        [b"campaign", bytes(brand), int(campaign_id).to_bytes(8, "little")],
        PROGRAM_ID,
    )


def vault_authority_pda(campaign: Pubkey) -> tuple[Pubkey, int]:
    """seeds = [b"vault-auth", campaign] — vault 토큰계정의 권한 PDA"""
    return Pubkey.find_program_address([b"vault-auth", bytes(campaign)], PROGRAM_ID)


def vault_pda(campaign: Pubkey) -> tuple[Pubkey, int]:
    """seeds = [b"vault", campaign] — 에스크로 USDC를 보관하는 토큰계정 PDA"""
    return Pubkey.find_program_address([b"vault", bytes(campaign)], PROGRAM_ID)


def reputation_pda(wallet: Pubkey) -> tuple[Pubkey, int]:
    """seeds = [b"rep", wallet] — 지갑별 온체인 평판 PDA"""
    return Pubkey.find_program_address([b"rep", bytes(wallet)], PROGRAM_ID)


def config_pda() -> tuple[Pubkey, int]:
    """seeds = [b"config"] — 플랫폼 설정(수수료율·트레저리) 싱글턴 PDA"""
    return Pubkey.find_program_address([b"config"], PROGRAM_ID)
