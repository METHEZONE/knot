# 결제·정산 인수인계

Updated: 2026-08-18
작성: 효창 (블록체인 백엔드)
대상: 이 영역을 이어받는 사람

설계 배경과 미결 항목은 `17_REFUND_EXCEPTIONS_AND_PAYMENT_HARDENING.md` 에 있다. 이 문서는 **지금 코드가 실제로 어디까지 하는지**만 다룬다. 추측 없이 확인한 사실이다.

---

## 0. 30초 요약

돈이 **나가는** 길은 온체인까지 완결돼 있다. 돈이 **되돌아오는** 길은 온체인과 게이트웨이까지 완성됐고 **Product API·화면이 비어 있다.**

```
브랜드 예치 → 에스크로 잠금 → 증빙 검증 → 자동 정산 → 크리에이터 + 수수료   ✅ 끝까지 동작
                                              └→ 환불                      ⚠️ 게이트웨이까지만
```

이어받아 첫 번째로 할 일은 **환불의 Product API 엔드포인트와 화면**이다 (§6).

---

## 1. 배포 현황

| | 값 |
|---|---|
| devnet 프로그램 | `Aj63B5hLtvJdNQiAi61rMrgfW3pt8Lak3GQB59B6jysj` |
| 업그레이드 권한 | `7yihfmYe4JtjcY3fLsE1Ez2Wm6aTMf4TN3U8xqyz5ebe` (효창 로컬 `~/.config/solana/id.json`) |
| 정산 권한 | `GX1qtkjR89HXqagZ6x53BfFt4HVnSqWEw9QYxVBKgv6B` (Secret Manager `knot-settlement-keypair-json`) |
| 트레저리 | **정산 권한과 같은 주소** ⚠️ 분리 필요 (§7) |
| USDC mint (devnet) | `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` |
| GCP 프로젝트 | `knot-dev-503505` / `us-central1` |
| Cloud Run | knot-web, knot-api, knot-web3, knot-creator-agent |

**프로그램 업그레이드는 in-place 다.** 주소가 바뀌지 않으므로 팀이 env 를 다시 설정할 필요가 없다. 단 계정 레이아웃을 바꾸면 **기존 escrow PDA 는 읽을 수 없다** (devnet 데모 데이터라 폐기 가능).

재배포:
```bash
anchor build
solana program deploy --program-id target/deploy/knot_escrow-keypair.json target/deploy/knot_escrow.so
```
업그레이드 버퍼에 프로그램 크기만큼(현재 ~2.9 SOL) 잔액이 필요하고 배포 후 회수된다. devnet airdrop 은 rate limit 이 잦다.

⚠️ **`declare_id!` 와 배포 주소는 반드시 같아야 한다.** 최초 커밋부터 `9LjQL46...` 을 선언하면서 `Aj63B5...` 에 배포하고 있었고, GCP 의 `knot-web3` 도 존재하지 않는 프로그램을 가리키고 있었다. 2026-08-18 에 교정했다.

---

## 2. 온체인 (`programs/knot-escrow/src/lib.rs`)

**같은 파일에 에스크로 구현이 둘 있다.** 헷갈리기 쉬우니 먼저 확인할 것.

| 경로 | 상태 |
|---|---|
| `campaign` (레거시) | 제품이 **쓰지 않는다.** 다만 타임락·수수료 분배·평판 갱신의 검증된 참고 구현이다 |
| `escrow` (per-Agreement) | **제품이 쓰는 경로** |

### instruction

| instruction | 서명자 | 하는 일 |
|---|---|---|
| `initialize_escrow` | brand | PDA 생성. 협상된 `fee_bps`·`refund_timelock_secs` 를 싣는다. 상한 10% / 하한 1일을 프로그램이 강제 |
| `fund_escrow` | brand | **협상액 + 수수료**를 예치 (수수료 브랜드 부담) |
| `verify_milestone` | settlement | 마일스톤을 `Verified` 로 |
| `release_milestone` | settlement | 크리에이터에게 협상액, 트레저리에 수수료 **분리 전송** |
| `approve_refund` | **brand** | 환불 승인 플래그. 자금 이동 없음 |
| `refund_remaining` | **settlement** | 미지급 잔액을 브랜드로. 선행조건: 승인 **OR** 타임락 경과 |

### 왜 환불을 브랜드가 아니라 정산 권한이 실행하나

브랜드 키로 서명하게 두면 두 경우 모두 문제가 생긴다.

- 브랜드 지갑이 플랫폼 커스터디면 → **플랫폼이 환불권을 쥔다**
- 브랜드 지갑이 Phantom(SELF)이면 → **"사람 승인 0회" 제품 전제가 깨진다**

그래서 정산 권한이 실행하고, 온체인 선행조건(브랜드 승인 OR 타임락)이 플랫폼의 임의 환불을 막는다. **타임락 백스톱 때문에 자금이 영구히 묶이는 상태가 구조적으로 없다.**

### 계정 필드 중 주의할 것

```rust
total_amount       // 크리에이터가 받을 금액의 합. 수수료 미포함
funded_amount      // 실제 예치액 = total + fee_total
released_amount    // 크리에이터에게 나간 누적
fee_paid_amount    // 트레저리로 나간 누적
refunded_amount    // 브랜드로 되돌아간 누적
```

**vault 잔액 = `funded - released - fee_paid - refunded`** (`remaining_amount()`). 완료 판정은 `released + fee_paid >= funded` 다.

**수수료는 마일스톤별로 계산해 합산한다.** 총액에 한 번 적용하면 릴리즈 시점의 마일스톤별 합과 반올림 때문에 어긋나 vault 에 먼지가 남거나 부족해진다. 게이트웨이의 `applyBps` 도 프로그램의 `apply_bps` 와 동일한 floor 계산이어야 한다 — **어긋나면 예치액이 부족해 릴리즈가 실패한다.**

---

## 3. 마일스톤 구조

기본 2분할이다 (`libs/agents/brand.py`, 비율은 `libs/payments/settlement.py`).

```
마일스톤 0  deposit  20%  trigger=creatorAccepted
마일스톤 1  content  80%  trigger=contentLiveVerified
```

**온체인 마일스톤 인덱스와 순서가 대응한다. 순서를 바꾸면 안 된다.**

### 릴리즈 게이트가 트리거마다 다르다

계약금에는 검증할 콘텐츠가 없다. 모든 마일스톤에 증빙을 요구하면 **정상 완료 시에도 계약금이 영구히 잠긴다.**

- `contentLiveVerified` → 증빙이 검증을 통과해야 한다
- `creatorAccepted` → Agreement 가 수락 상태인지만 확인한다

### 계약금은 수락 시 귀속, 종결 시 전송

수락 즉시 전송하면 **"수락 → 계약금 수령 → 잠수" 를 반복하는 어뷰징**이 성립한다. 그래서 자동 정산이 콘텐츠 검증 시점에 아직 안 나간 앞선 마일스톤(계약금)을 먼저 릴리즈한 뒤 잔금을 릴리즈한다(`_unreleased_milestones_before`).

| 종결 사유 | 계약금 | 잔금 |
|---|---|---|
| 정상 완료 | 크리에이터 | 크리에이터 |
| 브랜드 단순변심(착수 후) | 크리에이터 | 브랜드 환불 |
| 브랜드 단순변심(착수 전) | 브랜드 환불 | 브랜드 환불 |
| 크리에이터 미제출·확정 위반 | 브랜드 환불 | 브랜드 환불 |

---

## 4. 증빙 검증 4단

`libs/policies/evidence.py` 의 `classify_evidence_outcome`. 우선순위는 **확정 위반 > 판단 불가 > 고칠 수 있음**.

| 판정 | 트리거 | HTTP |
|---|---|---|
| `VERIFIED` | 모든 게이트 통과 | 200 → 자동 정산 |
| `REVISION_REQUIRED` | 공시 누락 등 고칠 수 있는 결함 | **200** (오류 아님) |
| `MANUAL_REVIEW` | URL 도달 불가, 저신뢰 | **200** (오류 아님) |
| `REJECTED` | 브랜드 언급 없음, 금지 표현, 수정 기회 소진 | 409 |

**`REVISION_REQUIRED`·`MANUAL_REVIEW` 를 오류로 내면 안 된다.** 계약이 살아 있고 자금도 그대로인데 화면이 "실패" 로 표시하면 재제출 경로를 덮는다.

**저신뢰는 자동으로 실패시키지도, 릴리즈하지도 않는다** — 통과했더라도 `MANUAL_REVIEW` 로 보낸다.

재제출 허용 횟수는 **협상 결과**(`terms.deliverables[].revisionRounds`)를 쓴다. 새 정책을 발명하지 않았다. 소진하면 `REJECTED` 로 넘어가고, 그게 환불 트리거가 된다.

---

## 5. 지갑 소유 증명

플랫폼이 유저 개인키를 보관하지 않기로 했으므로(`docs/17` D7), 주소 등록에 서명 증명이 필수다.

```
POST /me/wallet/challenge  → nonce 문구 발급
        ↓ 유저가 지갑으로 서명 (자금 이동 없음)
POST /me/wallet            → ed25519 검증 후 등록
```

증명 없이 주소를 등록하면 **아무도 통제하지 못하는 주소가 정산 수령처가 되어 지급된 USDC 가 영구히 잠긴다.**

막아둔 우회 경로(각각 테스트 있음): 다른 키로 서명 / 서명 재사용 / 남의 챌린지 / A 챌린지로 B 주소 / 10분 만료.

프론트는 Phantom `signMessage` 를 쓴다. base58 인코더는 의존성을 늘리지 않으려고 직접 구현했고 solders 출력과 바이트 단위로 일치한다.

⚠️ `KNOT_USER_WALLET_PROVISION` 은 서버가 유저 키를 만드는 **데모 전용 플래그**다. 기본 off 이고 **프로덕션에서 켜면 특금법 노출이 되살아난다.** 배포 체크리스트에 넣어야 한다.

---

## 6. ⚠️ 환불 — 여기가 비어 있다 (다음 작업)

| 레이어 | 상태 |
|---|---|
| 온체인 | ✅ `approve_refund`, `refund_remaining` |
| 게이트웨이 | ✅ `escrows:prepare-refund-approval`, `escrows:refund` |
| **Product API** | ❌ **없음** |
| **화면** | ❌ **없음** |
| 상태 enum | ❌ `EscrowSettlementStatus` 에 `REFUNDED` 가 없다 (온체인엔 있다) |
| 환불 금액 | ❌ `routes.py` 의 `refundedAmountUsdc` 가 `"0"` 하드코딩 |

### 만들어야 하는 것

기존 `prepare` → `confirm` 패턴을 그대로 복제하면 된다. 새 패턴을 발명하지 말 것.

1. `EscrowSettlementStatus` 에 `REFUND_REQUESTED`, `REFUND_SUBMITTED`, `REFUNDED` 추가
2. `POST /agreements/{id}/escrow/refund:prepare-approval` → 게이트웨이 `prepare-refund-approval` (브랜드가 Phantom 으로 서명)
3. `POST /agreements/{id}/escrow/refund:confirm-approval` → 서명 확인·기록
4. `POST /agreements/{id}/escrow/refund` → 게이트웨이 `escrows:refund` (정산 키 실행)
5. `refundedAmountUsdc` 하드코딩 제거 → 온체인 `refunded_amount` 반영
6. 환불도 `PaymentOperation` 원장에 기록하고 트리거 사유를 `reasonCode` 로 남긴다. 환불은 민감 액션이므로 권한·캡·멱등성 확인 후 audit event
7. 화면: 브랜드측 환불 요청/승인, 환불 완료 표시. 크리에이터측에는 사유 안내

### 환불 트리거 6종 (정책으로 못 박을 것)

애드혹 환불을 만들지 말 것.

| # | 상황 | 처리 |
|---|---|---|
| 1 | 펀딩 안 함 | 환불 대상 없음, `CANCELED` |
| 2 | 기한 내 미제출 | 타임락 경과 후 전액 |
| 3 | 증빙 `REJECTED`(재제출 소진) | 브랜드 승인 요청 → 전액 |
| 4 | `REVISION_REQUIRED` 기간 만료 | 2와 동일 |
| 5 | 부분 마일스톤만 완료 | `refund_remaining` 이 잔액만 환불 |
| 6 | 브랜드 단순변심(착수 후) | 계약금 release → 잔액 환불 |

### 함께 넣을 것 — 자금 종결 불변식 테스트

```
released + fee_paid + refunded == funded
```

모든 Agreement 는 (에스크로 없음 / 전액 릴리즈 / 전액 환불 / 부분+잔액환불) 중 **정확히 하나**로 끝나야 한다. 이걸 테스트로 못 박으면 어중간하게 끝난 계약이 구조적으로 불가능해진다.

---

## 7. 남은 문제

| # | 문제 | 영향 |
|---|---|---|
| 1 | **트레저리가 정산 키와 같은 주소** | 수입·지출 분리(D4)가 안 됐다. 서버가 침해되면 누적 수수료도 함께 털린다. 수취 전용 지갑을 따로 만들고 `KNOT_PLATFORM_TREASURY` 에 넣어야 한다 |
| 2 | `NegotiationStatus` enum 에 `"ESCALATED"` 가 없는데 저장된다 | enum 밖 문자열이 Firestore 에 들어간다 |
| 3 | 평판이 성공만 센다 | `Reputation` PDA 에 위반 카운터가 없고, 제품 경로(`release_milestone`)는 평판을 아예 갱신하지 않는다. 위반이 매칭에 반영될 경로가 없다 |
| 4 | 비용 원장이 x402 만 | 가스·Gemini·ATA rent 는 집계되지 않는다. 수수료율이 적정한지 알 수 없다 |
| 5 | 마일스톤 2분할이 화면에 안 보인다 | 금액은 정상이지만 "계약금/잔금" 구분과 수수료 표시가 없다 |
| 6 | 수수료 상한이 프로그램 상수 | `Config` 계정으로 옮겨야 재배포 없이 조정 가능 |
| 7 | 날짜 하드코딩 | 협상까지 가는 테스트는 `postingWindow` 를 **절대 고정 날짜로 두지 말 것**. 픽스처는 `FIXTURE_ANCHOR_DATE` 기준으로 seed 단계에서 밀어준다 |

---

## 8. 검증 방법

```bash
# 백엔드
cd backend && ../.venv/bin/python -m ruff check apps libs tests
cd backend && ../.venv/bin/python -m pytest -q                    # 164 passed / 5 skipped

# 프론트
npm --prefix frontend run typecheck && npm --prefix frontend run lint
npm --prefix frontend test                                        # 21/21
npm --prefix frontend run build

# 게이트웨이
npm --prefix web3/gateway run build && npm --prefix web3/gateway run lint
npm --prefix web3/gateway test                                    # 15/15

# 온체인 (로컬 밸리데이터)
solana-test-validator --reset --quiet &
solana --url http://127.0.0.1:8899 airdrop 100
solana --url http://127.0.0.1:8899 program deploy \
  --program-id target/deploy/knot_escrow-keypair.json target/deploy/knot_escrow.so
cd backend && KNOT_RUN_LOCALNET=1 SOLANA_RPC_URL=http://127.0.0.1:8899 \
  ../.venv/bin/python -m pytest tests/test_agreement_escrow_onchain.py -q -s

# 온체인 (실제 devnet — 배포 검증용)
cd backend && KNOT_RUN_DEVNET=1 ../.venv/bin/python -m pytest tests/test_agreement_escrow_onchain.py -q -s
```

`test_agreement_escrow_onchain.py` 가 제품이 쓰는 경로를 검증한다. `test_escrow_devnet.py` 는 **레거시 campaign 경로만** 덮으므로 이걸로는 부족하다.

### 온체인 테스트가 확인하는 것

1. 예치액 == 협상액 + 수수료
2. 릴리즈 시 크리에이터 협상액 전액 / 트레저리 수수료
3. 브랜드 키로 환불 → 거부
4. 승인·타임락 없는 환불 → 거부
5. 브랜드 승인 후 환불 → 잔액이 브랜드로, vault 0

---

## 9. GCP 배포

```bash
set -a && source frontend/.env.local && set +a
export KNOT_SETTLEMENT_AUTHORITY=GX1qtkjR89HXqagZ6x53BfFt4HVnSqWEw9QYxVBKgv6B
unset NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST     # 안 지우면 배포본이 에뮬레이터를 본다
bash scripts/deploy_cloud_run_demo.sh
```

- 이미지 4개 빌드 + Cloud Run 4개 배포. 10분 이상 걸린다
- `Setting IAM policy failed` 경고는 조직 정책 때문이며 기존 공개 접근은 유지된다
- **`/healthz` 는 Google Frontend 가 가로채 404 가 된다. 헬스체크는 `/readyz` 나 `/version` 으로 할 것**
- `/version` 의 `gitSha` 로 내 커밋이 떴는지 확인한다

---

## 10. 관련 문서

| 문서 | 내용 |
|---|---|
| `17_REFUND_EXCEPTIONS_AND_PAYMENT_HARDENING.md` | 설계 결정(D1~D8·N1~N4), 실패 케이스 전수, 페널티, 한국 규제 |
| `13_AGREEMENT_ESCROW_EVIDENCE_SETTLEMENT.md` | 원래 스펙. 4단 검증·실패 복구의 근거 |
| `14_SECURITY_PRIVACY_AUTHORITY_AND_CONCURRENCY.md` | 민감 액션 권한 체크 목록(환불 포함) |
