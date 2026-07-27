"""knot — 로컬넷 정산 배선 부트스트랩 (앱에서 실제 온체인 정산을 태우기 위한 준비).

  .venv/bin/python scripts/local/localnet_bootstrap.py [--reset]

하는 일:
  1) solana-test-validator 가 살아있는지 확인(없으면 백그라운드로 기동, 스크립트 종료 후에도 유지)
  2) knot-escrow 프로그램을 로컬넷에 배포(이미 있으면 skip)
  3) brand(=지갑 payer)/creator/agent 키페어 준비 + SOL 지급
  4) 에스크로 config 싱글턴 초기화(수수료 0/0) — 없으면 mint + treasury 생성, 있으면 기존 mint 재사용
  5) 게이트웨이/백엔드가 쓸 환경변수를 생성 파일로 기록 → dev_stack.sh 가 자동 source

왜 필요한가: Product API 는 시뮬레이션 영수증을 정산 성공으로 인정하지 않는다(CONFIRMED + 실서명 필수).
그래서 게이트웨이를 KNOT_WEB3_SIGNING_MODE=devnet 으로 띄우되 RPC 만 로컬넷을 향하게 한다.
게이트웨이는 온체인 config 의 treasury 로부터 mint 를 읽어 KNOT_USDC_MINT 와 일치하는지 검사하므로
(solana.ts), 로컬에서 만든 mint 주소를 양쪽에 주입해줘야 한다.

⚠️ 로컬넷 전용. devnet/mainnet 에는 아무것도 보내지 않는다. 상태는 /tmp 라 재부팅하면 사라진다(정상).
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import os
import struct
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RPC = "http://127.0.0.1:8899"
RUNTIME = Path(os.environ.get("KNOT_LOG_DIR", "/tmp/knot-local"))
KEYS = RUNTIME / "keys"
LEDGER = RUNTIME / "ledger"
ENV_OUT = RUNTIME / "env.localnet"
SO = ROOT / "target/deploy/knot_escrow.so"
PROGRAM_KP = ROOT / "target/deploy/knot_escrow-keypair.json"
RESET = "--reset" in sys.argv


def sh(*args: str, check: bool = True, quiet: bool = True) -> str:
    proc = subprocess.run(args, capture_output=True, text=True)
    if check and proc.returncode != 0:
        raise SystemExit(f"❌ {' '.join(args)}\n{proc.stdout}\n{proc.stderr}")
    if not quiet and proc.stdout.strip():
        print("   " + proc.stdout.strip().splitlines()[-1])
    return proc.stdout.strip()


def validator_healthy() -> bool:
    try:
        out = subprocess.run(
            ["curl", "-s", "-m", "2", RPC, "-X", "POST", "-H", "content-type: application/json",
             "-d", '{"jsonrpc":"2.0","id":1,"method":"getHealth"}'],
            capture_output=True, text=True, timeout=5,
        ).stdout
        return '"result":"ok"' in out
    except Exception:  # noqa: BLE001
        return False


def ensure_validator() -> None:
    if validator_healthy() and not RESET:
        print("▸ 밸리데이터: 이미 실행 중 (기존 원장 유지)")
        return
    if RESET:
        subprocess.run(["pkill", "-f", "solana-test-validator"], capture_output=True)
        time.sleep(1)
        subprocess.run(["rm", "-rf", str(LEDGER)], capture_output=True)
    KEYS.mkdir(parents=True, exist_ok=True)
    print("▸ 밸리데이터 기동 (백그라운드, 종료 후에도 유지)")
    log = open(RUNTIME / "validator.log", "ab")
    subprocess.Popen(
        ["solana-test-validator", "--quiet", "--ledger", str(LEDGER)]
        + (["--reset"] if RESET else []),
        stdout=log, stderr=log, start_new_session=True,
    )
    for _ in range(60):
        if validator_healthy():
            print("   ✅ RPC ok:", RPC)
            return
        time.sleep(1)
    raise SystemExit(f"❌ 밸리데이터가 준비되지 않았다 → {RUNTIME/'validator.log'}")


def ensure_program() -> str:
    if not SO.exists():
        print("▸ anchor build (프로그램 바이너리 없음)")
        sh("anchor", "build")
    program_id = sh("solana", "address", "-k", str(PROGRAM_KP))
    info = sh("solana", "account", program_id, "--url", RPC, check=False)
    if "Balance" in info:
        print(f"▸ 프로그램: 이미 배포됨 {program_id}")
    else:
        print(f"▸ 프로그램 배포 → {program_id}")
        sh("solana", "airdrop", "100", "--url", RPC, check=False)
        sh("solana", "program", "deploy", str(SO), "--program-id", str(PROGRAM_KP), "--url", RPC)
    return program_id


def keypair(path: Path) -> None:
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        sh("solana-keygen", "new", "--no-bip39-passphrase", "-s", "-o", str(path))


async def bootstrap_chain(program_id: str) -> dict[str, str]:
    from solana.rpc.async_api import AsyncClient
    from solana.rpc.commitment import Confirmed
    from solders.instruction import AccountMeta, Instruction
    from solders.keypair import Keypair
    from solders.pubkey import Pubkey
    from solders.system_program import TransferParams, transfer
    from solders.transaction import Transaction
    from spl.token.async_client import AsyncToken
    from spl.token.constants import TOKEN_PROGRAM_ID

    os.environ["KNOT_ESCROW_PROGRAM_ID"] = program_id
    sys.path.insert(0, str(ROOT / "backend"))
    from knot.escrow import pdas  # noqa: PLC0415

    program = pdas.PROGRAM_ID
    sys_program = Pubkey.from_string("11111111111111111111111111111111")
    payer_path = Path.home() / ".config/solana/id.json"
    keypair(payer_path)
    creator_path, agent_path = KEYS / "creator.json", KEYS / "agent.json"
    keypair(creator_path)
    keypair(agent_path)

    def load(path: Path) -> "Keypair":
        return Keypair.from_bytes(bytes(json.loads(path.read_text())))

    payer = load(payer_path)          # brand = payer = mint authority (게이트웨이의 brand 키)
    creator, agent = load(creator_path), load(agent_path)
    conn = AsyncClient(RPC, commitment=Confirmed)

    async def send(ix: "Instruction", signers: list) -> None:
        bh = (await conn.get_latest_blockhash()).value.blockhash
        tx = Transaction.new_signed_with_payer([ix], payer.pubkey(), signers, bh)
        sig = (await conn.send_raw_transaction(bytes(tx))).value
        await conn.confirm_transaction(sig, Confirmed)
        await asyncio.sleep(1.0)

    balance = (await conn.get_balance(payer.pubkey())).value
    if balance < 50_000_000_000:
        sh("solana", "airdrop", "100", "--url", RPC, check=False)
    for who in (creator, agent):
        if (await conn.get_balance(who.pubkey())).value < 100_000_000:
            await send(
                transfer(TransferParams(from_pubkey=payer.pubkey(), to_pubkey=who.pubkey(),
                                        lamports=200_000_000)),
                [payer],
            )

    cfg, _ = pdas.config_pda()
    cfg_info = (await conn.get_account_info(cfg)).value
    if cfg_info is None:
        print("▸ 에스크로 config 초기화 (mint + treasury 생성, 수수료 0/0)")
        token = await AsyncToken.create_mint(conn, payer, payer.pubkey(), 6, TOKEN_PROGRAM_ID)
        await asyncio.sleep(1.0)
        treasury_token = await token.create_account(payer.pubkey())
        await asyncio.sleep(1.0)
        disc = hashlib.sha256(b"global:initialize_config").digest()[:8]
        await send(
            Instruction(
                program,
                disc + struct.pack("<H", 0) + struct.pack("<H", 0),
                [
                    AccountMeta(payer.pubkey(), True, True),
                    AccountMeta(treasury_token, False, False),
                    AccountMeta(cfg, False, True),
                    AccountMeta(sys_program, False, False),
                ],
            ),
            [payer],
        )
        mint = token.pubkey
    else:
        treasury_token = Pubkey.from_bytes(bytes(cfg_info.data)[40:72])
        treasury_info = (await conn.get_account_info(treasury_token)).value
        mint = Pubkey.from_bytes(bytes(treasury_info.data)[0:32])
        print("▸ 에스크로 config: 기존 것 재사용")

    print(f"   mint     : {mint}")
    print(f"   treasury : {treasury_token}")
    await conn.close()
    return {
        "mint": str(mint),
        "program_id": program_id,
        "brand": str(payer_path),
        "creator": str(creator_path),
        "agent": str(agent_path),
    }


def write_env(info: dict[str, str]) -> None:
    ENV_OUT.write_text(
        "# 자동 생성 — scripts/local/localnet_bootstrap.py (편집 금지, 재생성됨)\n"
        "# 로컬넷에서 실제 서명을 내는 정산 프로필. dev_stack.sh 가 프로필 파일 뒤에 source 한다.\n"
        "KNOT_WEB3_MODE=gateway\n"
        "KNOT_WEB3_SIGNING_MODE=devnet\n"
        f"SOLANA_RPC_URL={RPC}\n"
        "SOLANA_CLUSTER=localnet\n"
        # 게이트웨이 zod 스키마가 network 를 "solanaDevnet" 리터럴로 고정하고 있어(escrow.ts) 로컬넷에서도
        # 이 라벨을 써야 통과한다. 실제 RPC는 로컬넷 — 영수증의 network 값만 devnet으로 표기된다.
        "KNOT_ESCROW_NETWORK=solanaDevnet\n"
        f"KNOT_ESCROW_PROGRAM_ID={info['program_id']}\n"
        f"KNOT_USDC_MINT={info['mint']}\n"
        f"KNOT_BRAND_KEYPAIR_PATH={info['brand']}\n"
        f"KNOT_CREATOR_KEYPAIR_PATH={info['creator']}\n"
        f"KNOT_AGENT_KEYPAIR_PATH={info['agent']}\n"
        "# 게이트웨이가 agentId 기반 Secret Manager 조회를 하지 않도록 비움(현재 계정은 읽기 권한 없음)\n"
        "GCP_PROJECT_ID=\n",
        encoding="utf-8",
    )
    print(f"\n✅ 정산 배선 완료 → {ENV_OUT}")
    print("   이제:  KNOT_ENV_FILE=.env.local scripts/local/dev_stack.sh")
    print("   (dev_stack.sh 가 위 파일을 자동으로 덧입혀 게이트웨이를 실서명 모드로 띄운다)")


def main() -> None:
    ensure_validator()
    program_id = ensure_program()
    info = asyncio.run(bootstrap_chain(program_id))
    write_env(info)


if __name__ == "__main__":
    main()
