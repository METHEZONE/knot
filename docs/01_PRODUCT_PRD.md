# KNOT Product Requirements Document

## 1. 배경

Creator Promotion 시장은 상대 탐색, DM, 단가 협상, 계약, 검수, 정산이 서로 다른 도구와 사람의 수작업으로 분리돼 있다.

Brand는 적합한 Creator를 찾고도 응답을 받지 못하거나, 매번 기준이 다른 가격·사용권·일정을 협상한다. Creator는 제안을 놓치고, 원치 않는 업종을 반복적으로 거절하며, 정산 지연 위험을 부담한다.

KNOT은 각 사용자에게 AI Manager를 붙이고, 사용자가 정한 기준 안에서 Agent가 탐색·협상·계약·에스크로·정산을 수행하게 한다.

---

## 2. 목표 사용자

### Primary: 소규모·중소 Brand 운영자

- Agency 없이 Creator Promotion을 운영한다.
- 제품 단위 예산과 딜당 한도를 관리해야 한다.
- Creator 탐색, 협상, 계약, 정산을 한 화면에서 보고 싶다.

### Primary: 마이크로·미드티어 Creator

- Instagram Reel 중심의 협찬을 받는다.
- 최소 단가와 하지 않을 업종이 명확하다.
- 제안 선별과 협상을 Agent에게 맡기고 싶다.
- Escrow와 지급 상태를 투명하게 보고 싶다.

### Secondary: 운영·개발 담당자

- A2A Task, API 상태, transaction receipt를 진단한다.
- 일반 사용자 UI와 분리된 Dev/Admin을 사용한다.

---

## 3. Job To Be Done

Brand:

> 제품을 홍보할 Creator를 찾고 싶을 때, 예산과 무드만 알려주면 내 Agent가 적합한 후보를 찾고 조건을 협상해 실제 계약과 에스크로까지 끝내주길 원한다.

Creator:

> 협찬 제안이 들어올 때, 내 최소 단가와 금지 업종을 기억하는 Agent가 자동으로 선별·역제안하고, 합의된 돈이 Escrow에 잠겼는지 확인해주길 원한다.

---

## 4. 문제

### Brand Pain

- 후보 탐색에 시간이 많이 든다.
- DM 응답률과 협상 상태를 관리하기 어렵다.
- 예산을 넘는 계약을 사전에 통제하기 어렵다.
- 계약과 지급 상태가 분리돼 있다.
- 여러 Creator와의 협상 내역을 한눈에 보기 어렵다.

### Creator Pain

- 제안을 놓친다.
- 낮은 가격에 반복 대응한다.
- 금지 업종을 매번 직접 거절한다.
- 협상 결과와 지급 보장이 약하다.
- 게시 후 정산 시점과 잔액을 알기 어렵다.

---

## 5. 솔루션

### 최소 온보딩

Brand:
- 제품 URL
- 무드
- 총예산
- 딜당 한도

Creator:
- Instagram username
- 마지노선
- 금지 카테고리

### Agent 실행

- Brand Agent: 후보 탐색, OFFER, budget policy, ACCEPT/ESCALATE
- Creator Agent: inbound evaluation, minimum policy, COUNTER/REJECT
- 사람: 정책을 설정하고 한도 밖의 요청만 승인

### 신뢰 레이어

- A2A Task와 메시지 기록
- 구조화 Agreement
- `termsHash`
- Solana USDC Escrow
- Evidence와 milestone release
- Transaction receipt와 Explorer

---

## 6. 제품 원칙

1. **짧게 입력하고, 깊게 자동화한다.**
2. **Agent의 행동은 눈에 보이지만, private policy는 숨긴다.**
3. **대화는 설명 UX이고, Agreement가 법적·시스템 결과다.**
4. **LLM은 제안하고 deterministic policy가 결정한다.**
5. **결제 성공은 transaction receipt로 증명한다.**
6. **한 화면에는 하나의 primary action만 둔다.**
7. **Mock과 실제 실행을 혼동시키지 않는다.**

---

## 7. 핵심 사용자 시나리오

### Happy Path

1. Creator가 Instagram을 연결한다.
2. 300 USDC와 금지 업종을 설정한다.
3. Mina Agent를 붙인다.
4. Dashboard에서 `협찬 받기`를 켠다.
5. Brand가 제품 URL, 무드, 2,000/800 USDC를 설정한다.
6. Glow Agent를 붙이고 `협찬 제안하기`를 누른다.
7. 후보 3명 중 @demobeauty를 선택한다.
8. Glow Agent가 240 USDC를 OFFER한다.
9. Mina Agent가 300 USDC를 COUNTER한다.
10. Glow Agent가 cap 내에서 ACCEPT한다.
11. Agreement와 `termsHash`가 생성된다.
12. 300 USDC가 Solana devnet Escrow에 잠긴다.
13. Creator가 Reel URL을 제출한다.
14. 검증 후 30/70 milestone이 지급된다.

### Policy Reject

- Creator blocked category에 해당한다.
- Creator Agent가 REJECT한다.
- Brand에는 sanitized reason만 보인다.
- Agreement와 Escrow는 생성되지 않는다.

### Human Approval

- Creator COUNTER가 Brand per-deal cap을 넘는다.
- Task가 승인 필요 상태가 된다.
- Brand가 승인, 수정, 거절한다.
- 같은 Task로 협상을 재개한다.

---

## 8. 목표

### P0

- 두 역할의 실제 Firebase 로그인
- two-window 온보딩
- Agent 연결
- 역할별 Dashboard
- Agent 활성화
- Promotion과 후보
- 실제 A2A OFFER→COUNTER→ACCEPT
- Agreement Artifact
- Solana devnet Escrow
- Evidence URL
- Milestone release
- 실제 receipt/Explorer
- `/mypage` 통합

### P1

- pay.sh/x402 API spend receipt
- 여러 협상 동시 streaming
- social refresh
- advanced policy
- performance bonus

---

## 9. 제외

- Mainnet
- 원화 결제
- 완전한 Instagram private API 연동
- 다중 SNS
- 캘린더 재협상
- 노쇼 보증금
- 복잡한 분쟁 중재
- 평판 그래프 고도화
- 대규모 marketplace
- 임의 상태를 수정하는 Admin

---

## 10. 성공 지표

제품:
- 신규 사용자가 2분 안에 Agent 연결
- Brand가 3분 안에 첫 Negotiation 시작
- 최소 한 번의 A2A COUNTER
- Agreement 생성 성공률
- Escrow lock/release 성공률
- 중복 Agreement·지급 0건

데모:
- 3분 안에 핵심 흐름 이해
- 실제 devnet signature 표시
- 두 Agent의 정책 차이를 UI로 설명
- Dashboard와 상세 대화의 역할이 명확
- 심사위원이 “왜 Agent와 Solana가 필요한가”를 바로 이해
