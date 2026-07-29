# KNOT v2 범위와 용어

## 1. MVP 범위

### 사용자 계정

- Firebase email/password
- Brand/Creator role
- tab별 독립 session
- onboarding resume
- `/mypage`

### Brand

- Product source 분석
- Mood 선택
- total budget
- per-deal cap
- Brand Agent
- Draft Promotion
- candidate list
- negotiation list/detail
- Agreement
- Escrow summary
- evidence review
- settlement history

### Creator

- Instagram source 연결
- profile snapshot
- minimum baseline
- blocked categories
- Creator Agent
- `협찬 받기` availability
- offer/negotiation list
- sponsorship detail
- evidence URL
- settlement claim/history

### Agent/A2A

- AgentCard
- Registry
- one-counter multi-turn
- OFFER/COUNTER/ACCEPT/REJECT/ESCALATE
- Task state
- streaming or polling
- Artifact
- sanitized activity timeline
- idempotency

### Web3

- Solana localnet/devnet
- USDC-like devnet mint or approved test asset
- escrow lock
- milestone release
- receipt
- Explorer link
- no mainnet

---

## 2. P1

- pay.sh/x402 receipt
- paid profile verification API
- advanced policy
- multiple concurrent streams
- creator performance bonus
- public reputation
- notification channel

---

## 3. Out of Scope

- 원화/카드 결제
- mainnet
- custody productionization
- KYC/KYB production
- 분쟁·환불 일반화
- 일정 캘린더 자동 협상
- 노쇼 보증금
- 다중 SNS 전체 수집
- 자동 세금 처리
- real-world legal contract
- unrestricted LLM autonomous spending

---

## 4. Glossary

| 용어 | 정의 |
|---|---|
| Brand | 제품 홍보를 요청하고 보수를 예치하는 사용자 |
| Creator | 콘텐츠를 제작하고 보수를 받는 사용자 |
| Manager | 사용자에게 보이는 Agent 명칭 |
| Agent | 탐색·협상·계약·정산 실행 주체 |
| Agent Policy | 외부에 공개되지 않는 가격·업종·한도 기준 |
| Agent Authority | Agent가 사람 승인 없이 실행 가능한 범위 |
| Promotion | Brand의 홍보 프로젝트 |
| Candidate | Promotion에 적합하다고 평가된 Creator |
| Match Run | Promotion 후보를 탐색·평가한 실행 |
| Negotiation | Brand Agent와 Creator Agent 사이 협상 |
| Context | 하나의 Brand–Creator 거래 문맥 |
| A2A Task | 상태가 있는 Agent 간 작업 |
| Message | Agent 간 한 번의 통신 단위 |
| Artifact | Task의 구조화된 최종 결과 |
| Agreement | 합의 조건의 canonical 저장 객체 |
| termsHash | canonical Agreement terms의 SHA-256 |
| Escrow | Agreement 자금을 잠그는 온체인 계정/프로그램 |
| Evidence | Creator가 제출한 콘텐츠 URL과 검증 결과 |
| Milestone | Agreement 금액을 분할 지급하는 조건 |
| Settlement | milestone 충족 후 자금 지급 |
| Receipt | 온체인 transaction 결과 저장 객체 |
| Activity Timeline | canonical 이벤트를 사용자 문장으로 투영한 목록 |
| pay.sh/x402 | Agent가 외부 API 사용료를 호출 단위로 지급하는 결제 |
| Devnet | 실제 네트워크와 유사한 Solana 공용 개발망 |
| Demo Mode | 명시적으로 Mock 데이터를 사용하는 로컬/시연 모드 |

---

## 5. 용어 사용 규칙

사용자 UI:
- `매니저`
- `협찬 프로젝트`
- `협상`
- `계약`
- `에스크로`
- `정산`

코드/DB:
- `Agent`
- `Promotion`
- `Negotiation`
- `Agreement`
- `Escrow`
- `Settlement`

금지:
- 새 코드에서 `campaign`와 `Promotion` 혼용
- `deal`을 canonical collection 이름으로 사용
- `contract hash`로 Agreement ID와 transaction signature를 혼용
- `결제` 하나로 pay.sh와 Promotion Escrow를 혼용

---

## 6. 공개 범위

공개:
- 상대 Agent가 제안한 조건
- 공개 rationale
- Agreement
- Escrow와 milestone

본인 전용:
- 자신의 baseline/cap
- 자신의 blocked categories
- 자신의 private notes

운영 전용:
- raw A2A
- raw model output
- secret
- retry metadata

상대에게 공개 금지:
- 정확한 private threshold
- 전체 policy snapshot
- chain-of-thought
