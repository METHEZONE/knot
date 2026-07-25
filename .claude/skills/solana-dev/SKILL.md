---
name: solana-dev
description: knot Anchor/Solana devnet 개발 워크플로 — 툴체인 PATH, build/deploy, anchor keys, pytest, USDC-SPL. "anchor build", "배포", "devnet", "airdrop", "프로그램 id" 관련 작업에 사용.
---

# solana-dev — knot 온체인 개발 워크플로

## 툴체인 PATH (매 셸)
```bash
export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.cargo/bin:$HOME/.avm/bin:$PATH"
```
버전: solana-cli 4.1.1 · anchor 1.1.2 (avm) · rust 1.95 · pay 0.21.

## devnet 설정 & 펀딩
```bash
solana config set --url devnet
solana-keygen new            # 없으면 (~/.config/solana/id.json)
solana airdrop 2             # 실패하면 https://faucet.solana.com
solana balance
```

## 빌드 / 배포 / 프로그램 ID
```bash
anchor build                 # target/deploy/knot_escrow.so + target/idl/knot_escrow.json
anchor keys list             # knot_escrow: Aj63B5hLtvJdNQiAi61rMrgfW3pt8Lak3GQB59B6jysj
anchor keys sync             # lib.rs의 declare_id! ↔ 키페어 동기화 (불일치 시)
anchor deploy                # devnet 배포 (Anchor.toml provider=devnet)
```
> `anchor build`가 자동으로 keys sync를 수행함(빌드 로그에 "Updated to ..." 표시).

## 테스트
```bash
anchor test                  # = python3 -m pytest backend/tests (Anchor.toml [scripts])
# 또는 백엔드에서 직접:
cd backend && python3 -m venv .venv && source .venv/bin/activate && pip install -e ".[dev]"
pytest -m "not devnet"       # PDA 단위 + pay sandbox (배포 불필요)
KNOT_RUN_DEVNET=1 pytest -m devnet   # 배포+펀딩 후 통합
```

## 결제 토큰
- USDC-SPL devnet mint: `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` (x402/pay.sh 표준).
- 테스트용 토큰계정/민팅은 `spl-token` CLI 또는 anchorpy 헬퍼로.

## 주의
- **devnet 전용**. mainnet 키/시크릿 커밋 금지.
- Anchor 1.x 변경점: `CpiContext::new(program_id: Pubkey, accounts)` — 첫 인자가 **Pubkey**(구버전은 AccountInfo).
