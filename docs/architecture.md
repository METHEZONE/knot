# knot 아키텍처 — 블록체인 백엔드 (효창)

> 이 문서는 효창(블록체인)이 소유하는 온체인/결제 레이어와, 예원(에이전트)·민성(프론트) 레이어와의
> **인터페이스 계약**을 정의한다. 제품 개요·해커톤 컨텍스트는 루트 `CLAUDE.md` 참고.

## 1. 레이어

```
┌───────────────────────────────────────────────────────────────┐
│  UI / 유저 여정 (민성)                                          │
├───────────────────────────────────────────────────────────────┤
│  에이전트 계층 (예원)                                            │
│   - 브랜드 에이전트 / 크리에이터 에이전트                         │
│   - A2A 통신, 협상(오퍼/카운터), 온보딩·트래킹                    │
├───────────────────────────────────────────────────────────────┤
│  결제·정산 레이어 (효창)  ← 이 레포 슬라이스                      │
│   흐름1: pay.sh / x402  → 에이전트의 유료 API 자율 결제            │
│   흐름2: knot-escrow    → 캠페인 마일스톤 USDC 정산 (온체인)       │
│   신원/평판: Reputation PDA                                       │
├───────────────────────────────────────────────────────────────┤
│  Solana (devnet) · USDC-SPL                                     │
└───────────────────────────────────────────────────────────────┘
```

## 2. 유저 플로우 (E2E)

| # | 단계 | 소유 | 결제 |
|---|------|------|------|
| 0 | 온보딩(브랜드 예산·spend cap / 크리에이터 소셜·지갑·평판) | 예원 | — |
| 1 | 발견·매칭(브리프 등록 → 후보 매칭, 검증용 유료 API 호출) | 민성/효창 | **흐름1 pay.sh** |
| 2 | 협상(A2A 오퍼/카운터, 한도 내 자율 수렴) | 예원(+효창 계약 스키마) | — |
| 3 | 계약·에스크로 펀딩(`initialize_campaign`, 총액 USDC 예치) | 효창 | 흐름2 온체인 |
| 4 | 실행·정산(`submit_milestone` → `approve_and_release`) | 효창 | 흐름2 온체인 |
| 5 | 완료/환불(`refund`) | 효창 | 흐름2 온체인 |

**데모 히어로 모먼트**: (a) 에이전트가 pay.sh로 유료 API 자율 결제, (b) 마일스톤 승인 시 USDC가
**사람 승인 없이(한도 내)** devnet에서 자동 정산 → 익스플로러로 확인.

**핵심 규칙 — 자율성**: `auto_approve_cap` 이내면 브랜드 에이전트(`agent_authority`) 서명만으로
협상·정산이 사람 개입 없이 진행. 초과 금액은 브랜드 본인 서명 필요.

## 3. 온체인 레퍼런스 (`programs/knot-escrow`)

- **Program ID**: `Hv74c9a4rKMHpsy7hgCj7a11tDRaAZG49Ss7bLscs5hu` (devnet, `anchor keys list`)
- **결제 토큰**: USDC-SPL (devnet mint `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`)

### 계정 (State)
- `Config` PDA `[b"config"]` (싱글턴) — `admin`, `treasury`(수수료 수취 토큰계정), `brand_fee_bps`, `creator_fee_bps`.
- `Campaign` PDA `[b"campaign", brand, campaign_id(u64 LE)]` — 당사자·mint·vault·treasury, total/released/auto_approve_cap, brand/creator_fee_bps(스냅샷), `terms_hash[32]`, `refund_available_at`, status, `milestones: Vec<Milestone>`(최대 8).
- `vault` 토큰계정 PDA `[b"vault", campaign]` — 권한 = `vault_authority` PDA `[b"vault-auth", campaign]`.
- `Reputation` PDA `[b"rep", wallet]` — campaigns_completed, total_settled(실수령 기준), rating.

### 인스트럭션
| 이름 | 서명자 | 설명 |
|---|---|---|
| `initialize_config(brand_fee_bps, creator_fee_bps)` | admin | 플랫폼 수수료율·트레저리 1회 설정 |
| `initialize_campaign(campaign_id, milestone_amounts, auto_approve_cap, terms_hash, refund_timelock_secs)` | brand | 캠페인 생성 + (딜총액 + 브랜드측 수수료) vault 예치, terms_hash 기록 |
| `submit_milestone(index)` | creator | 마일스톤 완료 제출 |
| `approve_and_release(index)` | brand **또는** agent_authority(cap 이내) | 승인 → 크리에이터 net 전송 + 트레저리에 양측 수수료 스킴 + 평판 갱신 |
| `refund()` | brand | **타임락 경과 후** vault 잔액 브랜드 환불(분쟁/취소) |

**수수료 (양측·Airbnb식)**: 브랜드는 딜총액 **위에** 브랜드측 수수료를 얹어 예치, 크리에이터는 지급액에서 크리에이터측 수수료 **차감**. 릴리즈마다 마일스톤 비례로 온체인 스킴 → 트레저리. 요율은 `Config`에 저장(데모 기본값, 팀 조정).

이벤트: `CampaignInitialized{deposit}`, `MilestoneReleased{creator_net, platform_cut, by_agent}`.

## 4. 인터페이스 계약 (예원 에이전트 → 효창 레이어)

두 백엔드 모두 **Python**이므로 계약 = 공용 모듈 API. 예원 에이전트는 아래를 import.

```python
# 결제 흐름 1 — 유료 API 자율 결제
from knot.payments import paysh
res = paysh.fetch("https://<paid-api>", sandbox=True)   # 개발/데모는 sandbox

# 결제 흐름 2 — 온체인 마일스톤 정산
from knot.escrow import client, pdas
program = await client.load_program(payer_keypair)                       # IDL 로드
# (관리자 1회) 플랫폼 수수료율·트레저리 설정 — 예: 양측 5%
await client.initialize_config(program, admin=admin_kp, treasury_token=TREASURY,
                               brand_fee_bps=500, creator_fee_bps=500)
campaign = await client.initialize_campaign(program, brand=brand_kp, creator=..., agent_authority=...,
                                            mint=USDC, brand_token=..., campaign_id=1,
                                            milestone_amounts=[..], auto_approve_cap=..,
                                            terms_hash=sha256(terms_json), refund_timelock_secs=7*86400)
await client.submit_milestone(program, creator=creator_kp, campaign=campaign, index=0)
await client.approve_and_release(program, signer=agent_kp, campaign=campaign,
                                 creator=..., creator_token=..., treasury_token=TREASURY, index=0)

# 신원/평판
from knot.identity import fetch_reputation
rep = await fetch_reputation(program, creator_pubkey)
```

PDA만 필요하면 검증기 없이 `knot.escrow.pdas.*` 사용 가능.

### 예원과 합의가 필요한 항목 (열린 질문)
- **협상 계약 스키마**: A2A 메시지에서 합의된 캠페인 → `initialize_campaign` 인자로 넘어오는 필드 매핑(마일스톤 금액/설명, cap 산출).
- **지갑/키 관리**: 에이전트 키(agent_authority)와 브랜드/크리에이터 지갑을 예원 온보딩에서 어떻게 발급·보관할지.
- **증빙(`submit_milestone`)**: 현재 상태 전이만. 증빙 URL/해시를 온체인에 남길지, 오프체인 저장 후 pay.sh 지표검증(옵션)으로 갈지.

## 5. 확정된 결정
- 자율성: **한도 내 완전 자율**(cap 초과만 사람 서명).
- 마일스톤 검증: **에이전트 attested**(pay.sh 지표검증은 여유 시 옵션).
- 네트워크: **devnet 전용**, 토큰 **USDC-SPL** 통일.
- 스택: 에스크로 = Anchor 1.1.2 / 백엔드 = Python(anchorpy·solders), 결제는 pay.sh CLI·MCP.
