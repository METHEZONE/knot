# 환불·예외 처리와 결제 하드닝 — 구현 계획

Updated: 2026-08-17
Owner: 효창 (블록체인 백엔드)
Status: 제안 — P0 결정 대기

해커톤 데모는 **골든 패스만** 완결돼 있다. 돈이 정상적으로 흐르는 경로는 온체인까지 증명됐지만, **돈이 되돌아오는 경로는 코드에 없다.** 이 문서는 그 구멍을 항목별로 메우는 계획이다.

---

## 0. 지금 상태 — 코드 근거

주장마다 파일:라인을 붙였다. 추측이 아니라 현재 `main`(e08eec5) 기준 사실이다.

| 항목 | 코드 현실 | 근거 |
|---|---|---|
| 환불 | 온체인 `refund_remaining`(brand_authority 서명, 타임락 없음)과 레거시 `refund`(타임락 있음, campaign 경로)가 **둘 다 존재하나 게이트웨이·API에 배선이 없다** | `programs/knot-escrow/src/lib.rs:467`, `:241` / `web3/gateway/src/app.ts:66-190` 에 refund 라우트 없음 |
| 환불 금액 | 항상 `"0"` 하드코딩 | `backend/apps/api/routes.py:2762` |
| 환불 상태 | `EscrowSettlementStatus` 에 `REFUNDED` 가 없다. 온체인엔 `AgreementEscrowStatus::Refunded` 가 있다 → **온체인·오프체인 상태 불일치** | `backend/libs/domain/models.py:89-98` vs `lib.rs:922-929` |
| 취소 | 에스크로 확정 **이전** 경로만 있다 (match run / negotiation) | `routes.py:1901`, `:2630` |
| 성과 검증 | 스펙은 4단(VERIFIED / REVISION_REQUIRED / MANUAL_REVIEW / REJECTED) 인데 코드는 **`allowed ? VERIFIED : REJECTED` 2단** | `docs/13_...:136-155` vs `routes.py:3047` |
| REJECTED 후속 | 없음. 자금 상태가 바뀌지 않고, 재제출 경로도 없다 | `routes.py` 에 `REVISION_REQUIRED` / `MANUAL_REVIEW` 쓰기 없음 |
| 협상 상태 | `_negotiation_status()` 가 `"ESCALATED"` 를 저장하는데 **`NegotiationStatus` enum 에 없는 값** | `routes.py:6234` vs `models.py:57-66` |
| 에스크로 키 | brand / creator / agent / settlement / relayer 5종을 게이트웨이가 env JSON·경로 또는 GCP Secret Manager 에서 로드 | `web3/gateway/src/config.ts:41-59`, `solana.ts:264-267` |
| 유저 지갑 | 구글 로그인만으로 플랫폼이 키페어 생성 → `knot-user-key-{uid}` 를 Secret Manager 에 저장, `walletCustody: "PLATFORM"`. Phantom 연결 시 `"SELF"` 승격 | `backend/libs/web3/user_wallet.py`, `routes.py:353`, `:382` |
| 가스 | relayer 를 feePayer 로 partialSign. relayer 키가 없으면 유저 부담으로 **정상 폴백** | `web3/gateway/src/funding.ts:651-668` |
| 플랫폼 수수료 | `PLATFORM_FEE_BPS = 0`. 의도적 결정("PRD 11 defines no protocol/platform fee for v1. Do not invent one")이고 테스트가 0을 단정 | `libs/payments/settlement.py:15-16`, `tests/test_settlement.py:45` |
| 온체인 수수료 | 현재 per-Agreement 에스크로의 `release_milestone` 은 **마일스톤 전액을 크리에이터에게** 보낸다. bps 분배는 레거시 campaign 경로에만 있다 | `lib.rs:386-465` vs `:32-43`, `:163-164` |
| x402 | 매치런당 1회 유료 견적 호출. 캡(per-call 0.02 / per-run 0.02 / daily 1.0 USDC)·리소스 allowlist 가 **서버에서 실제로 강제**된다 | `libs/payments/paysh.py`, `routes.py:6608-6700`, `config.py:53-61` |
| x402 권한 | 영수증은 매칭·락·릴리즈를 승인하지 않는다 — 의도적 경계 | `libs/payments/paysh.py` docstring |
| 나가는 비용 | x402 만 `PaymentOperation` 원장에 남는다. 가스·Gemini·ATA rent 는 집계 없음 | `routes.py:_record_paysh_operation` |

**한 줄 요약:** 온체인 프리미티브는 대부분 이미 있다. 없는 것은 **정책·상태기계·배선**이다.

---

## 1. 왜 이 순서여야 하는가

항목들이 서로 물려 있어서 순서를 잘못 잡으면 두 번 만든다.

```
P0 커스터디·권한 모델 확정
   └─ 누가 환불에 서명하는지가 안 정해지면 P2 를 구현할 수 없다
        │
        ├─ P1 검증 4단 복원 ──┐
        │   (환불의 트리거를 만드는 단계)
        │                      │
        └──────────────────────┴─ P2 취소·환불 상태기계 + 온체인 배선
                                    │
                                    ├─ P3 협상 시나리오 완결성 (자금 종결 불변식)
                                    └─ P4 플랫폼 지갑·비용 원장
                                            │
                                            ├─ P5 전통 금융 접점
                                            └─ P6 x402 확장
```

P5 의 데이터모델 3분해(gross / withholding / net)만은 예외로 **P2 와 같이** 넣는다. 나중에 넣으면 정산 레코드를 다 마이그레이션해야 해서 비싸진다.

---

## P0 — 커스터디·권한 모델 확정 (선행, 코드 변경 적음)

### 문제

`refund_remaining` 은 `brand_authority` 서명을 요구한다(`lib.rs:471-474`). 그런데 브랜드 지갑은 두 가지 커스터디를 가진다.

- `walletCustody: "PLATFORM"` — 플랫폼이 `knot-user-key-{uid}` 를 보관한다. **플랫폼이 브랜드의 환불 키를 쥔다.** 플랫폼이 마음대로 vault 를 브랜드에게 되돌릴 수 있고, 반대로 크리에이터가 정당하게 일했는데 환불해버릴 수도 있다.
- `walletCustody: "SELF"` — Phantom. 환불에 사람 서명이 필요하다. **"사람 승인 0회" 제품 전제가 환불 경로에서 깨진다.**

즉 지금 구조에서는 어느 쪽을 택해도 문제가 남는다.

### 제안 — 환불을 브랜드 키 액션이 아니라 정책 게이트 액션으로

`settlement_authority`(플랫폼 정산 키, 이미 존재)가 환불도 서명하게 하고, **온체인 선행조건**을 걸어 플랫폼의 임의성을 제거한다.

에스크로 계정에 2개 필드를 추가한다:

```rust
pub refund_available_at: i64,   // 타임락. 이 시점 이후엔 누구나 환불 트리거 가능
pub refund_approved: bool,      // brand_authority 가 켜는 빠른 경로 플래그
```

`refund_remaining` 의 권한 조건을 이렇게 바꾼다:

```
서명자가 settlement_authority 이고
  ( refund_approved == true              // 브랜드가 명시 승인 → 즉시
    OR Clock::now >= refund_available_at ) // 타임락 경과 → 백스톱
```

- 레거시 `refund`(`lib.rs:241`)가 이미 `refund_available_at` 타임락으로 같은 일을 한다. 새로 발명하는 게 아니라 현재 경로로 옮기는 것이다.
- 타임락 백스톱이 있으면 **자금이 영구히 묶이는 상태가 없다** — 이게 P3 자금 종결 불변식의 근거가 된다.
- `refund_approved` 는 브랜드가 켜는 것이므로 플랫폼 단독 환불이 불가능하다.

### 바꿀 것

| 파일 | 변경 |
|---|---|
| `programs/knot-escrow/src/lib.rs` | `AgreementEscrow` 에 필드 2개 추가, `MAX_SIZE` 갱신(`:899`), `initialize_escrow` 시그니처에 `refund_available_at` 추가, `refund_remaining` 권한 조건 교체, `approve_refund(brand_authority)` instruction 신규 |
| `web3/gateway/src/funding.ts` | `initializeEscrow` 호출부에 `refundAvailableAt` 전달 |
| `backend/apps/api/routes.py` | 에스크로 생성 시 `refundAvailableAt` 계산(= postingWindow.end + 그레이스 N일) |

`MAX_SIZE` 가 바뀌므로 기존 PDA 와 호환되지 않는다. **devnet 데이터는 폐기 가능하므로 마이그레이션 없이 재배포**한다(`scripts/deploy_devnet.sh`). 로컬은 `scripts/localnet_settlement.sh` 로 검증.

### 테스트

- 타임락 전 + 미승인 → `TimelockActive` 로 거부
- 타임락 전 + 브랜드 승인 → 성공
- 타임락 후 + 미승인 → 성공
- settlement_authority 아닌 서명자 → `Unauthorized`
- 부분 릴리즈 후 환불 → `funded - released` 만 이동 (현재 로직 유지)

### 결정 필요 (내가 못 정함)

1. 그레이스 기간 N일 — postingWindow.end 이후 며칠 뒤에 타임락이 열리나? (제안: 7일)
2. `PLATFORM` 커스터디 브랜드의 `approve_refund` 는 누가 트리거하나? 유저가 UI 버튼을 누르면 플랫폼이 대신 서명하는 구조가 되는데, 그건 결국 플랫폼이 브랜드 키를 쓰는 것이다. 여기에 **명시적 동의 로그(audit event)** 를 남기는 것으로 충분한지 판단 필요.

---

## P1 — 성과 검증 4단 복원 (환불의 트리거를 만든다)

### 문제

`routes.py:3047` 이 `"status": "VERIFIED" if policy_decision.allowed else "REJECTED"` 로 2단이다. 스펙(`docs/13_...:136-155`)이 정의한 `REVISION_REQUIRED` / `MANUAL_REVIEW` 는 enum 에만 있고 아무도 쓰지 않는다. 스펙에 "low confidence does not automatically fail or release; it moves to review" 라고 써 있는데 코드는 low confidence 를 바로 REJECTED 로 떨어뜨린다.

"원하는 성과가 나오지 않았을 때"의 대응이 **없는 게 아니라, 있어야 할 자리가 비어 있다.**

### 제안 — 위반을 3종으로 분류해서 매핑

| 위반 성격 | 예시 | 판정 | 다음 액션 |
|---|---|---|---|
| 없음 | 모든 결정론 게이트 통과 | `VERIFIED` | 릴리즈 |
| 고칠 수 있음 | 필수 공시(`#광고`) 누락, 포맷 불일치, 태그 누락 | `REVISION_REQUIRED` | 크리에이터 재제출. 횟수는 `terms.deliverables[].revisionRounds` 로 이미 협상돼 있다 |
| 판단 불가 | fetch 실패, Gemini 저신뢰, 금지 표현 애매 | `MANUAL_REVIEW` | `/dev/admin` 리뷰 큐 → 사람이 VERIFIED/REJECTED 확정 |
| 확정 위반 | 콘텐츠 없음/삭제됨, 다른 제품, 기한 초과 | `REJECTED` | P2 환불 경로 진입 |

핵심: **재제출 횟수가 이미 협상 결과에 들어 있다.** `revisionRounds` 를 소진하면 자동으로 REJECTED 로 넘어간다 — 새 정책을 발명할 필요가 없다.

### 바꿀 것

| 파일 | 변경 |
|---|---|
| `backend/libs/policies/` (신규 `evidence.py`) | 위반 코드 → 4단 판정 매핑을 순수 함수로. LLM 없이 결정론적으로 |
| `backend/apps/api/routes.py:3047` 주변 | 2단 분기를 판정 함수 호출로 교체. `revisionCount` 증가·상한 체크 |
| `backend/libs/domain/models.py` | Evidence 문서에 `revisionCount`, `reviewReason`, `sourceDigest` 필드 (스펙 `docs/13_...:190` 이 sourceDigest 요구) |
| `frontend/src/product/` | REVISION_REQUIRED / MANUAL_REVIEW 상태 UI. 크리에이터에겐 "무엇을 고쳐야 하는지", 브랜드에겐 "검토 중" |

### 테스트

- 공시 누락 → REVISION_REQUIRED, 재제출로 VERIFIED
- `revisionRounds` 소진 후 또 실패 → REJECTED
- fetch 실패 → MANUAL_REVIEW (REJECTED 아님)
- 저신뢰 Gemini → MANUAL_REVIEW
- 콘텐츠 삭제 → REJECTED
- 검증 후 소스가 바뀌어도 정산된 Agreement 를 재개하지 않는다(`sourceDigest` 기록, 스펙 `:190`)

---

## P2 — 취소·환불 상태기계 + 온체인 배선

### 환불 트리거 6종

정책으로 못 박는다. 애드혹 환불은 만들지 않는다.

| # | 상황 | 자금 상태 | 처리 |
|---|---|---|---|
| 1 | 협상 성립했으나 브랜드가 펀딩 안 함 | 온체인 아무것도 없음 | `CANCELED`. 환불 대상 없음 |
| 2 | 펀딩됐으나 크리에이터가 기한 내 미제출 | vault 전액 | 타임락 경과 → 전액 환불 |
| 3 | Evidence `REJECTED` (재제출 소진) | vault 전액 | `refund_approved` 자동 요청 → 전액 환불 |
| 4 | `REVISION_REQUIRED` 기간 만료 | vault 전액 | 2와 동일 경로 |
| 5 | 다중 마일스톤 중 일부만 완료 | vault 잔액 | `refund_remaining` 이 이미 `funded - released` 만 환불 |
| 6 | 브랜드가 착수 후 임의 취소 | vault 전액 | **정책 결정 필요** — 크리에이터 보상 없이 전액 환불은 착수 리스크를 크리에이터에게 전가한다 |

6번 제안: 크리에이터가 제출 전이면 전액 환불, 제출 후면 브랜드 임의 취소를 막고 MANUAL_REVIEW 로 보낸다. 취소 수수료를 온체인에서 나누려면 프로그램이 부분 분배를 해야 하는데 현재 `release_milestone` 은 마일스톤 전액만 보낸다 → v1 범위 밖.

### 상태 추가

```
EscrowSettlementStatus += REFUND_REQUESTED, REFUND_SUBMITTED, REFUNDED
```

현재 `CANCELED` 하나로 뭉개면 온체인 `Refunded` 와 대응이 안 된다.

### 바꿀 것 — 기존 prepare/confirm 패턴을 그대로 복제

펀딩·릴리즈가 이미 `prepare` → 유저/플랫폼 서명 → `confirm` 2단이다. 환불도 같은 모양으로 만든다. 새 패턴을 발명하지 않는다.

| 레이어 | 신규 |
|---|---|
| 게이트웨이 라우트 | `POST /internal/v1/escrows:prepare-refund`, `:confirm-refund` (`app.ts`, 기존 `prepareFundingRoute` 옆) |
| 게이트웨이 로직 | `prepareEscrowRefund()`, `confirmEscrowRefund()` (`funding.ts`, `prepareBrandFunding`/`confirmBrandFunding` 미러) |
| Product API | `POST /agreements/{id}/escrow/refund:prepare`, `:confirm` (`routes.py`, 기존 `/escrow/confirm` 옆) |
| 환불 금액 | `routes.py:2762` 의 `"refundedAmountUsdc": "0"` 하드코딩 제거 → 온체인 `refunded_amount` 반영 |
| 원장 | 환불도 `PaymentOperation` 으로 기록. 트리거 코드(위 1~6)를 `reasonCode` 로 남긴다 |
| audit | 환불은 `docs/14_...:105` 가 지정한 민감 액션 → 권한·캡·멱등성 체크 후 audit event |

### 함께 넣을 것 — 정산 금액 3분해 (P5 선행 투자)

지금 정산 레코드는 금액이 하나다. 나중에 세금·수수료가 붙으면 전 레코드를 마이그레이션해야 한다. 지금 넣어두면 공짜다.

```
grossAmountUsdc      // 협상된 총액
withholdingUsdc      // 원천징수 (v1 = 0)
platformFeeUsdc      // 플랫폼 수수료 (v1 = 0, PLATFORM_FEE_BPS 유지)
netAmountUsdc        // 실지급 = gross - withholding - platformFee
```

v1 은 전부 0 이라 `net == gross` 이고 온체인 동작이 안 바뀐다. **필드만 미리 둔다.**

### 테스트

- 트리거 1~5 각각 시나리오 테스트
- 환불 멱등성: 같은 operation 두 번 → 두 번째는 같은 결과, 이중 환불 없음
- 부분 릴리즈 후 환불: `released + refunded == funded`
- 환불 후 릴리즈 시도 → 거부
- 릴리즈 후 환불 시도 → `NothingToRefund`
- 온체인 확정 + Firestore 쓰기 실패 → reconciler 가 복구 (스펙 `docs/13_...:180`)

---

## P3 — 협상 시나리오 분류와 자금 종결 불변식

### 먼저 고칠 버그

`_negotiation_status()`(`routes.py:6227-6234`)가 `"ESCALATED"` 를 저장하는데 `NegotiationStatus`(`models.py:57-66`)에 그 값이 없다. enum 밖의 문자열이 Firestore 에 들어가고 있다. → `ESCALATED` 를 enum 에 추가.

### 시나리오 분류 — 결과 × 원인

현재 골든 패스는 PR #15 에서 확인된 대로 `OFFER → creator COUNTER → brand bridge COUNTER → creator COUNTER → brand ACCEPT → creator ACCEPT` (라운드 3).

| 상태 | 원인 코드 | 자금 상태 | 다음 액션 | 재시도 |
|---|---|---|---|---|
| `AGREED` | — | 펀딩 대기 | 에스크로 생성 | — |
| `COUNTERED` | 진행 중 | 없음 | 라운드 계속 | — |
| `ESCALATED` | `CREATOR_LEAD_TIME_TOO_SHORT` | 없음 | 브랜드가 기한 조정 | 재협상 가능 |
| `ESCALATED` | `CREATOR_CAPACITY_EXCEEDED` | 없음 | 다른 크리에이터 | 다음 후보로 |
| `ESCALATED` | `CREATOR_USAGE_RIGHTS_NOT_ALLOWED` | 없음 | 브랜드가 권리 범위 축소 | 재협상 가능 |
| `ESCALATED` | `CREATOR_MIN_BASE_NOT_MET` | 없음 | 브랜드가 예산 상향 or 다음 후보 | 조건부 |
| `ESCALATED` | `BRAND_POLICY_*` | 없음 | 사람 승인 | 승인 시 계속 |
| `REJECTED` | 정책상 불가 | 없음 | 다음 후보 | 같은 조합은 불가 |
| `EXPIRED` | 라운드/시간 소진 | 없음 | 다음 후보 | 조건 바꿔야 |
| `FAILED` | A2A 502, 게이트웨이 장애 | 없음 | 바운드 재시도 | 가능 |
| `CANCELED` | 사람이 중단 | 없음 | — | — |

### "완결성 있게 올린다"의 정의 — 불변식

모든 Agreement 는 반드시 아래 4개 중 **정확히 하나**로 끝난다. 이걸 테스트로 못 박으면 "어중간하게 끝난 건"이 구조적으로 불가능해진다.

```
1. 에스크로 없음            (협상 미성립 / 펀딩 전 취소)
2. 전액 릴리즈              released == funded
3. 전액 환불                refunded == funded
4. 부분 릴리즈 + 잔액 환불   released + refunded == funded
```

즉 **`released + refunded == funded` 가 종결 상태의 불변식**이고, P0 의 타임락이 "영구 미종결" 을 구조적으로 막는다.

### 바꿀 것

| 파일 | 변경 |
|---|---|
| `backend/libs/domain/models.py` | `NegotiationStatus` 에 `ESCALATED` 추가 |
| `backend/apps/api/routes.py` | 협상 종료 시 `reasonCode` 를 항상 기록 (지금은 정책 위반 코드가 스냅샷에만 있고 상태에 안 붙는다) |
| `backend/tests/` (신규 `test_money_terminality.py`) | 위 불변식 테스트. 모든 종결 경로를 돌려 `released + refunded == funded` 확인 |
| `frontend/src/product/` | 상태×원인별 유저 문구. `docs/18_UI_COPY_AND_STATE_DICTIONARY.md` 에 등록 |

---

## P4 — 플랫폼 지갑과 나가는 비용

### 나가는 비용 4종

| 비용 | 지금 | 원장 |
|---|---|---|
| x402 유료 호출 | 플랫폼 `pay` CLI 지갑 | ✅ `PaymentOperation`, 캡 강제됨 |
| Solana 가스 | relayer 대납, 없으면 유저 부담 폴백 | ❌ 집계 없음 |
| Gemini / Vertex | GCP 청구 | ❌ 런 단위 원가 미상 |
| ATA rent | 토큰계정 생성 시 | ❌ |

수익이 0(`PLATFORM_FEE_BPS = 0`)이므로 이 넷은 전부 순손실이다. v1 에서 수수료를 켜지 않는 건 이미 내려진 결정이니, **먼저 할 일은 수수료가 아니라 원가를 보이게 만드는 것**이다.

### 제안

1. **비용 원장 통합** — `PaymentOperation` 에 `kind` 를 추가해 4종을 한 원장에 모은다: `X402_CALL | GAS_SPONSOR | AI_INFERENCE | ATA_RENT`. 매치런·Agreement 단위로 집계 가능해진다.
2. **런당 원가 노출** — `/dev/admin` 에 매치런 원가(USDC + lamports + Gemini 토큰) 표시. 유닛 이코노믹스를 데모 단계에서부터 관측.
3. **relayer 잔액 모니터** — 현재 relayer 키가 **없을 때만** 폴백한다(`funding.ts:658`). 키가 있는데 SOL 이 0 이면 폴백 없이 제출 단계에서 죽는다. 잔액 임계값 체크를 `preflight.ts` 에 추가하고, 임계 이하면 `gasSponsored: false` 로 폴백.
4. **수수료를 켤 때의 경로** (지금은 안 켬) — 현재 `release_milestone` 은 마일스톤 전액을 크리에이터에게 보내므로 온체인 분배가 없다. 프로그램을 고치지 않고 켜려면 **락 금액 = 협상액 + 플랫폼 수수료** 로 예치하고 릴리즈 시 수수료를 플랫폼 토큰계정으로 별도 전송하는 instruction 을 추가해야 한다. 이건 P0 프로그램 변경과 **한 번에 묶어서** 하는 게 싸다.

---

## P5 — 전통 금융 울타리

### 접점 4개

| 접점 | 지금 | 필요한 것 |
|---|---|---|
| 온램프 (브랜드 KRW → USDC) | 없음 | 예치 수단. 직접 환전은 라이선스 문제 |
| 오프램프 (크리에이터 USDC → KRW) | 없음 | 출금 수단 |
| 세금 | 없음 | 사업소득 3.3% 원천징수, 지급명세서 |
| 증빙 | 없음 | 인보이스·세금계산서, 월별 지급명세 |

### 제안 — 플랫폼이 환전·송금을 직접 하지 않는다

knot 은 **"USDC 정산 원장 + 증빙 생성"** 까지만 책임지고, 법정화폐 전환은 파트너(정산 대행사 또는 거래소 오프램프)에 위임한다. 직접 하면 환전·송금 라이선스와 자금세탁방지 의무가 붙어 제품 범위를 초과한다.

이 전제에서 knot 이 만들어야 하는 것:

| 항목 | 내용 |
|---|---|
| `settlementProfile` | 수취인 실명·사업자번호·계좌·거주지. 크리에이터 온보딩 카드에 추가 |
| 원천징수 계산 | P2 에서 넣어둔 `withholdingUsdc` 를 실제 계산으로 채운다 |
| 인보이스 | Agreement 확정 시 자동 생성. termsHash 를 증빙에 박아 온체인 대조 가능하게 |
| 월별 지급명세 | 브랜드/크리에이터별 집계. 세무 신고용 CSV |
| 파트너 연동 | 오프램프 API. 파트너 선정 전까지는 인터페이스만 |

**선행 조건: 법무·세무 확인.** 코드로 답할 수 있는 부분이 아니다. 다만 P2 에서 데이터모델 3분해를 미리 넣어두면 파트너가 정해진 뒤의 작업량이 크게 줄어든다.

---

## P6 — x402 활용 확장

### 지금

매치런당 1회, pay.sh sandbox 로 유료 견적 API 를 호출한다. 캡·allowlist 가 서버에서 강제되고, **영수증은 어떤 자금 결정도 승인하지 않는다**(`paysh.py` docstring). 해커톤 가산점 요건("에이전트가 사람 개입 없이 x402 로 자율 결제")은 충족하지만, 제품 가치와는 느슨하게 붙어 있다.

### 확장 후보

| 후보 | 가치 | 난이도 |
|---|---|---|
| 크리에이터 지표 검증 유료 API | 팔로워·조회수 진위 확인 → 매칭 품질 직결 | 중 (제공자 선정 필요) |
| 콘텐츠 진위·도달 확인 | Evidence 검증을 유료 데이터로 보강 → P1 판정 정확도 | 중 |
| Gemini 호출 자체를 x402 로 | 원가 원장 통합(P4)과 자연스럽게 맞물림 | 낮 |

### 유지할 원칙

확장하더라도 **x402 영수증이 매칭·락·릴리즈를 승인하지 않는다**는 경계는 유지한다. 유료 API 응답은 신호(signal)이지 권한(authority)이 아니다. 이 경계가 무너지면 "돈 낸 만큼 통과" 구조가 되어 정책 엔진이 무의미해진다.

### sandbox → 실지갑 전환 시

`pay setup` 은 OS 키체인을 쓰므로 서버 환경에서는 별도 처리가 필요하다. 캡은 이미 서버에서 강제되지만(`_paysh_cap_problem`), 실지갑 전환 전에 **일일 캡을 실제 예산으로 재설정**하고 초과 시 알림 경로를 붙인다.

---

## 2. 제안 실행 순서

| 순서 | 범위 | 산출물 |
|---|---|---|
| 1 | P0 결정 2건 (그레이스 기간, PLATFORM 커스터디 승인 방식) | 결정 기록 |
| 2 | P0 프로그램 변경 + P4-4 수수료 훅을 한 번에 | `.agent/execplans/escrow-refund-authority.md`, devnet 재배포 |
| 3 | P1 검증 4단 | `.agent/execplans/evidence-four-way.md` |
| 4 | P2 환불 배선 + 금액 3분해 | `.agent/execplans/refund-wiring.md` |
| 5 | P3 불변식 테스트 + enum 정합 | 같은 PR 에 묶어도 됨 |
| 6 | P4 비용 원장 | `.agent/execplans/cost-ledger.md` |
| 7 | P5 / P6 | 법무·파트너 확인 후 |

`PLANS.md` 규칙대로 각 phase 는 착수 시점에 `.agent/execplans/<phase>.md` 를 먼저 쓴다. 이 문서는 그 위의 로드맵이다.

---

## 3. 지금 막혀 있는 결정

| # | 결정 | 왜 내가 못 정하나 |
|---|---|---|
| 1 | 환불 타임락 그레이스 기간 (제안 7일) | 제품 정책 |
| 2 | `PLATFORM` 커스터디에서 브랜드 환불 승인을 플랫폼이 대신 서명해도 되는가 | 신뢰 모델·법적 성격 |
| 3 | 브랜드 임의 취소 시 크리에이터 보상 (트리거 6) | 제품 정책. 온체인 부분 분배가 필요하면 범위 확대 |
| 4 | `PLATFORM_FEE_BPS` 를 언제 0 이상으로 올리나 | 수익 모델 |
| 5 | 오프램프 파트너 | 외부 계약 |

1·2·3 이 정해지면 P0~P3 은 바로 착수 가능하다. 4·5 는 P4~P5 를 막지만 그 앞은 안 막는다.
