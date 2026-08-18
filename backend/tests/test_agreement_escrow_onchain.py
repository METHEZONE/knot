"""Agreement 에스크로 온체인 테스트 — 수수료 분배와 환불 권한을 실제 체인에서 검증한다.

제품이 쓰는 per-Agreement 경로다(레거시 campaign 경로는 test_escrow_devnet.py).
검증 대상은 docs/17 의 D1·D2·D5·P0:

  1. 브랜드가 협상액 + 수수료를 예치한다 (N2, 브랜드 부담)
  2. 릴리즈 시 크리에이터는 협상액 전액, 트레저리는 수수료를 받는다 (D5)
  3. 브랜드 키로는 환불할 수 없다 (P0 — settlement_authority 가 실행한다)
  4. 브랜드 승인 없이 타임락 전에는 환불이 거부된다 (P0 백스톱)
  5. 브랜드가 승인하면 잔액이 브랜드 지갑으로 돌아온다 (D2)

실행: scripts/localnet_settlement.sh 와 같은 환경에서
  KNOT_RUN_LOCALNET=1 pytest backend/tests/test_agreement_escrow_onchain.py -s
"""
import asyncio
import hashlib
import json
import os
import struct
from pathlib import Path

import pytest

pytestmark = pytest.mark.devnet

_LOCALNET = os.environ.get("KNOT_RUN_LOCALNET") == "1"
_RUN = _LOCALNET or os.environ.get("KNOT_RUN_DEVNET") == "1"
_RPC = os.environ.get("SOLANA_RPC_URL") or (
    "http://127.0.0.1:8899" if _LOCALNET else "https://api.devnet.solana.com"
)

FEE_BPS = 500  # N2: 5%
TIMELOCK_SECS = 7 * 24 * 60 * 60  # N4: 7일


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


# 공용 devnet RPC 는 429 를 자주 낸다. 로컬 밸리데이터는 방금 확정된 tx 가 다음 tx 의
# preflight 에 보이도록 짧은 간격만 필요하다 (test_escrow_devnet.py 와 같은 방식).
_THROTTLE = 0.3 if ("127.0.0.1" in _RPC or "localhost" in _RPC) else 2.0


async def _rpc(fn, tries: int = 9):
    """rate-limit 걸리는 공용 RPC 를 통과하도록 재시도한다."""
    for attempt in range(tries):
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
            if attempt < tries - 1 and transient:
                await asyncio.sleep(5 + attempt * 4)
                continue
            raise


def _apply_bps(amount: int, bps: int) -> int:
    """프로그램의 apply_bps 와 같은 계산(floor)."""
    return amount * bps // 10_000


@pytest.mark.skipif(not _RUN, reason="온체인 테스트는 KNOT_RUN_LOCALNET=1 에서만 실행")
@pytest.mark.asyncio
async def test_agreement_escrow_fee_split_and_refund_authority() -> None:
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
    ata_program = Pubkey.from_string("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL")

    def meta(pk: Pubkey, signer: bool, writable: bool) -> AccountMeta:
        return AccountMeta(pubkey=pk, is_signer=signer, is_writable=writable)

    payer = Keypair.from_bytes(
        bytes(json.loads((Path.home() / ".config/solana/id.json").read_text()))
    )
    conn = AsyncClient(_RPC, commitment=Confirmed)

    async def token_balance(account) -> int:
        response = await _rpc(lambda: conn.get_token_account_balance(account))
        return int(response.value.amount)

    def _all_signers(signers: list) -> list:
        """payer 는 fee payer 이므로 항상 서명해야 한다. 중복은 제거한다."""
        ordered = [payer]
        seen = {payer.pubkey()}
        for signer in signers:
            if signer.pubkey() not in seen:
                ordered.append(signer)
                seen.add(signer.pubkey())
        return ordered

    async def send(ix: Instruction, signers: list) -> str:
        bh = (await _rpc(conn.get_latest_blockhash)).value.blockhash
        tx = Transaction.new_signed_with_payer(
            [ix], payer.pubkey(), _all_signers(signers), bh
        )
        sig = (await _rpc(lambda: conn.send_raw_transaction(bytes(tx)))).value
        await _rpc(lambda: conn.confirm_transaction(sig, Confirmed))
        return str(sig)

    async def expect_failure(ix: Instruction, signers: list, label: str) -> None:
        bh = (await _rpc(conn.get_latest_blockhash)).value.blockhash
        tx = Transaction.new_signed_with_payer(
            [ix], payer.pubkey(), _all_signers(signers), bh
        )
        try:
            sig = (await conn.send_raw_transaction(bytes(tx))).value
            await conn.confirm_transaction(sig, Confirmed)
        except Exception:  # noqa: BLE001 — 거부되는 것이 기대 동작이다
            return
        raise AssertionError(f"{label}: 거부돼야 하는 트랜잭션이 성공했다")

    brand = payer
    creator = Keypair()
    settlement = Keypair()
    treasury = Keypair()

    # settlement 는 릴리즈 tx 에서 ATA rent 를 부담하므로 SOL 이 필요하다.
    await send(
        transfer(
            TransferParams(
                from_pubkey=payer.pubkey(), to_pubkey=settlement.pubkey(), lamports=60_000_000
            )
        ),
        [payer],
    )

    # 테스트 전용 USDC 유사 mint (6 decimals)
    token = await AsyncToken.create_mint(
        conn, payer, payer.pubkey(), 6, TOKEN_PROGRAM_ID, freeze_authority=None
    )
    mint = token.pubkey
    brand_token = await token.create_associated_token_account(brand.pubkey())
    creator_token = await token.create_associated_token_account(creator.pubkey())
    treasury_token = await token.create_associated_token_account(treasury.pubkey())

    milestones = [200_000, 800_000]  # 계약금 20% + 잔금 80% (N1)
    total = sum(milestones)
    fee_total = sum(_apply_bps(amount, FEE_BPS) for amount in milestones)
    required_funding = total + fee_total
    await token.mint_to(brand_token, payer, required_funding)

    agreement_id = f"agreement-onchain-{os.getpid()}"
    agreement_hash = hashlib.sha256(agreement_id.encode()).digest()
    escrow_pda, _ = Pubkey.find_program_address([b"escrow", agreement_hash], program)
    vault = Pubkey.find_program_address(
        [bytes(escrow_pda), bytes(TOKEN_PROGRAM_ID), bytes(mint)], ata_program
    )[0]
    terms_hash = hashlib.sha256(b"terms").digest()

    # 1) initialize_escrow — 협상된 수수료율과 타임락을 온체인에 싣는다 (D1)
    await send(
        Instruction(
            program_id=program,
            accounts=[
                meta(brand.pubkey(), True, True),
                meta(creator.pubkey(), False, False),
                meta(settlement.pubkey(), False, False),
                meta(treasury.pubkey(), False, False),
                meta(mint, False, False),
                meta(escrow_pda, False, True),
                meta(vault, False, True),
                meta(TOKEN_PROGRAM_ID, False, False),
                meta(ata_program, False, False),
                meta(sys_program, False, False),
            ],
            data=_disc("initialize_escrow")
            + agreement_hash
            + _vec_u64(milestones)
            + _u64(total)
            + terms_hash
            + _u16(FEE_BPS)
            + _i64(TIMELOCK_SECS),
        ),
        [brand],
    )

    # 2) fund_escrow — 브랜드가 협상액 + 수수료를 예치한다 (N2)
    await send(
        Instruction(
            program_id=program,
            accounts=[
                meta(brand.pubkey(), True, True),
                meta(mint, False, False),
                meta(brand_token, False, True),
                meta(escrow_pda, False, True),
                meta(vault, False, True),
                meta(TOKEN_PROGRAM_ID, False, False),
            ],
            data=_disc("fund_escrow") + _u64(required_funding),
        ),
        [brand],
    )
    vault_after_fund = await token_balance(vault)
    assert vault_after_fund == required_funding, "예치액은 협상액 + 수수료여야 한다"

    # 3) 잔금(index 1) 검증 + 릴리즈 — 크리에이터는 전액, 트레저리는 수수료 (D5)
    await send(
        Instruction(
            program_id=program,
            accounts=[meta(settlement.pubkey(), True, False), meta(escrow_pda, False, True)],
            data=_disc("verify_milestone") + bytes([1]),
        ),
        [settlement],
    )
    await send(
        Instruction(
            program_id=program,
            accounts=[
                meta(settlement.pubkey(), True, True),
                meta(mint, False, False),
                meta(escrow_pda, False, True),
                meta(vault, False, True),
                meta(creator.pubkey(), False, False),
                meta(creator_token, False, True),
                meta(treasury.pubkey(), False, False),
                meta(treasury_token, False, True),
                meta(TOKEN_PROGRAM_ID, False, False),
                meta(ata_program, False, False),
                meta(sys_program, False, False),
            ],
            data=_disc("release_milestone") + bytes([1]),
        ),
        [settlement],
    )
    creator_balance = await token_balance(creator_token)
    treasury_balance = await token_balance(treasury_token)
    expected_fee = _apply_bps(milestones[1], FEE_BPS)
    assert creator_balance == milestones[1], "크리에이터는 협상액을 그대로 받아야 한다"
    assert treasury_balance == expected_fee, "수수료는 트레저리로 가야 한다"

    # 4) 브랜드 키로는 환불할 수 없다 (P0 — 서명자는 settlement_authority 다)
    refund_accounts_with_brand = [
        meta(brand.pubkey(), True, True),
        meta(mint, False, False),
        meta(escrow_pda, False, True),
        meta(vault, False, True),
        meta(brand_token, False, True),
        meta(TOKEN_PROGRAM_ID, False, False),
    ]
    await expect_failure(
        Instruction(
            program_id=program,
            accounts=refund_accounts_with_brand,
            data=_disc("refund_remaining"),
        ),
        [brand],
        "브랜드 키 환불",
    )

    refund_accounts = [
        meta(settlement.pubkey(), True, True),
        meta(mint, False, False),
        meta(escrow_pda, False, True),
        meta(vault, False, True),
        meta(brand_token, False, True),
        meta(TOKEN_PROGRAM_ID, False, False),
    ]

    # 5) 승인도 없고 타임락도 안 지났으면 거부된다 (P0 선행조건)
    await expect_failure(
        Instruction(program_id=program, accounts=refund_accounts, data=_disc("refund_remaining")),
        [settlement],
        "승인·타임락 없는 환불",
    )

    # 6) 브랜드가 승인하면 잔액이 브랜드 지갑으로 돌아온다 (D2 빠른 경로)
    brand_before = await token_balance(brand_token)
    await send(
        Instruction(
            program_id=program,
            accounts=[meta(brand.pubkey(), True, False), meta(escrow_pda, False, True)],
            data=_disc("approve_refund"),
        ),
        [brand],
    )
    await send(
        Instruction(program_id=program, accounts=refund_accounts, data=_disc("refund_remaining")),
        [settlement],
    )
    brand_after = await token_balance(brand_token)
    vault_final = await token_balance(vault)

    # 잔액 = 예치액 - 크리에이터 지급 - 낸 수수료
    expected_refund = required_funding - milestones[1] - expected_fee
    assert brand_after - brand_before == expected_refund, "미지급 잔액이 브랜드로 돌아와야 한다"
    assert vault_final == 0, "환불 후 vault 는 비어야 한다"

    await conn.close()
