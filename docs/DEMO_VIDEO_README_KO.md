# KNOT 데모 영상 촬영 README

**기준 브랜치:** `integration/frontend-backend-api`  
**기준일:** 2026-07-27  
**대상:** KNOT v1 Product MVP 데모 영상

이 문서는 데모 영상을 찍을 때 사용할 데이터, 테스트 계정, 화면 이동
순서, 설명 포인트를 정리한다. 화면에서는 실제 서비스처럼 보여주되,
현재 구현이 `local-demo` 인증과 simulated web3 receipt를 사용하는 부분은
정확히 구분해서 말한다.

## 1. 현재 실제 동작 여부

### 로그인

현재 로그인/회원가입 화면은 실제 Firebase Auth가 아니다.

동작하는 것:

- `/login`, `/signup` 화면이 있다.
- 로그인/회원가입 시 Product API의 `POST /api/v1/users:bootstrap`을 호출한다.
- API는 Firestore의 `users/{userId}` 문서를 생성하거나 갱신한다.
- 브라우저는 `localStorage`에 `knot.localSession`을 저장한다.
- 테스트 계정 `test1`~`test4`는 화면에서 입력 가능하다.
- 테스트 계정 비밀번호 `0000`은 프론트에서만 demo guard로 확인한다.

아직 실제가 아닌 것:

- Firebase Auth 로그인
- password hash 저장/검증
- 서버 세션 검증
- 권한별 API access control

따라서 영상에서는 “로그인/회원가입 UX와 Product API user document
bootstrap은 동작한다. production auth는 다음 단계다”라고 설명한다.

### Agent

Agent 흐름은 실제 서비스 경계를 통해 동작한다.

동작하는 것:

- Brand Agent matching은 Product API에서 실제로 실행된다.
- 후보 ranking은 deterministic policy/scoring으로 계산된다.
- Gemini는 후보 설명과 Creator Agent rationale 생성에 사용될 수 있다.
- Product API가 Creator Agent Cloud Run 서비스로 A2A v1 HTTP 요청을 보낸다.
- Creator Agent는 A2A Task, Message, Artifact 형태로 응답한다.
- Product API는 accepted Artifact가 있을 때만 Agreement를 materialize한다.
- Agreement에는 `termsHash`가 포함된다.

주의할 점:

- LLM/Gemini는 결제 승인자가 아니다.
- 후보 점수, policy pass/fail, escrow lock/release 조건은 deterministic
  check로 결정된다.
- A2A는 화면에서 모든 내부 협상 정보를 보여주지 않는다. 사용자는 진행
  상태와 공개 가능한 결과만 본다.

### 결제 / 정산

현재 Cloud Run 데모는 Product API와 web3 gateway 경계까지 동작한다.

동작하는 것:

- Agreement 이후 `escrow:lock` API가 동작한다.
- 모든 payment mutation은 `Idempotency-Key`가 필요하다.
- Product API가 web3 gateway로 lock/release 요청을 보낸다.
- lock/release receipt가 Firestore에 저장된다.
- evidence 제출 및 deterministic verification이 동작한다.
- milestone release가 동작한다.

아직 실제가 아닌 것:

- Cloud Run `knot-web3`는 현재 `KNOT_WEB3_SIGNING_MODE=simulated`다.
- 따라서 Cloud Run 데모 receipt는 `SIMULATED`이고 devnet signature는 없다.
- 실제 Solana devnet signature를 보이려면 Secret Manager signer를 연결하고
  `KNOT_WEB3_SIGNING_MODE=devnet`으로 재배포해야 한다.

pay.sh도 Product API event로 연결되어 있지만 현재 배포값은
`PAYSH_RESOURCE_ID=replace-me`라 fresh paid receipt 대신 `SKIPPED` 상태가
기록된다.

## 2. 접속 URL

Cloud Run:

```text
Frontend: https://knot-web-7k3walthgq-uc.a.run.app
API:      https://knot-api-7k3walthgq-uc.a.run.app
Agent:    https://knot-creator-agent-7k3walthgq-uc.a.run.app
Web3:     https://knot-web3-7k3walthgq-uc.a.run.app
```

로컬:

```text
Frontend: http://localhost:3000
API:      http://127.0.0.1:18080
Agent:    http://127.0.0.1:18081
Web3:     http://127.0.0.1:18083
```

## 3. 테스트 계정

화면 로그인용 계정이다. 비밀번호는 모두 `0000`이다.

| 역할 | 아이디 | 비밀번호 | 내부 email | 설명 |
|---|---|---:|---|---|
| Brand | `test1` | `0000` | `test1@knot.demo` | 기본 브랜드 데모 진행용 |
| Brand | `test2` | `0000` | `test2@knot.demo` | 두 번째 브랜드 계정/반복 테스트용 |
| Creator | `test3` | `0000` | `test3@knot.demo` | Creator criteria/result 확인용 |
| Creator | `test4` | `0000` | `test4@knot.demo` | 다른 creator profile 관점 확인용 |

seed fixture:

```text
backend/fixtures/users.json
```

주의:

- `0000`은 production password가 아니다.
- API에는 password를 보내거나 저장하지 않는다.
- demo account login id는 frontend에서 `@knot.demo` email로 변환된다.

## 4. 기본 seed 데이터

### Brand

```text
brand-001
brand-agent-001
Demo Skincare Brand
```

### Creator candidates

```text
creator-001 / creator-agent-001 / Demo Beauty Creator
creator-002 / creator-agent-002 / Demo Fitness Creator
creator-003 / creator-agent-003 / Demo Lifestyle Creator
```

기본 Promotion:

```text
promotion-001
title: Summer skincare launch
category: beauty
budget: total 2000 USDC, max per creator 800 USDC
deliverable: reel 1개
usageRights: paidBoost30d
```

예상 matching:

```text
1위: creator-agent-003
2위: creator-agent-001
제외: creator-agent-002, CATEGORY_MISMATCH
```

## 5. 영상 촬영 추천 플로우

### 0. 사전 확인

브라우저에서 다음을 먼저 확인한다.

```text
/login
/signup
/brand/products/new
/brand/negotiate
/brand/result
/brand/settlement
/creator/result
/dev/admin
```

API 확인:

```text
GET /readyz
GET /api/v1/promotions
```

말할 포인트:

- 네 개 Cloud Run 서비스가 떠 있다.
- Firestore가 business state source of truth다.
- Browser는 Firestore에 직접 쓰지 않고 Product API만 호출한다.

## 6. Public / Entry 플로우

### 화면

```text
/
```

보여줄 내용:

- “지금까지의 협업은 이랬어요”
- “브랜드는 DM을 50개 보내고, 답장은 3개 받아요.”
- “크리에이터는 제안을 놓치고, 단가는 눈치게임”
- “정산은 엑셀과 계좌이체로 끝나죠.”
- “크리에이터랑 브랜드, 에이전트끼리 만나서 매듭 짓는 곳”
- “당신이 자는 동안, 당신의 에이전트가 딜을 협상하고, 계약하고, 정산합니다.”

CTA:

```text
로그인
회원가입
Dev admin
```

말할 포인트:

- KNOT은 marketplace listing이 아니라, 한 협업 거래를 agent가 끝까지
  처리하는 product다.
- 사람은 한도와 기준을 정하고, agent가 반복 작업을 처리한다.

## 7. Brand 플로우

### 7.1 Brand 로그인

화면:

```text
/login
```

입력:

```text
ID or Email: test1
Password: 0000
Workspace role: Brand
```

결과:

```text
/brand/onboarding
```

말할 포인트:

- 현재는 local-demo account bootstrap이다.
- 이 단계에서 user document가 준비된다.

### 7.2 Brand 온보딩

화면:

```text
/brand/onboarding
```

입력 예시:

```text
Brand name: Glow Bar Labs
Website URL: https://glowbar.example
Category: beauty
Target audience: 20s, skincare
Restricted claims: medical cure, guaranteed result
```

CTA:

```text
Analyze Brand
```

결과:

- Brand profile summary 표시
- Brand Agent 생성/연결
- wallet reference 표시

말할 포인트:

- PDF/웹사이트 실제 분석은 아직 live ingestion이 아니다.
- 입력값으로 Brand profile과 Agent context를 구성한다.

### 7.3 제품 / Promotion 생성

화면:

```text
/brand/products/new
```

입력 예시:

```text
Promotion title: Summer skincare launch
Product: Hydrating serum
Objective: awareness
Category: beauty
Target audience: 20s, skincare
Budget total: 2000
Max per creator: 800
Deliverable: reel
Count: 1
Start date: 2026-08-05
Deadline: 2026-08-10
Usage rights: paidBoost30d
Required disclosures: ad
Prohibited claims: medical cure, guaranteed result
```

결과:

```text
/brand/negotiate?promotionId=<새 promotionId>
```

말할 포인트:

- Brand가 직접 DM을 보내지 않는다.
- Brand는 제안서와 budget/autonomy boundary를 만든다.

### 7.4 Brand Agent 매칭 및 A2A 협상

화면:

```text
/brand/negotiate
```

보여줄 흐름:

1. Brand Agent가 Promotion 분석
2. pay.sh/x402 creator verification event 기록
3. deterministic matching으로 creator candidates ranking
4. top eligible Creator Agent 선택
5. Product API가 Creator Agent Cloud Run으로 A2A `message:send`
6. Creator Agent가 policy를 보고 ACCEPT/COUNTER/REJECT 판단
7. accepted Artifact가 Agreement로 materialize

화면에서 보여줄 것:

- 진행 중 agent animation/loading
- 후보 ranking
- 공개 가능한 decision summary
- 공개 가능한 final terms
- `termsHash`

화면에서 보여주면 안 되는 것:

- Creator private minimum rate 전체
- blocked domain private policy 전체
- 상대방 내부 policy snapshot의 민감한 raw 값
- wallet private key, seed phrase, service account key

말할 포인트:

- 사람끼리 채팅하는 화면이 아니라 agent가 A2A task를 처리하는 화면이다.
- 사용자는 진행 상황과 결과만 본다.
- Agreement는 A2A Artifact에서 나온 구조화 결과다.

### 7.5 Brand 협상 결과

화면:

```text
/brand/result?promotionId=<promotionId>&negotiationId=<negotiationId>&agreementId=<agreementId>
```

보여줄 내용:

- 협상 결과: AGREED / REJECTED / ESCALATED
- Creator Agent
- base amount
- deliverables
- usage rights
- milestone split
- `termsHash`

CTA:

```text
정산 페이지로 이동
```

말할 포인트:

- 자연어 계약서가 아니라 deterministic hash가 있는 structured Agreement다.
- Payment authorization은 LLM output이 아니라 policy + gateway가 판단한다.

### 7.6 Brand 정산

화면:

```text
/brand/settlement?agreementId=<agreementId>
```

보여줄 흐름:

1. Agreement 확인
2. escrow lock
3. evidence URL 제출
4. deterministic evidence verification
5. content milestone release

현재 Cloud Run 상태:

```text
KNOT_WEB3_MODE=gateway
KNOT_WEB3_SIGNING_MODE=simulated
```

따라서:

- Product API → web3 gateway 호출은 동작한다.
- receipt는 Firestore에 저장된다.
- receipt status는 `SIMULATED`다.
- devnet explorer link/signature는 실제 signer 연결 후 표시된다.

말할 포인트:

- Agent API Spend와 Deal Escrow는 다른 돈이다.
- pay.sh/x402는 agent가 외부 API 호출에 쓰는 비용이다.
- Deal Escrow는 브랜드가 크리에이터 보수를 잠그고 release하는 흐름이다.

## 8. Creator 플로우

### 8.1 Creator 로그인

화면:

```text
/login
```

입력:

```text
ID or Email: test3
Password: 0000
Workspace role: Creator
```

결과:

```text
/creator/onboarding
```

### 8.2 Creator 온보딩

화면:

```text
/creator/onboarding
```

입력 예시:

```text
Creator name: Mina Studio
SNS URL: https://instagram.com/mina.studio
Primary category: beauty
```

CTA:

```text
Analyze Creator
```

결과:

- public creator summary
- Creator Agent 생성/연결
- wallet reference 표시

말할 포인트:

- 실제 SNS scraping/analysis는 아직 live가 아니다.
- SNS URL과 입력값으로 demo profile을 구성한다.

### 8.3 협상 기준 설정

화면:

```text
/creator/criteria
```

입력 예시:

```text
Minimum price: 650
Blocked domains: gambling, cryptoTrading, tobacco, adult
Preferred content: reel, skincare, wellness, tutorial
Usage rights: paidBoost30d
Notes: 의료 효능 보장 표현은 거절
```

말할 포인트:

- 이 기준은 Creator Agent가 offer를 자동 판단할 때 사용한다.
- Brand 화면에는 Creator의 private criteria 전체가 노출되지 않는다.

### 8.4 Creator 협상 결과 목록

화면:

```text
/creator/result
```

보여줄 내용:

- 어떤 브랜드와 협상이 있었는지
- 각 협상 상태
- agreed/rejected/needs review
- 공개 가능한 보수와 milestone 상태

말할 포인트:

- Creator는 DM inbox를 뒤지는 대신 agent가 처리한 결과를 본다.
- 미합의 건은 민감한 내부 기준 없이 outcome만 보여준다.

### 8.5 Creator 브랜드 상세 / 마일스톤

화면:

```text
/creator/agreements/{agreementId}
```

보여줄 내용:

- Agreement summary
- 수행해야 할 content milestone
- evidence 제출 상태
- verification 상태
- settlement status

Creator action:

```text
Submit Evidence
Request Verification
View Settlement Transaction
```

말할 포인트:

- Creator 입장에서는 “무슨 작업을 해야 하는지”와 “정산이 어디까지
  진행됐는지”가 핵심이다.

## 9. Dev Admin 플로우

화면:

```text
/dev/admin
```

보여줄 내용:

- Product API mode
- repository boundary
- A2A status
- pay.sh/x402 event status
- web3 receipt status
- 최근 Promotion/Negotiation 상태

말할 포인트:

- 심사자가 보는 핵심은 목업 페이지가 아니라 service boundary와 trace다.
- Browser → Next proxy → Product API → Creator Agent / web3 gateway 흐름을
  설명한다.

## 10. 데모 영상 내레이션 순서

### 0:00-0:20 문제 제기

```text
브랜드는 DM을 50개 보내고 답장은 3개 받습니다.
크리에이터는 제안을 놓치고 단가는 눈치게임이 됩니다.
KNOT은 이 협업을 각자의 agent가 협상하고, 계약하고, 정산하는 흐름으로 바꿉니다.
```

### 0:20-0:45 Brand가 Promotion 생성

```text
브랜드는 제품과 예산, 사용 권리, 금지 claim, 마감일만 설정합니다.
이 정보가 Brand Agent의 협상 boundary가 됩니다.
```

### 0:45-1:25 Agent matching + A2A negotiation

```text
Brand Agent가 후보 creator를 ranking하고, 선택된 Creator Agent에게
official A2A HTTP message를 보냅니다.
Creator Agent는 자신의 private criteria와 policy를 확인하고 결과를 돌려줍니다.
```

### 1:25-1:50 Agreement

```text
합의된 조건은 structured Agreement로 저장되고, canonical JSON에서 termsHash가 만들어집니다.
이 hash가 이후 escrow lock/release의 기준이 됩니다.
```

### 1:50-2:30 Evidence + settlement

```text
Creator가 evidence URL을 제출하면 verification policy가 deterministic하게 pass/fail을 판단합니다.
pass된 milestone만 release됩니다.
현재 Cloud Run은 gateway boundary까지 동작하고 receipt는 simulated입니다.
devnet signer를 연결하면 같은 흐름에서 explorer signature가 표시됩니다.
```

### 2:30-3:00 Architecture proof

```text
Frontend와 API, Creator Agent, web3 gateway는 Cloud Run 서비스로 분리되어 있습니다.
상태는 Firestore에 남고, Gemini는 explanation/rationale만 담당하며 결제를 승인하지 않습니다.
```

## 11. 화면 테스트 체크리스트

Brand 계정:

- `test1 / 0000` 로그인
- `/brand/onboarding` 저장
- `/brand/products/new`에서 Promotion 생성
- `/brand/negotiate`에서 matching 실행
- A2A negotiation 결과가 Agreement로 생성되는지 확인
- `/brand/result`에서 termsHash 확인
- `/brand/settlement`에서 lock/evidence/release 확인

Brand 반복 계정:

- `test2 / 0000` 로그인
- 같은 Promotion 생성 흐름 반복
- category를 `fitness`로 바꿔 matching 결과가 달라지는지 확인

Creator 계정:

- `test3 / 0000` 로그인
- `/creator/onboarding` 저장
- `/creator/criteria`에서 blocked domains와 minimum price 저장
- `/creator/result`에서 협상 결과 목록 확인
- `/creator/agreements/{agreementId}`에서 milestone 확인

Creator 반복 계정:

- `test4 / 0000` 로그인
- criteria를 다르게 저장
- Brand가 만든 beauty Promotion 결과를 Creator 관점으로 확인

Dev/Admin:

- `/dev/admin`에서 API mode와 현재 데이터 상태 확인
- API health 확인
- receipt가 `SIMULATED`인지 명확히 확인

## 12. 실패/예외 시 보여줄 포인트

### No eligible creator

Promotion category나 budget을 일부러 맞지 않게 설정하면 matching은
실패할 수 있다.

설명:

```text
Agent가 무조건 거래를 성사시키지 않습니다.
정책이나 조건에 맞는 creator가 없으면 NO_ELIGIBLE_CREATOR로 막습니다.
```

### Evidence failed

Evidence URL에 다음 단어를 넣으면 demo verification이 실패한다.

```text
unreachable
missing-brand
missing-disclosure
```

설명:

```text
LLM이 정산을 승인하는 것이 아니라 deterministic evidence policy가 pass/fail을 결정합니다.
```

### pay.sh skipped

현재 배포값:

```text
PAYSH_RESOURCE_ID=replace-me
```

설명:

```text
pay.sh/x402 호출 지점은 Promotion timeline에 남지만, 실제 priced resource가 없으면 SKIPPED로 기록합니다.
데모 전 실제 sandbox resource를 넣으면 fresh receipt를 보여줄 수 있습니다.
```

## 13. 데모 전 해야 할 설정

실제 온체인 서명까지 보여주려면:

1. Secret Manager에 devnet brand/creator/agent signer를 저장한다.
2. signer wallet에 devnet SOL과 USDC-SPL을 준비한다.
3. `knot-web3`를 `KNOT_WEB3_SIGNING_MODE=devnet`으로 재배포한다.
4. lock/release smoke를 실행한다.
5. Explorer URL을 화면에서 확인한다.

실제 pay.sh receipt까지 보여주려면:

1. sandbox priced resource를 준비한다.
2. `PAYSH_RESOURCE_ID`를 실제 값으로 설정한다.
3. `knot-api`를 재배포한다.
4. Promotion matching을 실행해 `API_PAYMENT` event가 `SETTLED`인지 확인한다.

## 14. 절대 하지 말 것

- private key, seed phrase, service account JSON을 화면이나 문서에 노출하지 않는다.
- Gemini가 결제를 승인한다고 말하지 않는다.
- simulated receipt를 devnet transaction이라고 말하지 않는다.
- Firebase Auth가 이미 완성됐다고 말하지 않는다.
- Firestore를 수동 수정해서 데모를 이어가지 않는다.

## 15. 빠른 smoke 명령

```text
curl -sS https://knot-api-7k3walthgq-uc.a.run.app/readyz
curl -sS https://knot-creator-agent-7k3walthgq-uc.a.run.app/readyz
curl -sS https://knot-web3-7k3walthgq-uc.a.run.app/readyz
curl -sS -o /dev/null -w '%{http_code}\n' https://knot-web-7k3walthgq-uc.a.run.app/login
```

Firestore seed:

```text
GOOGLE_CLOUD_PROJECT=knot-dev-503505 GCP_PROJECT_ID=knot-dev-503505 \
  python scripts/seed_demo.py --target firestore --project knot-dev-503505
```
