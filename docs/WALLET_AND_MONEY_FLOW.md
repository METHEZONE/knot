# knot — 지갑 & 자금 흐름 스펙 (v0.1)

작성: 효창(블록체인 레인). 목적: **2-지갑 모델 + 자금 흐름(에이전트 지갑 top-up)** 을 확정하고, 프론트/백엔드/웹3 레인별 **단계별 구현 계획**을 팀 합의 기준으로 남긴다. (이 문서 자체가 다음 개발의 청사진.)

관련: `docs/architecture.md`(온체인 레퍼런스), PRD v2 §14(지갑 커스터디 blocked 항목), IMPLEMENTATION_STATUS(에스크로 devnet 배포 완료 상태).

---

## 1. 두 개의 지갑
| | 유저 지갑 | 에이전트 지갑 |
|---|---|---|
| 소유/수탁 | **비수탁 — 유저 소유(Phantom)** | **수탁 — 플랫폼(GCP Secret Manager)** |
| 위치(UI) | Settings ▸ **WALLET 카드** (현재 `not-connected`) | Settings ▸ **AGENT 카드**(read-only 표시) |
| 역할 | 실제 돈의 출발/귀환점. 예산 top-up, 잔액 반환 수령 | 자율 서명(에스크로 락/릴리즈, pay.sh 결제) |
| 서명 | 브라우저에서 Phantom(wallet-adapter) | 서버 게이트웨이가 SM 키로 서명 |

## 2. 자금 흐름 (핵심 — top-up 모델)
```
① 유저 Phantom ──(예산 top-up, 유저가 Phantom 서명)──▶ ② 에이전트 지갑(SM)
                                                          │
                                          ③ 보유예산 + auto_approve_cap 이내 자율 결제
                                             (딜 에스크로 락/릴리즈, pay.sh API)
                                                          │
                        ┌─────────────────────────────────┼─────────────────────────┐
                        ▼                                                             ▼
              ④ 남음(leftover) → 유저 알림 + Phantom 반환 옵션        ⑤ 부족(shortfall) → 유저에게 top-up 요청 알림
```
- **사람 서명은 ① top-up 한 번**(+ cap 초과/shortfall 시 승인)뿐. ②~③은 에이전트 자율 → 해커톤 "사람 없는 자율 결제" score 컷.
- 돈의 시작 = 유저 지갑, 운영 = 에이전트 지갑, 정산 후 잔액/부족은 알림으로 유저에게 되돌린다.

## 3. 서명 매핑
| 동작 | 서명자 | 위치 |
|---|---|---|
| 예산 top-up (유저→에이전트 지갑) | 유저 Phantom | 클라이언트 |
| 에스크로 락 / 마일스톤 릴리즈 (cap 이내) | 에이전트 SM 키 | 서버 게이트웨이(자율) |
| cap 초과 딜 / shortfall | 유저 승인(Phantom) 또는 top-up | 알림 → 클라이언트 |

## 4. 온체인 변경 (`programs/knot-escrow`) — 효창
- `initialize_campaign`을 **`agent_authority`(에이전트 지갑)가 서명·펀딩** 가능하게 확장(현재는 `brand` 사람 서명 강제). 에이전트가 자기 지갑(`agent_token`)에서 vault로 락 → top-up 모델과 정합.
- `approve_and_release`: 이미 `agent_authority` cap 이내 서명 지원 → 유지.
- cap 초과·잔액 부족 시 실패 → 백엔드가 알림 이벤트로 변환.
- USDC-SPL(devnet) 유지. 프로그램 변경 시 재배포 → program id 갱신 → 게이트웨이/`pdas.py`/env 동기화 필요.

## 5. 에이전트 지갑 프로비저닝 (Secret Manager) — 효창(+예원 hook)
- 역할 선택(`/me/role`)/온보딩 시: **Solana 키페어 생성 → 비밀키를 Secret Manager**(`knot-agent-key-{agentId}`)에 저장 → **pubkey를 `agents/{agentId}` 문서에 기록**.
- Cloud Run 런타임 SA에 `secretmanager.secretAccessor` 부여. 게이트웨이(`web3/gateway/src/solana.ts`)가 env 고정 키 대신 **SM에서 에이전트 키 로드**하도록 교체.
- 참고: 지금 게이트웨이는 brand/creator/agent 키를 env(JSON/path)로 로드하는 데모 방식 → 이걸 SM per-agent로 승격.

## 6. 유저 지갑 연결 (Phantom) — 민성/ddol9 (FE 라이브 작업과 충돌 방지: 스펙만)
- Settings **WALLET 카드**: `not-connected` → **"Phantom 연결"**(`@solana/wallet-adapter` + Phantom). 연결 시 pubkey를 **`users/{uid}.walletAddress`** 저장(현재 `null`).
- **top-up**: Phantom에서 에이전트 지갑으로 USDC-SPL 전송 tx를 **클라이언트 서명**.
- (선택) AGENT 카드에 에이전트 지갑 주소 read-only 표시 → 신뢰.

## 7. 알림 (leftover / shortfall) — 예원(백엔드) + 민성(FE)
- Firestore `notifications` 컬렉션 + FE 표시. 이벤트: `BUDGET_LEFTOVER`, `BUDGET_SHORTFALL`, `DEAL_NEEDS_APPROVAL`(cap 초과).
- 정산 완료/실패 시 백엔드가 잔액 계산 → 이벤트 발행.

## 8. 단계별 구현 계획
| Stage | 내용 | 레인 | 상태 |
|---|---|---|---|
| 1 | 에스크로 프로그램 **agent-funded** 변경 + 빌드/테스트 | 효창 | ▶ 다음(내가 착수) |
| 2 | 에이전트 키 생성 → Secret Manager 저장 → 게이트웨이 SM 로드 + Cloud Run SA IAM | 효창(+예원 hook) | 대기 |
| 3 | `/me` 지갑 필드/엔드포인트(`walletAddress`), top-up/알림 백엔드 | 예원 | 대기 |
| 4 | Settings Phantom 연결 UI, top-up UI, 알림 UI | 민성/ddol9 | **스펙 제공(직접수정 X)** |
| 5 | E2E: Phantom top-up → 에이전트 자율 정산 → 알림 (devnet) | 전원 | 대기 |

## 9. 팀 결정 필요 (Open)
- **자동 락 범위**: cap 이내 딜을 에이전트가 자동 락까지(완전 자율) vs 딜마다 사람 승인. → **권장: cap 하이브리드**(이내 자동, 초과 사람 승인+Phantom).
- 요율/한도(auto_approve_cap, 예산 상한) 기본값.
- 에이전트 키 로테이션/복구 정책(v2), 유저 자기소유 마이그레이션(Privy/Turnkey 임베디드) 시점.

---
> 진행: 이 스펙 확정 후 **Stage 1(효창)** 부터 브랜치 PR로 순차 구현. FE(Stage 4)는 본 스펙을 기준으로 프론트 오너가 구현(충돌 방지).
