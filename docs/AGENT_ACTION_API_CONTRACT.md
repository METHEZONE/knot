# 에이전트 액션 API 계약 (프론트 인수인계)

작성: 효창(블록체인 백엔드). 대상: 민성/ddol9(프론트).
관련: `docs/24_UX_JOURNEY_v1.md`(민성 승인 — 정산·협상을 홈 채팅 카드로 흡수), `docs/WALLET_AND_MONEY_FLOW.md`.

## 왜 이 문서가 있나

승인된 UX 여정에서 **정산·마일스톤·계약서는 별도 페이지가 아니라 채팅 카드**다. 그래서 백엔드 쪽에서
화면을 만들지 않고, **카드가 호출할 API 시퀀스만 확정해 넘긴다.** 아래 전 구간은 로컬넷에서 실서명으로
검증했다(락/릴리즈 서명 발생 → 크리에이터 USDC 온체인 수령 확인).

현재 프론트에 **배선이 없는 것**(legacy 라우트가 리다이렉트로 바뀌면서 트리거가 사라졌다):

| 없는 것 | 원래 있던 자리 | 필요한 호출 |
|---|---|---|
| 매칭·협상 시작 | `/brand/negotiate`, `/brand/matching` → redirect | `runMatches` → `startNegotiation` |
| 정산 실행(락·증빙·검증·릴리즈) | `/brand/settlement` → redirect (`SettlementActionPanel` 이 여기 묶여 있다) | 아래 §2 |
| Phantom 주소 되읽기 | Settings 지갑 카드 | `GET /me` 의 `account.walletAddress` 바인딩(현재 mock 값 표시) |

`apiClient` 에는 메서드가 이미 다 있다(`runMatches`, `startNegotiation`, `lockEscrow`, `submitEvidence`,
`verifyEvidence`, `releaseMilestone`, `listMyNotifications`). **화면에서 부르는 곳만 없다.**

## 1. 위임 → 협상 → 합의

```
POST /api/v1/promotions/{promotionId}/matches:run          → matchRun.matchRunId
GET  /api/v1/match-runs/{matchRunId}/candidates            → 후보 카드용(적합도)
POST /api/v1/match-runs/{matchRunId}:start-negotiation     → { negotiation, agreement }
GET  /api/v1/negotiations/{id}/messages                    → 인용 버블(A2A 원문, 라운드)
```
- 협상 원문·라운드는 `messages`로 흐른다 → 여정 §5의 타이핑 인디케이터/라운드 카운터 소스.
- 정책 차단(빨간 도장)은 4xx 의 `code`(예: `POLICY_VIOLATION`)와 `detail` 을 그대로 쓰면 된다.

## 2. 정산 — 락 → 증빙 → 검증 → 릴리즈

```
POST /api/v1/agreements/{agreementId}/escrow:lock            [Idempotency-Key 필수]
     → escrow.escrowId, escrow.lockSignature (실서명), escrow.status
POST /api/v1/agreements/{agreementId}/evidence               body: { url, submittedByAgentId, milestoneId }
POST /api/v1/evidence/{evidenceId}:verify                    → evidence.verificationResult = PASSED
POST /api/v1/escrows/{escrowId}/milestones/{milestoneId}:release   [Idempotency-Key 필수]
     → settlement.status = CONFIRMED, settlement.signature
```
카드에 뿌릴 값: `lockSignature`(에스크로 잠김 카드), `settlement.signature` + 금액(정산 완료 카드),
`GET /api/v1/agreements/{id}` 의 마일스톤 `status`(마일스톤 카드).

**Idempotency-Key 없이 부르면 400이다.** 같은 키로 다시 부르면 같은 결과가 돌아온다(중복 정산 없음).

## 3. 지갑 / 알림 카드

```
GET  /api/v1/me                → account.walletAddress      (유저 Phantom 지갑, 비수탁)
                                 account.agentWalletPubkey   (에이전트 지갑, 수탁·read-only)
POST /api/v1/me/wallet         body: { walletAddress }       (Phantom 연결 후 저장)
GET  /api/v1/me/notifications  → BUDGET_LEFTOVER / BUDGET_SHORTFALL / DEAL_NEEDS_APPROVAL
```
알림은 스키마·조회는 살아 있고 **발행 트리거가 아직 안 붙었다**(정산 라이브 시 연결). 지금은 빈 배열이 정상.

## 4. 프론트가 알아야 할 제약

- **cap 초과는 사람 승인**: 프로모션 생성 시 `autoEscrow`/`autoRelease` 는 기본 위임(true)이고, 금액이
  `autoAcceptCeiling` 을 넘으면 정책이 락을 막는다 → 그때가 여정 §1의 "한도를 넘을 때만 물어본다" 지점.
  (이전에는 이 값이 false로 하드코딩돼 앱에서 만든 프로모션은 정산이 영구 차단됐다. 수정됨.)
- **성공 = 실서명**: Product API 는 게이트웨이가 확인한 실제 Solana 서명이 없는 영수증을 정산 성공으로
  받지 않는다. 서명이 없으면 `FAILED` 영수증이 남는다 → 카드에서 실패로 표시할 것.
- **금액 단위**: 카드 표시는 USDC, API 일부는 baseUnits(6 decimals) 문자열이다. 섞지 말 것.

## 5. 로컬에서 이 흐름 직접 확인하기

```bash
.venv/bin/python scripts/local/localnet_bootstrap.py   # 로컬넷 + 프로그램 + mint/config
scripts/local/dev_stack.sh                             # 5개 서비스 (Auth 에뮬레이터 포함)
scripts/local/settlement_smoke.sh [promotionId]        # 위 §1~§2 전 구간을 실서명으로 실행
```
카드를 붙인 뒤에는 스모크 없이 화면에서 같은 결과(서명·금액·마일스톤 상태)가 나와야 한다.
