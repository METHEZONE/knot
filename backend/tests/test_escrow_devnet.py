"""에스크로 온체인 정산 통합 테스트 — 로컬 샌드박스 또는 testnet.

두 환경 (docs/SOLANA_ENVIRONMENTS.md 참고):
  로컬 샌드박스(추천, 각자 로컬):  scripts/localnet_settlement.sh
  공유 testnet:                   KNOT_RUN_TESTNET=1 pytest backend/tests/test_escrow_devnet.py -s

anchorpy 0.21 은 anchor 1.x 의 새 IDL 포맷을 파싱하지 못하므로, 이 테스트는
anchorpy Program 대신 solders 로 인스트럭션을 직접 빌드해 배포된 프로그램을 호출한다.
검증한 유저 플로우: 합의된 캠페인의 마일스톤 대금이 브랜드 에이전트에 의해
(사람 승인 없이, cap 이내) 온체인 USDC 로 자율 정산되는 시나리오.
"""
import asyncio
import hashlib
import json
import os
import struct
from pathlib import Path

import pytest

pytestmark = pytest.mark.devnet

# Two environments (see docs/SOLANA_ENVIRONMENTS.md):
#   local sandbox — KNOT_RUN_LOCALNET=1 (solana-test-validator, per developer)
#   shared testnet — KNOT_RUN_TESTNET=1
_LOCALNET = os.environ.get("KNOT_RUN_LOCALNET") == "1"
_TESTNET = os.environ.get("KNOT_RUN_TESTNET") == "1"
_RUN = _LOCALNET or _TESTNET or os.environ.get("KNOT_RUN_DEVNET") == "1"
_RPC = os.environ.get("SOLANA_RPC_URL") or os.environ.get("KNOT_DEVNET_RPC") or (
    "http://127.0.0.1:8899" if _LOCALNET else "https://api.testnet.solana.com"
)
# Settle time between dependent txs. Local validators need a small gap so a
# just-confirmed tx (e.g. mint_to) is visible to the next tx's preflight; the
    # public test clusters need a larger gap to avoid 429 rate-limits.
_THROTTLE = 1.0 if ("127.0.0.1" in _RPC or "localhost" in _RPC) else 2.0


def _u16(v: int) -> bytes:
    return struct.pack("<H", v)


def _u64(v: int) -> bytes:
    return struct.pack("<Q", v)


def _i64(v: int) -> bytes:
    return struct.pack("<q", v)


def _vec_u64(xs: list[int]) -> bytes:
    return struct.pack("<I", len(xs)) + b"".join(_u64(x) for x in xs)


def _disc(name: str) -> bytes:
    return hashlib.sha256(f"global:{name}".encode()).digest()[:8]


async def _rpc(fn, tries: int = 9):
    """Retry through rate-limited public Solana RPCs (429 / transient)."""
    for i in range(tries):
        try:
            result = await fn()
            if _THROTTLE:
                await asyncio.sleep(_THROTTLE)
            return result
        except Exception as error:  # noqa: BLE001
            name, text = type(error).__name__, str(error)
            transient = (
                "429" in text
                or "Too Many" in text
                or "timeout" in text.lower()
                or name in ("SolanaRpcException", "HTTPStatusError", "ReadTimeout", "ConnectError")
            )
            if i < tries - 1 and transient:
                await asyncio.sleep(5 + i * 4)
                continue
            raise


@pytest.mark.asyncio
@pytest.mark.skipif(
    not _RUN,
    reason="set KNOT_RUN_LOCALNET=1 (sandbox) or KNOT_RUN_TESTNET=1",
)
async def test_full_milestone_flow() -> None:
    from solana.rpc.async_api import AsyncClient
    from solana.rpc.commitment import Confirmed
    from solders.instruction import AccountMeta, Instruction
    from solders.keypair import Keypair
    from solders.pubkey import Pubkey
    from solders.system_program import TransferParams, transfer
    from solders.transaction import Transaction
    from spl.token.async_client import AsyncToken
    from spl.token.constants import TOKEN_PROGRAM_ID

    from knot.escrow import pdas

    program = pdas.PROGRAM_ID
    sys_program = Pubkey.from_string("11111111111111111111111111111111")
    rent = Pubkey.from_string("SysvarRent111111111111111111111111111111111")

    def meta(pk: Pubkey, signer: bool, writable: bool) -> AccountMeta:
        return AccountMeta(pubkey=pk, is_signer=signer, is_writable=writable)

    payer = Keypair.from_bytes(
        bytes(json.loads((Path.home() / ".config/solana/id.json").read_text()))
    )
    conn = AsyncClient(_RPC, commitment=Confirmed)

    async def send(ix: Instruction, signers: list) -> None:
        bh = (await _rpc(conn.get_latest_blockhash)).value.blockhash
        tx = Transaction.new_signed_with_payer([ix], payer.pubkey(), signers, bh)
        sig = (await _rpc(lambda: conn.send_raw_transaction(bytes(tx)))).value
        await _rpc(lambda: conn.confirm_transaction(sig, Confirmed))

    brand = payer
    creator = Keypair()
    agent = Keypair()

    # agent(=funder)가 campaign/vault(락 예치) + reputation 계정 rent를 부담하므로 SOL 지급
    await send(
        transfer(
            TransferParams(
                from_pubkey=payer.pubkey(), to_pubkey=agent.pubkey(), lamports=30_000_000
            )
        ),
        [payer],
    )

    cfg, _ = pdas.config_pda()
    total, milestones, cap = 1_000_000, [700_000, 300_000], 1_000_000

    # Config is a global singleton. On a fresh program create the mint + treasury and
    # initialize it (fees 0/0 -> lock == payable fixed amount); otherwise reuse the
    # established treasury and its mint so approve_and_release's treasury/mint
    # constraints hold across repeated runs.
    cfg_info = (await _rpc(lambda: conn.get_account_info(cfg))).value
    if cfg_info is None:
        token = await _rpc(
            lambda: AsyncToken.create_mint(conn, payer, payer.pubkey(), 6, TOKEN_PROGRAM_ID)
        )
        treasury_token = await _rpc(lambda: token.create_account(payer.pubkey()))
        await send(
            Instruction(
                program,
                _disc("initialize_config") + _u16(0) + _u16(0),
                [
                    meta(payer.pubkey(), True, True),
                    meta(treasury_token, False, False),
                    meta(cfg, False, True),
                    meta(sys_program, False, False),
                ],
            ),
            [payer],
        )
    else:
        treasury_token = Pubkey.from_bytes(bytes(cfg_info.data)[40:72])
        treasury_info = (await _rpc(lambda: conn.get_account_info(treasury_token))).value
        token = AsyncToken(
            conn, Pubkey.from_bytes(bytes(treasury_info.data)[0:32]), TOKEN_PROGRAM_ID, payer
        )

    mint = token.pubkey
    # agent = funder: 에이전트 지갑(예산)에서 락을 펀딩 (top-up 모델)
    agent_token = await _rpc(lambda: token.create_account(agent.pubkey()))
    creator_token = await _rpc(lambda: token.create_account(creator.pubkey()))
    await _rpc(lambda: token.mint_to(agent_token, payer, total))

    # unique per run (brand is fixed = payer) so the campaign PDA never collides
    campaign_id = int.from_bytes(bytes(creator.pubkey())[:8], "little")
    campaign, _ = pdas.campaign_pda(brand.pubkey(), campaign_id)
    vault_auth, _ = pdas.vault_authority_pda(campaign)
    vault, _ = pdas.vault_pda(campaign)
    reputation, _ = pdas.reputation_pda(creator.pubkey())
    terms_hash = hashlib.sha256(b"knot-solana-cluster-test").digest()

    # agent(=funder)가 캠페인을 열고 자기 예산에서 vault로 예치 (사람 없이 자율 락)
    await send(
        Instruction(
            program,
            _disc("initialize_campaign")
            + _u64(campaign_id)
            + _vec_u64(milestones)
            + _u64(cap)
            + terms_hash
            + _i64(3600),
            [
                meta(brand.pubkey(), False, False),   # brand: 당사자 pubkey(비서명)
                meta(creator.pubkey(), False, False),
                meta(agent.pubkey(), False, False),   # agent_authority(저장)
                meta(agent.pubkey(), True, True),     # funder = agent (서명·펀딩)
                meta(mint, False, False),
                meta(agent_token, False, True),       # funder_token
                meta(cfg, False, False),
                meta(campaign, False, True),
                meta(vault_auth, False, False),
                meta(vault, False, True),
                meta(TOKEN_PROGRAM_ID, False, False),
                meta(sys_program, False, False),
                meta(rent, False, False),
            ],
        ),
        [payer, agent],
    )

    # 3) creator submits milestone 0
    await send(
        Instruction(
            program,
            _disc("submit_milestone") + bytes([0]),
            [meta(creator.pubkey(), True, False), meta(campaign, False, True)],
        ),
        [payer, creator],
    )

    # 4) the AGENT (not the brand) approves + releases within cap -> no human
    await send(
        Instruction(
            program,
            _disc("approve_and_release") + bytes([0]),
            [
                meta(agent.pubkey(), True, True),
                meta(campaign, False, True),
                meta(vault_auth, False, False),
                meta(vault, False, True),
                meta(creator_token, False, True),
                meta(treasury_token, False, True),
                meta(reputation, False, True),
                meta(TOKEN_PROGRAM_ID, False, False),
                meta(sys_program, False, False),
            ],
        ),
        [payer, agent],
    )

    # creator received milestone-0 USDC on-chain (fee 0 -> full 70%)
    balance = (await _rpc(lambda: token.get_balance(creator_token))).value
    assert int(balance.amount) == milestones[0]

    # reputation account updated by the program (total_settled at offset 8+32+8)
    account = (await _rpc(lambda: conn.get_account_info(reputation))).value
    settled = int.from_bytes(bytes(account.data)[48:56], "little")
    assert settled == milestones[0]

    await conn.close()
