---
name: x402-escrow
description: knot 두 결제 흐름(pay.sh API 결제 + Anchor 마일스톤 에스크로) 개념·instruction 레퍼런스·E2E 데모 스크립트. "에스크로", "마일스톤 정산", "결제 흐름", "데모 시나리오" 관련 작업에 사용.
---

# x402-escrow — knot 결제/정산 통합

## 결제 흐름 2개
1. **pay.sh / x402 (API 소비)** — 에이전트가 유료 API를 호출당 자율 결제. → `paysh` skill.
2. **Anchor 에스크로 (캠페인 정산)** — 브랜드→크리에이터 마일스톤 USDC. → 아래.

## 에스크로 instruction (programs/knot-escrow)
- `initialize_campaign(campaign_id, milestone_amounts[], auto_approve_cap)` — brand 서명, 총액 vault 예치.
- `submit_milestone(index)` — creator 서명, 완료 제출.
- `approve_and_release(index)` — brand **또는** agent_authority(cap 이내) 서명 → 크리에이터 USDC 전송 + 평판 갱신.
- `refund()` — brand 서명, vault 잔액 환불.

PDA: `[b"campaign", brand, id]` · `[b"vault", campaign]` · `[b"vault-auth", campaign]` · `[b"rep", wallet]`
(파이썬: `knot.escrow.pdas`).

## 자율성 규칙 (해커톤 핵심)
`auto_approve_cap` 이내 마일스톤이면 **브랜드 에이전트 서명만으로 사람 개입 없이 릴리스**.
초과 시 브랜드 본인 서명 필요. → "결제 단계에 사람 개입 없음" 데모 포인트.

## E2E 데모 스크립트 (devnet)
```bash
# 0) 준비
export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.cargo/bin:$HOME/.avm/bin:$PATH"
solana config set --url devnet && solana airdrop 2
anchor build && anchor deploy

# 1) (흐름1) 에이전트가 검증용 유료 API 자율 결제
pay --sandbox fetch https://debugger.pay.sh/mpp/quote/AAPL

# 2~4) (흐름2) 캠페인 펀딩 → 마일스톤 제출 → 자동 정산
#     backend/knot/escrow/client.py 의 initialize_campaign → submit_milestone → approve_and_release
#     (에이전트 키로 approve, cap 이내 → 사람 없이 USDC 릴리스)
cd backend && source .venv/bin/activate && KNOT_RUN_DEVNET=1 pytest -m devnet -v

# 5) 익스플로러에서 크리에이터 지갑 USDC 도착 확인 (explorer.solana.com ?cluster=devnet)
```

상세 계정/계약: `docs/architecture.md`.
