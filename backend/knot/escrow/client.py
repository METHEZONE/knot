"""knot-escrow 온체인 클라이언트 (anchorpy).

빌드 후 생성되는 IDL(``<repo>/target/idl/knot_escrow.json``)을 로드해 인스트럭션을 호출한다.
예원의 에이전트 계층은 이 모듈을 import 해서 온체인 정산을 수행한다(인터페이스 계약: docs/architecture.md).

주의:
  - 실제 호출은 배포된 프로그램 + 펀딩된 devnet 지갑 + USDC-SPL 토큰계정이 필요.
  - PDA 유도만 필요하면 ``knot.escrow.pdas`` 를 검증기 없이 사용.
  - anchorpy/solana 는 지연 import (미설치 환경에서도 pdas 단독 사용 가능하도록).
"""
from __future__ import annotations

from pathlib import Path
from typing import List

from solders.keypair import Keypair
from solders.pubkey import Pubkey

from . import pdas

DEVNET_RPC = "https://api.devnet.solana.com"

# 표준 프로그램 주소 (fragile import 회피용 상수)
SYSTEM_PROGRAM_ID = Pubkey.from_string("11111111111111111111111111111111")
TOKEN_PROGRAM_ID = Pubkey.from_string("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
RENT_SYSVAR = Pubkey.from_string("SysvarRent111111111111111111111111111111111")

# backend/knot/escrow/client.py -> repo 루트 = parents[3]
IDL_PATH = Path(__file__).resolve().parents[3] / "target" / "idl" / "knot_escrow.json"


async def load_program(payer: Keypair, rpc_url: str = DEVNET_RPC):
    """IDL을 로드해 anchorpy Program 인스턴스를 만든다."""
    from anchorpy import Idl, Program, Provider, Wallet
    from solana.rpc.async_api import AsyncClient

    if not IDL_PATH.exists():
        raise FileNotFoundError(f"IDL 없음: {IDL_PATH}. 먼저 `anchor build` 로 IDL 생성.")
    idl = Idl.from_json(IDL_PATH.read_text())
    provider = Provider(AsyncClient(rpc_url), Wallet(payer))
    return Program(idl, pdas.PROGRAM_ID, provider)


async def initialize_campaign(
    program,
    *,
    brand: Keypair,
    creator: Pubkey,
    agent_authority: Pubkey,
    mint: Pubkey,
    brand_token: Pubkey,
    campaign_id: int,
    milestone_amounts: List[int],
    auto_approve_cap: int,
) -> Pubkey:
    """캠페인 생성 + 총액 USDC 예치. 생성된 campaign PDA를 반환."""
    from anchorpy import Context

    campaign, _ = pdas.campaign_pda(brand.pubkey(), campaign_id)
    vault_auth, _ = pdas.vault_authority_pda(campaign)
    vault, _ = pdas.vault_pda(campaign)

    await program.rpc["initialize_campaign"](
        campaign_id,
        milestone_amounts,
        auto_approve_cap,
        ctx=Context(
            accounts={
                "brand": brand.pubkey(),
                "creator": creator,
                "agent_authority": agent_authority,
                "mint": mint,
                "brand_token": brand_token,
                "campaign": campaign,
                "vault_authority": vault_auth,
                "vault": vault,
                "token_program": TOKEN_PROGRAM_ID,
                "system_program": SYSTEM_PROGRAM_ID,
                "rent": RENT_SYSVAR,
            },
            signers=[brand],
        ),
    )
    return campaign


async def submit_milestone(program, *, creator: Keypair, campaign: Pubkey, index: int) -> None:
    """크리에이터가 마일스톤 완료 제출."""
    from anchorpy import Context

    await program.rpc["submit_milestone"](
        index,
        ctx=Context(
            accounts={"signer": creator.pubkey(), "campaign": campaign},
            signers=[creator],
        ),
    )


async def approve_and_release(
    program,
    *,
    signer: Keypair,
    campaign: Pubkey,
    creator: Pubkey,
    creator_token: Pubkey,
    index: int,
) -> None:
    """마일스톤 승인 + 정산. signer가 브랜드면 무조건, 에이전트면 auto_approve_cap 이내에서만."""
    from anchorpy import Context

    vault_auth, _ = pdas.vault_authority_pda(campaign)
    vault, _ = pdas.vault_pda(campaign)
    reputation, _ = pdas.reputation_pda(creator)

    await program.rpc["approve_and_release"](
        index,
        ctx=Context(
            accounts={
                "signer": signer.pubkey(),
                "campaign": campaign,
                "vault_authority": vault_auth,
                "vault": vault,
                "creator_token": creator_token,
                "creator_reputation": reputation,
                "token_program": TOKEN_PROGRAM_ID,
                "system_program": SYSTEM_PROGRAM_ID,
            },
            signers=[signer],
        ),
    )


async def refund(program, *, brand: Keypair, campaign: Pubkey, brand_token: Pubkey) -> None:
    """미완료/취소 시 vault 잔액을 브랜드에 환불."""
    from anchorpy import Context

    vault_auth, _ = pdas.vault_authority_pda(campaign)
    vault, _ = pdas.vault_pda(campaign)

    await program.rpc["refund"](
        ctx=Context(
            accounts={
                "brand": brand.pubkey(),
                "campaign": campaign,
                "vault_authority": vault_auth,
                "vault": vault,
                "brand_token": brand_token,
                "token_program": TOKEN_PROGRAM_ID,
            },
            signers=[brand],
        ),
    )
