# KNOT 제품 플로우 및 기능 정리

**기준일:** 2026-07-26  
**범위:** 현재 KNOT v1 Product MVP 기준  
**작업 브랜치:** `integration/frontend-backend-api`

이 문서는 현재 저장소에 구현되어 있고 로컬/Cloud Run에서 확인 가능한
프로덕트 플로우와 기능을 정리한다. 현재 MVP는 복잡한 전체 문서팩 구조가
아니라, 브랜드와 크리에이터가 각자의 에이전트를 통해 제안, 매칭, 협상,
합의, 마일스톤/정산 상태를 확인하는 간단한 흐름에 집중한다.

Society Map은 MVP 범위에서 제외했다.

## 1. 제품 한 줄 설명

KNOT은 브랜드와 크리에이터가 직접 DM, 엑셀, 계좌이체로 협업을 관리하지
않고, 각자의 에이전트가 조건을 확인하고 협상한 뒤 합의와 정산 상태까지
이어주는 Agentic Promotion 플랫폼이다.

루트 페이지에서 유지해야 하는 핵심 문구:

```text
크리에이터랑 브랜드, 에이전트끼리 만나서 매듭 짓는 곳

당신이 자는 동안, 당신의 에이전트가 딜을 협상하고,
계약하고, 정산합니다.
```

루트 페이지에 포함된 문제 정의:

```text
브랜드는 DM을 50개 보내고, 답장은 3개 받아요.
크리에이터는 제안을 놓치고, 단가는 눈치게임,
정산은 엑셀과 계좌이체로 끝나죠.
```

## 2. 현재 전체 흐름

현재 제품은 세 가지 큰 흐름으로 나뉜다.

```text
Public / Entry
  -> 로그인 또는 회원가입

Brand
  -> 브랜드 온보딩
  -> 제품/Promotion 생성
  -> 크리에이터 매칭 및 에이전트 협상
  -> 협상 결과
  -> 정산 상태

Creator
  -> 크리에이터 온보딩
  -> 협상 기준 설정
  -> 에이전트가 처리한 제안 결과
  -> 브랜드별 상세 페이지
  -> 마일스톤 및 정산 상태
```

핵심 UX 원칙:

- 사용자가 모든 제안과 counter를 직접 작성하는 구조가 아니다.
- 브랜드 에이전트와 크리에이터 에이전트가 A2A 구조로 협상하는 것처럼
  보이도록 설계되어 있다.
- 사용자는 협상 진행 상태와 결과를 볼 수 있다.
- 상대방에게 공개되면 안 되는 내부 기준은 화면에 노출하지 않는다.
- 최종 결과에는 공개 가능한 합의 조건과 `termsHash`를 보여준다.

## 3. 현재 배포 및 실행 상태

현재 오프체인 런타임은 Google Cloud 기준으로 구성되어 있다.

| 영역 | 현재 상태 |
|---|---|
| Frontend | Next.js + TypeScript, Cloud Run 배포 가능 |
| Product API | Python FastAPI, Cloud Run 배포 가능 |
| Database | Google Cloud Firestore Native 모드 |
| Auth | 현재는 `local-demo` 계정 bootstrap. Firebase Auth는 아직 미연동 |
| SNS 분석 | 실제 SNS 분석 미연동. 현재는 사용자가 입력한 SNS URL 기반으로 프로필/요약을 생성하는 수준 |
| PDF/문서 분석 | 실제 PDF 업로드/분석 미연동. 현재는 제품 문서 입력 영역만 존재 |
| Web3 결제 | 이번 프론트/백엔드 연동 범위에서는 제외. Product API 영수증은 `SIMULATED` |

현재 Cloud Run URL:

```text
Frontend: https://knot-web-260001601654.us-central1.run.app
Backend:  https://knot-api-260001601654.us-central1.run.app
```

로컬 테스트 기준:

```text
Frontend: http://localhost:3000
Backend:  http://127.0.0.1:18080
```

백엔드 readiness 확인:

```text
GET /readyz
```

`healthz`, `readyz`의 `z`는 운영용 health check에서 자주 쓰는 관례다.
비즈니스 API가 아니라 서비스 상태 확인용 엔드포인트다.

## 4. 라우트 구조

현재 주요 라우트는 아래와 같다.

```text
/
/login
/signup
/signup/brand
/signup/creator

/brand/onboarding
/brand/products/new
/brand/negotiate
/brand/result
/brand/settlement
/brand/me
/brand/settings

/creator/onboarding
/creator/criteria
/creator/result
/creator/agreements/{agreementId}
/creator/me
/creator/settings

/dev/admin
```

호환용 redirect:

```text
/brand/matching -> /brand/negotiate
/creator/negotiate -> /creator/result
/creator/offers -> /creator/result
/creator/milestones -> /creator/result
```

현재 화면 구조는 numbered stepper가 아니다. 온보딩 이후에는 브랜드가 여러
Promotion을 만들 수 있고, 크리에이터도 여러 브랜드 제안을 받을 수 있기
때문이다.

현재 네비게이션 원칙:

- 헤더에는 큰 범주의 이동만 둔다.
- 각 페이지의 제목은 페이지 상단에 둔다.
- `My`, `Settings`는 거래 플로우의 단계가 아니라 계정 관련 페이지다.
- 내부 사이드바나 01/02/03 단계처럼 보이는 구조는 제거했다.

## 5. Public / Entry 플로우

### `/`

목적:

- KNOT 서비스 소개
- 브랜드/크리에이터 데모 진입
- 로그인/회원가입 진입

주요 CTA:

- Brand로 시작
- Creator로 시작
- Login
- Sign up

루트 페이지는 waitlist만 남긴 페이지가 아니라, 초기에 있었던 긴 설명형
랜딩 페이지를 유지하는 방향이다.

## 6. 로그인 / 회원가입 플로우

### `/login`

목적:

- 기존 사용자가 브랜드 또는 크리에이터 역할로 진입

현재 동작:

- 이메일, 표시 이름, 역할을 입력한다.
- 프론트는 Next proxy를 통해 Product API에 요청한다.
- API는 `users/{userId}` 문서를 생성하거나 갱신한다.
- 브라우저에는 local role session만 저장한다.
- 선택한 역할에 따라 온보딩 페이지로 이동한다.

API:

```text
POST /api/v1/users:bootstrap
```

현재 제한:

- 실제 Firebase Auth 로그인은 아직 아니다.
- 비밀번호, 토큰, private key, seed phrase, 결제 권한은 저장하지 않는다.

### `/signup`

목적:

- 신규 사용자가 브랜드/크리에이터 중 하나를 선택

흐름:

```text
/signup
  -> /signup/brand
  -> /brand/onboarding

/signup
  -> /signup/creator
  -> /creator/onboarding
```

회원가입은 계정 context를 만든 뒤, 역할별 온보딩을 통해 실제 브랜드 또는
크리에이터 프로필을 생성하는 구조다.

## 7. 브랜드 유저 플로우

브랜드 기준 전체 흐름:

```text
로그인 / 회원가입
  -> 브랜드 온보딩
  -> 제품/Promotion 생성
  -> 크리에이터 매칭 및 에이전트 협상
  -> 협상 결과
  -> 정산 상태
```

### 7.1 브랜드 온보딩

Route:

```text
/brand/onboarding
```

목적:

- 브랜드 기본 정보 생성
- Brand Agent context 생성

현재 입력값:

- Brand website URL
- Brand name
- Category
- Target audience
- Restricted claims

API:

```text
POST /api/v1/brands:onboard
```

저장되는 데이터:

- `brands/{brandId}`
- `agents/{brandAgentId}`
- `users/{userId}`의 brand role context

현재는 website URL을 넣으면 실제 웹사이트를 크롤링하거나 LLM으로 분석하는
것은 아니다. 입력값 기반으로 브랜드 요약과 에이전트 context를 생성한다.

### 7.2 제품 / Promotion 생성

Route:

```text
/brand/products/new
```

목적:

- 협찬을 구할 제품과 Promotion 조건을 생성
- Brand Agent가 협상에 사용할 공개 가능한 조건을 정의

현재 입력값:

- Product document hint
- Promotion title
- Category
- Target audience
- Budget
- Maximum offer per creator
- Deliverables
- 제외 조건 / prohibited claims

API:

```text
POST /api/v1/promotions
```

저장되는 데이터:

- `promotions/{promotionId}`

현재 상태:

- PDF/파일 업로드 UI는 실제 업로드/분석까지 연결되어 있지 않다.
- Product document 입력 영역은 향후 PDF/제품 문서 분석을 붙이기 위한
  자리다.
- 새로 만든 Promotion은 API mode에서 최신 Promotion으로 우선 조회된다.

상대방에게 숨겨야 하는 정보:

- 브랜드 내부 hard maximum
- 내부 승인 기준
- 내부 평가 점수
- 결제 권한/지갑 관련 민감 정보

### 7.3 크리에이터 매칭 및 협상

Route:

```text
/brand/negotiate
```

목적:

- Brand Agent가 크리에이터 후보를 찾고 협상을 진행하는 상태를 보여준다.
- 사용자가 직접 하나하나 메시지를 보내는 느낌이 아니라, 에이전트가
  처리 중이라는 UX를 제공한다.

API mode에서 호출되는 흐름:

```text
GET  /api/v1/promotions
POST /api/v1/promotions/{promotionId}/matches:run
GET  /api/v1/match-runs/{matchRunId}/candidates
POST /api/v1/match-runs/{matchRunId}:start-negotiation
GET  /api/v1/promotions/{promotionId}/timeline
```

브랜드 화면에 보이는 정보:

- 크리에이터 후보 ranking 완료
- A2A offer/counter/accept 진행 상태
- 에이전트가 협상 중이라는 애니메이션/로딩 상태
- 공개 가능한 합의 조건
- Agreement Artifact 생성 상태

브랜드 화면에 보이지 않는 정보:

- 크리에이터의 private minimum
- 크리에이터가 피하고 싶은 도메인
- 크리에이터의 private pricing preference
- 전체 raw A2A payload

### 7.4 브랜드 협상 결과

Route:

```text
/brand/result
```

목적:

- 에이전트 협상이 끝난 뒤 결과를 확인한다.

표시 정보:

- 협상 상대 크리에이터
- 합의된 금액
- deliverables
- usage rights
- deadline
- `termsHash`
- A2A Task 완료 상태

이 화면은 사람이 직접 작성한 계약서가 아니라, 에이전트 협상 결과로 생성된
Agreement Artifact를 보여주는 역할이다.

### 7.5 브랜드 정산

Route:

```text
/brand/settlement
```

목적:

- 합의된 Promotion의 evidence, escrow, release 상태를 확인한다.

API mode에서 호출되는 흐름:

```text
POST /api/v1/agreements/{agreementId}/evidence
POST /api/v1/evidence/{evidenceId}:verify
POST /api/v1/agreements/{agreementId}/escrow:lock
POST /api/v1/escrows/{escrowId}/milestones/{milestoneId}:release
GET  /api/v1/promotions/{promotionId}/timeline
```

표시 정보:

- escrow amount
- released amount
- pending amount
- milestone list
- evidence verification status
- receipt status

중요한 분리:

```text
Agent API Spend
  = 에이전트가 외부 API/pay.sh/x402 호출에 쓰는 비용

Deal Escrow
  = 브랜드가 크리에이터 보수로 잠그고 release하는 금액
```

현재 이 화면의 escrow/release receipt는 API-backed이지만 실제 온체인
서명이 아니라 `SIMULATED` 상태다. `KNOT_WEB3_MODE=gateway`를 사용하면
Product API가 private web3 gateway의 lock/release endpoint를 호출하고,
해당 gateway receipt를 `transactionReceipts.gatewayReceipt`에 저장한다.
현재 gateway도 서명 전 단계라 실제 Solana signature는 아직 만들지 않는다.

## 8. 크리에이터 유저 플로우

크리에이터 기준 전체 흐름:

```text
로그인 / 회원가입
  -> 크리에이터 온보딩
  -> 협상 기준 설정
  -> 에이전트가 처리한 제안 결과
  -> 브랜드별 상세 페이지
  -> 마일스톤 및 정산 상태
```

### 8.1 크리에이터 온보딩

Route:

```text
/creator/onboarding
```

목적:

- 크리에이터 기본 프로필 생성
- Creator Agent context 생성

현재 입력값:

- Creator name
- Instagram / TikTok / YouTube URL
- Primary category

API:

```text
POST /api/v1/creators:onboard
```

저장되는 데이터:

- `creatorProfiles/{creatorId}`
- `agents/{creatorAgentId}`
- `agentPolicies/{creatorAgentId}` 초기값
- `users/{userId}`의 creator role context

현재 SNS 분석 상태:

- 실제 Instagram/TikTok/YouTube 데이터를 가져와 분석하지 않는다.
- SNS URL 유효성 확인과 입력값 기반 프로필 생성까지만 되어 있다.
- 화면의 분석/요약은 현재 demo-level summary다.
- 실제 SNS ingestion, engagement 분석, 카테고리 추정, rate band 추천은
  후속 작업이다.

### 8.2 협상 기준 설정

Route:

```text
/creator/criteria
```

목적:

- Creator Agent가 제안을 판단할 때 사용할 private 기준을 설정한다.

현재 입력값:

- Minimum amount in USDC
- Blocked domains
- Preferred content types
- Usage rights preference
- Notes

피하고 싶은 도메인 예시:

- 담배
- 도박
- 고위험 금융
- 의료 효능 과장
- 정치 광고

선호 콘텐츠 예시:

- Instagram Reels
- 제품 리뷰
- 스토리 링크
- UGC 컷다운

API:

```text
POST /api/v1/creators/{creatorId}/criteria
```

저장되는 데이터:

- `agentPolicies/{creatorAgentId}`의 creator policy 영역

중요:

- minimum amount, blocked domains, private notes는 Creator Agent 내부 판단용이다.
- 브랜드 화면에는 이 값들이 직접 노출되지 않는다.
- 브랜드는 `수락됨`, `counter됨`, `거절됨`, `검토 필요` 같은 결과와 공개 가능한
  이유만 볼 수 있다.

### 8.3 크리에이터 결과 페이지

Route:

```text
/creator/result
```

목적:

- Creator Agent가 여러 브랜드 제안을 어떻게 처리했는지 보여준다.

표시 정보:

- 브랜드명
- 제품명
- 협상 상태
- 공개 가능한 결과 요약
- 합의 금액
- `termsHash`

숨기는 정보:

- 브랜드의 hard maximum
- 브랜드 내부 candidate score
- 전체 A2A 메시지 전문
- 내부 policy snapshot

### 8.4 Agreement 상세 / 마일스톤

Route:

```text
/creator/agreements/{agreementId}
```

목적:

- 특정 Agreement의 합의 결과, 수행해야 하는 작업, 정산 상태를 확인한다.

합의된 deal에서 표시되는 정보:

- Agreement terms
- Milestones
- Creator action per milestone
- Progress percent
- Escrow status
- Released amount
- Pending amount

합의되지 않은 deal에서는:

- 공개 가능한 결과 요약만 보여준다.
- 마일스톤/정산 플로우는 노출하지 않는다.

## 9. Agent / A2A UX 설계

현재 UX는 “사람이 모든 단계를 직접 수행하는 화면”이 아니라 “에이전트가
협상 중이고 사용자는 진행 상황과 결과만 확인하는 화면”을 목표로 한다.

UX 원칙:

- 사용자는 제안/반박/수락 메시지를 직접 하나씩 보내지 않는다.
- 화면에는 `진행중이에요!` 같은 에이전트 진행 상태와 애니메이션을 보여준다.
- 내부 판단 전체가 아니라 sanitized progress를 보여준다.
- 최종 결과에는 공개 가능한 terms와 `termsHash`를 보여준다.
- 양측 private policy는 상대방에게 숨긴다.

기술적 경계:

- 브라우저는 official A2A `Message`, `Task`, `Artifact` payload를 직접 만들지 않는다.
- 프론트는 Product API가 만든 projection을 소비한다.
- 백엔드는 Negotiation messages/events, A2A Task, A2A Artifact, Agreement를
  repository boundary를 통해 저장한다.
- Product API는 `KNOT_CREATOR_A2A_MODE=http` 설정 시 Creator A2A 서비스의
  `/message:send`를 호출한다. 로컬 기본값은 seed 재현성을 위해 in-process
  A2A fallback이다.
- `KNOT_GEMINI_MODE=vertex` 설정 시 Product API와 Creator Agent는 Vertex AI
  Gemini를 표시용 candidate explanation과 Creator Agent rationale 생성에
  사용한다. Gemini 출력은 매칭 점수, 후보 자격, 계약 조건, escrow
  lock/release 승인에는 영향을 주지 않는다.

## 10. Dev 관리자 페이지

Route:

```text
/dev/admin
```

목적:

- 현재 앱이 mock mode인지 API mode인지 확인
- Product API 연결 상태 확인
- 주요 integration boundary 확인

표시 항목:

- Auth/session projection
- Product API repository boundary
- A2A projection boundary
- deterministic policy checks
- escrow receipt state

API mode에서는 `/readyz`로 Product API readiness를 확인한다.

## 11. 데이터 모드

프론트는 같은 페이지 컴포넌트에서 mock mode와 API mode를 모두 지원한다.

### Mock mode

```text
NEXT_PUBLIC_KNOT_DATA_MODE=mock
```

목적:

- 백엔드 없이 UI 확인 가능
- deterministic fixture 기반 데모 fallback 유지

### API mode

```text
NEXT_PUBLIC_KNOT_DATA_MODE=api
KNOT_API_BASE_URL=<Product API URL>
```

목적:

- 같은 화면을 실제 Product API 데이터로 동작시킨다.
- 브라우저 요청은 Next proxy `/api/v1/[...path]`를 통해 백엔드로 전달한다.
- `KNOT_API_BASE_URL`은 서버 환경변수로 유지한다.

현재 로컬/Cloud Run 테스트는 API mode로 확인했다.

현재 기본값은 API mode다. 백엔드 없이 fixture만 확인할 때만
`NEXT_PUBLIC_KNOT_DATA_MODE=mock`을 명시한다.

## 12. Product API 기능 목록

현재 구현된 API:

| 영역 | Endpoint |
|---|---|
| API metadata | `GET /api/v1`, `GET /readyz`, `GET /version` |
| Account | `POST /api/v1/users:bootstrap`, `GET /api/v1/users/{userId}` |
| Brand onboarding | `POST /api/v1/brands:onboard` |
| Creator onboarding | `POST /api/v1/creators:onboard` |
| Creator criteria | `POST /api/v1/creators/{creatorId}/criteria` |
| Promotion | `POST /api/v1/promotions`, `GET /api/v1/promotions`, `GET /api/v1/promotions/{promotionId}`, `POST /api/v1/promotions/{promotionId}:activate` |
| Matching | `POST /api/v1/promotions/{promotionId}/matches:run`, `GET /api/v1/match-runs/{matchRunId}`, `GET /api/v1/match-runs/{matchRunId}/candidates`, `POST /api/v1/match-runs/{matchRunId}/candidates/{creatorAgentId}:select` |
| Negotiation | `POST /api/v1/match-runs/{matchRunId}:start-negotiation`, `GET /api/v1/negotiations/{negotiationId}`, `GET /api/v1/negotiations/{negotiationId}/agreement`, `GET /api/v1/negotiations/{negotiationId}/messages`, `GET /api/v1/negotiations/{negotiationId}/events`, `POST /api/v1/negotiations/{negotiationId}:cancel` |
| Agreement | `GET /api/v1/agreements/{agreementId}`, `GET /api/v1/agreements/{agreementId}/escrow` |
| Evidence | `POST /api/v1/agreements/{agreementId}/evidence`, `GET /api/v1/evidence/{evidenceId}`, `POST /api/v1/evidence/{evidenceId}:verify` |
| Escrow / Settlement state | `POST /api/v1/agreements/{agreementId}/escrow:lock`, `GET /api/v1/escrows/{escrowId}`, `POST /api/v1/escrows/{escrowId}/milestones/{milestoneId}:release`, `GET /api/v1/transaction-receipts/{receiptId}` |
| Timeline | `GET /api/v1/promotions/{promotionId}/timeline` |

## 13. Firestore 데이터 모델

현재 사용하는 Firestore collection:

```text
users/{userId}
brands/{brandId}
creatorProfiles/{creatorId}
agents/{agentId}
agentPolicies/{agentId}
promotions/{promotionId}
promotions/{promotionId}/events/{eventId}
matchRuns/{matchRunId}
matchRuns/{matchRunId}/candidates/{creatorId}
negotiations/{negotiationId}
negotiations/{negotiationId}/messages/{messageId}
negotiations/{negotiationId}/decisions/{decisionId}
a2aTasks/{taskId}
a2aTasks/{taskId}/events/{eventId}
a2aTasks/{taskId}/artifacts/{artifactId}
agreements/{agreementId}
agreements/{agreementId}/milestones/{milestoneId}
evidence/{evidenceId}
escrows/{escrowId}
settlements/{settlementId}
paymentOperations/{operationId}
transactionReceipts/{receiptId}
auditEvents/{eventId}
idempotencyRecords/{key}
```

브라우저는 Firestore에 직접 쓰지 않는다. 모든 비즈니스 write는 Product API
repository boundary를 통해 처리한다.

## 14. 현재 완료된 기능

현재 완료된 MVP baseline:

- 루트 랜딩 페이지 복원
- 로그인/회원가입 화면
- 브랜드/크리에이터 역할 선택
- Brand onboarding API 연동
- Creator onboarding API 연동
- Creator criteria API 연동
- Brand Product/Promotion creation API 연동
- mock/API data mode 분리
- API mode 기본값 전환
- 페이지 진입 시 mock success fallback/write 실행 제거
- Next.js API proxy `/api/v1/[...path]`
- Brand matching/negotiation/result/settlement 화면
- Creator criteria/result/brand-detail/milestone/settlement 화면
- Role별 `My`, `Settings` 페이지
- Dev admin 페이지
- Firestore Native DB setup 및 seed
- Cloud Run 배포 baseline
- Product API onboarding, Promotion, negotiation, evidence, escrow-state 테스트

## 15. 아직 안 된 것

남은 작업:

- Firebase Auth 실제 연동
- 로그인 세션/권한 검증
- 실제 SNS ingestion 및 SNS 분석
- 실제 PDF/제품 문서 업로드 및 분석
- Cloud Run private OIDC/IAM 기반 Creator A2A 호출 설정
- pay.sh/x402 유료 API 호출 receipt 표시
- Product API에서 web3 gateway를 통한 실제 Solana devnet signing
- Terraform 기반 GCP 재현 가능 배포
- Cloud Run runtime service account 최소 권한 설정
- frontend npm dependency audit remediation

## 16. 현재 데모 추천 경로

현재 구현 기준으로 가장 안정적인 데모 경로:

```text
1. / 접속
2. KNOT 문제 정의와 agentic settlement promise 설명
3. /signup에서 Brand 선택
4. Brand onboarding 완료
5. Product/Promotion 생성
6. /brand/negotiate에서 agent-led matching/A2A 진행 표시
7. /brand/result에서 Agreement Artifact 결과 확인
8. /brand/settlement에서 evidence, escrow, release 상태 확인
9. Creator flow로 전환
10. Creator onboarding 완료
11. Creator criteria 설정
12. /creator/result에서 브랜드별 협상 결과 확인
13. /creator/agreements/{agreementId}에서 마일스톤/정산 상태 확인
14. /dev/admin에서 API mode, repository boundary, policy check, simulated web3 상태 확인
```

해커톤 평가 관점에서 아직 가장 큰 proof gap은 다음 두 가지다.

- private web3 gateway에서 실제 on-chain escrow lock/release signature 생성
- Brand Agent matching 흐름 안에서 pay.sh/x402 paid verification call 표시
