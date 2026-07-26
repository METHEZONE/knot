# KNOT v1 Product Requirements Document

## Product statement

KNOT은 브랜드와 크리에이터가 DM, 비정형 단가 협상, 계약 파일, 수동 정산을 반복하지 않도록 각자의 에이전트가 정책 범위 안에서 Promotion 조건을 협상하고 Agreement와 Solana escrow까지 연결하는 Agentic Promotion 플랫폼이다.

## Core promise

```text
브랜드가 Promotion을 만들고 자율성 한도를 정한다.
Brand Agent가 적합한 Creator Agent와 실제 A2A로 협상한다.
정책 범위 안에서 합의되면 Agreement가 생성된다.
브랜드가 자금을 escrow에 lock한다.
증빙 조건을 충족하면 creator에게 release된다.
```

## Users

### Brand

- 브랜드 프로필을 한 번 설정
- 여러 Promotion 생성
- 후보 Creator와 Agent 진행 상황 확인
- 체결 Creator 및 Agreement 관리
- escrow funding과 정산 확인

### Creator

- 공개 프로필과 비공개 협상 기준 설정
- 여러 Brand 제안 수신
- Agent가 처리한 제안과 승인 필요 항목 확인
- 진행 중 협찬과 evidence 제출
- 지급 상태 확인

### Dev admin

- 사용자·프로필·Agent·Promotion·Negotiation·Agreement·Escrow 진단
- 테스트 계정과 연결 데이터 안전 삭제
- demo seed/reset
- 실패 작업 제한적 retry
- 감사 로그

## Object model

```text
User Account
└─ Role Profile
   └─ Agent Policy

Brand Profile
└─ Promotion
   └─ Match Run
      └─ Negotiation
         └─ Agreement
            └─ Escrow
               └─ Evidence / Release
```

## Brand golden path

```text
Login
→ role selection
→ one-page Brand onboarding
→ Brand Dashboard
→ Create Promotion
→ Promotion Detail
→ Run Agent
→ Match creators
→ real A2A negotiation
→ Agreement
→ Fund Escrow
→ Evidence verified
→ Release
```

## Creator golden path

```text
Login
→ role selection
→ one-page Creator onboarding
→ Creator Dashboard
→ Receive Offer
→ Agent evaluates / negotiates
→ approve only when required
→ Agreement
→ submit Evidence
→ receive payout
```

## Success criteria

- Login부터 Dashboard까지 실제 인증·실제 Firestore 데이터다.
- 각 사용자는 허용된 자기 데이터만 본다.
- 온보딩은 1페이지이며 제품명·Promotion 조건을 받지 않는다.
- Brand Dashboard는 실제 Promotions와 Agreements를 보여준다.
- Creator Dashboard는 실제 Offers와 Agreements를 보여준다.
- Promotion Detail은 timer animation이 아닌 실제 Agent Activity를 보여준다.
- A2A는 실제 Message, Task, Event, Artifact를 생성한다.
- Agreement와 escrow는 `termsHash`로 연결된다.
- lock/release devnet signature가 표시된다.
- `/dev/admin`에서 disposable 계정을 안전하게 삭제할 수 있다.
- Society Map이 없다.

## Non-goals

- Society Map
- 실제 SNS ingestion·PDF/OCR
- multiple organizations
- 한 사용자의 복수 role
- mainnet
- multiple milestones
- disputes/arbitration
- fiat/card
- production KYC/KYB
- user-specific model servers
- full production admin suite
