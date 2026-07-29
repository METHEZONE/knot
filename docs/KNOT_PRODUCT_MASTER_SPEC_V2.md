# KNOT Product & Implementation Master Specification v2

> **제품:** KNOT  
> **대회:** Google Cloud × Solana AI Agentic Hackathon  
> **Frontend 기준:** `feat/two-user-session`  
> **Backend/Web3 기준:** 실제 기능이 동작하는 안정 브랜치  
> **상태:** 단일 구현 기준

---

## 1. 제품 한 문장

> 브랜드와 크리에이터가 각자의 AI 매니저에게 최소 기준만 알려주면, 매니저들이 상대를 찾고 A2A로 조건을 협상한 뒤 Agreement, Solana USDC 에스크로, 콘텐츠 검증과 정산까지 이어주는 Agentic Promotion 플랫폼.

---

## 2. 핵심 사용자 경험

### Creator

```text
로그인
→ 인스타그램만 연결
→ 마지노선과 금지 카테고리 설정
→ Mina Agent 붙이기
→ Dashboard
→ 협찬 받기 활성화
→ 제안 수신
→ Agent 협상 상세 확인
→ Agreement
→ Escrow
→ 게시물 링크 제출
→ Milestone 정산
```

### Brand

```text
로그인
→ 제품 링크 분석
→ 무드 선택
→ 총예산과 딜당 한도 설정
→ Glow Agent 붙이기
→ Dashboard
→ 협찬 제안하기
→ 후보 탐색
→ Agent 협상
→ Agreement
→ Solana Escrow
→ 콘텐츠 확인
→ Milestone 정산
```

---

## 3. 확정된 제품 결정

### 3.1 Manager 연결과 협상 시작은 분리한다

온보딩의 `매니저 붙이기`는 다음을 수행한다.

```text
Profile 저장
→ Agent Policy 저장
→ Agent 생성·활성화
→ availability=OFFLINE
→ Dashboard 이동
```

바로 협상하지 않는다.

Creator는 Dashboard의 `협찬 받기`를 켰을 때 신규 제안 수신 상태가 된다. Brand는 `협찬 제안하기`를 눌렀을 때 Promotion Match Run과 협상이 시작된다.

### 3.2 Dashboard와 Agent 채팅의 역할

Dashboard:
- Manager 상태
- 사용자가 지금 해야 할 일
- 진행 중 항목
- 최근 Agent 활동 3~5개
- Agreement·Escrow·정산 요약

Negotiation Detail:
- 후보 탐색
- OFFER
- COUNTER
- 정책 판단
- 사람 승인
- Agreement
- Escrow
- Evidence
- Settlement

### 3.3 여러 협상

하나의 Promotion은 여러 Creator Negotiation을 가질 수 있다.

```text
Promotion
├─ Negotiation with Creator A
├─ Negotiation with Creator B
└─ Negotiation with Creator C
```

각 상세 화면에서는 Brand Agent–Creator Agent 한 쌍의 대화만 보여준다.

### 3.4 거절 기록

거절·만료·취소도 저장한다. Dashboard 메인에는 진행 중·승인 필요·최근 합의가 우선이며, `협상 내역`에서 전체 결과를 필터링한다.

### 3.5 마이페이지

모든 설정과 프로필은 `/mypage`로 통합한다. 디자인은 다음 파일을 기준으로 한다.

```text
knot/frontend/src/features/settings/SettingsScreen.tsx
```

헤더의 사용자 영역에서 한 번만 진입한다. 대화 화면의 중복 설정 버튼은 제거한다.

---

## 4. 제품 차별점

- 긴 폼 대신 URL과 핵심 기준 2개로 Agent를 준비한다.
- Agent가 판단하는 과정을 대화형 UI로 보여준다.
- 상대의 비공개 정책은 보호하면서 공개 가능한 이유를 설명한다.
- 협상 결과를 구조화된 Agreement Artifact로 만든다.
- Agreement와 동일한 `termsHash`를 Solana Escrow에 연결한다.
- 콘텐츠 제출과 milestone 정산까지 하나의 Timeline으로 보여준다.

---

## 5. 해커톤 적합성

KNOT은 다음 장면을 실제로 시연해야 한다.

1. Gemini 기반 profile/product 분석
2. 정책을 가진 두 Agent의 A2A 협상
3. 한도 안에서 사람 승인 없는 ACCEPT
4. Agreement Artifact
5. Solana devnet USDC lock
6. Evidence URL 검증
7. Milestone release
8. Transaction signature와 Explorer 링크

`SIMULATED`는 로컬 fixture에만 허용한다. 최종 배포 데모는 실제 devnet 트랜잭션을 목표로 한다.

---

## 6. 결제 구분

```text
pay.sh/x402
= Agent가 외부 API를 호출할 때 사용하는 호출 단위 결제

Promotion Escrow
= Creator 보수를 Agreement에 따라 잠그고 지급하는 Solana USDC
```

둘을 같은 Payment 카드나 상태로 뭉뚱그리지 않는다.

---

## 7. 상태 모델

Promotion:

```text
DRAFT → MATCHING → NEGOTIATING → ACTIVE
→ VERIFYING → SETTLING → COMPLETED
```

Negotiation:

```text
CREATED → OFFERED → COUNTERED → AGREED
                               └→ REJECTED
Optional: ESCALATED / EXPIRED / CANCELED / FAILED
```

Agreement:

```text
FINALIZED → ESCROW_PENDING → FUNDED
→ IN_PROGRESS → COMPLETED
```

Escrow:

```text
NOT_STARTED → PREPARING → SUBMITTED → CONFIRMED
→ PARTIALLY_RELEASED → RELEASED
```

Agent:

```text
status: CREATED / ACTIVE / DISABLED
availability: OFFLINE / AVAILABLE / BUSY
acceptingOffers: boolean
```

---

## 8. 기술 경계

```text
Next.js Frontend
→ Firebase ID Token
→ Product API / Cloud Run
→ Firestore

Product API
├─ Brand Agent / Gemini / ADK
├─ Creator A2A Service / Cloud Run
├─ Policy Engine
├─ Agreement Service
└─ Web3 Gateway / private Cloud Run
                  ↓
             Solana devnet
```

Frontend는 Firestore canonical 데이터를 직접 조합하지 않는다. API가 사용자용 ViewModel과 sanitized timeline을 반환한다.

---

## 9. 개인정보 공개 원칙

양측 공개:
- OFFER/COUNTER
- 산출물
- 사용권
- 마감
- 공개 가능한 이유
- Agreement
- Escrow와 milestone
- Transaction signature

본인에게만 공개:
- 자신의 minimum baseline
- 자신의 blocked categories
- 자신의 budget/cap
- 자신의 private notes

Dev/Admin만:
- taskId
- contextId
- messageId
- raw A2A payload
- retry/correlation metadata

금지:
- 상대의 정확한 private threshold
- raw Gemini prompt/output
- chain-of-thought
- credentials와 secret

---

## 10. 완료 정의

- Login과 onboarding은 two-window UX를 사용한다.
- Manager 연결 후 Dashboard로 이동하고 바로 협상하지 않는다.
- Creator의 `협찬 받기`와 Brand의 `협찬 제안하기`가 Agent 실행점이다.
- Dashboard에는 요약, 상세 화면에는 전체 Agent 대화가 있다.
- 여러 협상과 거절 이력을 조회할 수 있다.
- Agreement, actual devnet escrow, evidence, release가 연결된다.
- `/mypage` 하나로 설정이 통일된다.
- Mock 성공과 실제 성공이 명확히 구분된다.
