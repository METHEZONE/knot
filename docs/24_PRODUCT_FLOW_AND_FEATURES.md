# KNOT Product Flow and Feature Summary

**Status date:** 2026-07-26  
**Scope:** Current KNOT v1 product MVP baseline  
**Branch context:** `integration/frontend-backend-api`

This document summarizes the product flow and implemented capabilities that are
currently available in the repository. It reflects the latest product reset:
KNOT is focused on a simple Brand/Creator workflow where agents handle matching,
negotiation, agreement creation, evidence verification, and settlement-state
presentation. The Society Map is out of MVP scope.

## 1. Product Position

KNOT is a Brand x Creator agentic Promotion platform.

The user-facing promise is:

> 크리에이터랑 브랜드, 에이전트끼리 만나서 매듭 짓는 곳

The root landing explains the existing workflow problem:

- Brands send many DMs and receive few replies.
- Creators miss proposals and negotiate rates manually.
- Settlement often ends in spreadsheets and bank transfers.

KNOT replaces that fragmented workflow with role-specific agents that can
match, negotiate, produce a structured agreement, and drive settlement state
within deterministic policy limits.

## 2. Current Deployment Baseline

The current off-chain runtime is configured for Google Cloud.

| Service | Current state |
|---|---|
| Frontend | Next.js + TypeScript app deployed to Cloud Run |
| Product API | FastAPI service deployed to Cloud Run |
| Database | Firestore Native database created and seeded in `knot-dev-503505` |
| Web3 payment | Excluded from this frontend/backend completion pass; Product API receipts remain `SIMULATED` |
| Authentication | Local-demo account bootstrap through Product API; Firebase Auth is not production-wired yet |

Current Cloud Run URLs:

```text
Frontend: https://knot-web-260001601654.us-central1.run.app
Backend:  https://knot-api-260001601654.us-central1.run.app
```

The backend readiness endpoint is:

```text
GET /readyz
```

`healthz` and `readyz` are operational health-check names. The trailing `z` is
a common convention to avoid colliding with business routes named `health` or
`ready`.

## 3. Navigation Model

The frontend no longer presents the app as a single numbered stepper.

After onboarding, a Brand can create many Promotions and a Creator can receive
many agent-negotiated offers. For that reason:

- The global header only carries broad navigation.
- Page-specific titles live at the top of each page.
- `My` and `Settings` are account actions, not steps in the transaction flow.
- Role workspaces are separate pages, not an internal sidebar funnel.

Core routes:

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
/creator/brands/glow-bar
/creator/me
/creator/settings

/dev/admin
```

Compatibility redirects:

```text
/brand/matching -> /brand/negotiate
/creator/negotiate -> /creator/result
/creator/offers -> /creator/result
/creator/milestones -> /creator/brands/glow-bar
```

## 4. Public Entry Flow

### `/`

Purpose: public service introduction and demo entry.

Current content includes the long-form landing copy:

- "브랜드는 DM을 50개 보내고, 답장은 3개 받아요."
- "크리에이터는 제안을 놓치고, 단가는 눈치게임,"
- "정산은 엑셀과 계좌이체로 끝나죠."
- "당신이 자는 동안, 당신의 에이전트가 딜을 협상하고, 계약하고, 정산합니다."

Primary actions:

- Try Brand flow
- Try Creator flow
- Login / Signup

## 5. Account Flow

### `/login`

Purpose: enter the product as Brand or Creator.

Implemented behavior:

- User enters email, display name, and role.
- Frontend calls `POST /api/v1/users:bootstrap` through the Next proxy.
- The Product API creates or updates `users/{userId}`.
- The frontend stores a local role session in browser storage and routes the
  user to the selected role onboarding page.

Current limitation:

- This is `local-demo` auth state. Firebase Auth/session enforcement is still
  pending.
- Passwords, tokens, private keys, seed phrases, and payment authority are not
  stored.

### `/signup`

Purpose: choose account type before profile creation.

Flow:

```text
/signup
  -> /signup/brand
  -> /brand/onboarding

/signup
  -> /signup/creator
  -> /creator/onboarding
```

Signup creates the account context first, then onboarding creates the Brand or
Creator profile and agent references.

## 6. Brand Flow

The Brand flow is:

```text
Login / Signup
  -> Brand onboarding
  -> Product / Promotion creation
  -> Agent matching and A2A negotiation
  -> Negotiation result
  -> Settlement page
```

### 6.1 Brand onboarding

Route:

```text
/brand/onboarding
```

Purpose: create the Brand profile and Brand Agent context.

Current inputs:

- Brand website URL
- Brand name
- Category
- Target audience
- Restricted claims

Implemented API behavior:

```text
POST /api/v1/brands:onboard
```

The backend writes:

- `brands/{brandId}`
- `agents/{brandAgentId}`
- role references back to `users/{userId}` when available

The UI presents a generated Brand summary after submission.

### 6.2 Product / Promotion creation

Route:

```text
/brand/products/new
```

Purpose: define the product and public Promotion terms that the Brand Agent can
use.

Current inputs:

- Product document hint, currently a placeholder for future PDF/file upload
- Promotion title
- Category
- Target audience
- Budget
- Maximum offer per creator
- Deliverables
- Excluded conditions / prohibited claims

Implemented API behavior:

```text
POST /api/v1/promotions
```

The backend persists a `promotions/{promotionId}` document. Newly created
Promotions are sorted newest-first by `GET /api/v1/promotions`, so API mode can
pick up the latest Promotion.

Private Brand policy details such as hard caps and internal approval thresholds
are not exposed to Creator views.

### 6.3 Creator matching and negotiation

Route:

```text
/brand/negotiate
```

Purpose: show the Brand Agent doing the work instead of making the human run
each step manually.

API-mode flow:

```text
GET  /api/v1/promotions
POST /api/v1/promotions/{promotionId}/matches:run
GET  /api/v1/match-runs/{matchRunId}/candidates
POST /api/v1/match-runs/{matchRunId}:start-negotiation
GET  /api/v1/promotions/{promotionId}/timeline
```

What the Brand sees:

- Matching is in progress.
- Candidate ranking has completed.
- A2A offer/counter/accept work is in progress.
- Agreement Artifact is created when negotiation succeeds.
- Sanitized progress and final public terms.

What the Brand does not see:

- Creator private minimum amount.
- Creator blocked domains.
- Creator private pricing preferences.
- Full raw A2A payloads unless surfaced through dev tools.

### 6.4 Brand result

Route:

```text
/brand/result
```

Purpose: show the negotiation result after agents finish.

Displayed result:

- Counterparty Creator
- Public negotiated terms
- Deliverables
- Deadline
- Usage rights
- `termsHash`
- A2A Task completion status

The page frames the result as an Agreement Artifact produced by agent
negotiation, not as a manual chat transcript.

### 6.5 Brand settlement

Route:

```text
/brand/settlement
```

Purpose: show compensation settlement state for the agreed Promotion.

API-mode flow:

```text
POST /api/v1/agreements/{agreementId}/evidence
POST /api/v1/evidence/{evidenceId}:verify
POST /api/v1/agreements/{agreementId}/escrow:lock
POST /api/v1/escrows/{escrowId}/milestones/{milestoneId}:release
GET  /api/v1/promotions/{promotionId}/timeline
```

Displayed state:

- Escrow amount
- Released amount
- Pending amount
- Milestone list
- Evidence verification status
- Receipt state

Important separation:

- `Agent API Spend` is the agent's external API/x402 cost.
- `Deal Escrow` is the Creator compensation locked and released for a
  Promotion.

The current settlement UI uses Product API receipts, but receipts are still
`SIMULATED` until real web3 signing is wired into the API/gateway path.

## 7. Creator Flow

The Creator flow is:

```text
Login / Signup
  -> Creator onboarding
  -> Negotiation criteria
  -> Agent-negotiated offer results
  -> Brand deal detail
  -> Milestones and settlement status
```

### 7.1 Creator onboarding

Route:

```text
/creator/onboarding
```

Purpose: create the Creator profile and Creator Agent context from a public SNS
URL.

Current inputs:

- Creator name
- Instagram / TikTok / YouTube URL
- Primary category

Implemented API behavior:

```text
POST /api/v1/creators:onboard
```

The backend writes:

- `creatorProfiles/{creatorId}`
- `agents/{creatorAgentId}`
- initial `agentPolicies/{creatorAgentId}`
- role references back to `users/{userId}` when available

The UI presents a generated Creator summary after submission.

### 7.2 Negotiation criteria

Route:

```text
/creator/criteria
```

Purpose: define private criteria used by the Creator Agent.

Current inputs:

- Minimum amount in USDC
- Blocked domains
- Preferred content types
- Usage rights preference
- Notes

Example blocked domains:

- 담배
- 도박
- 고위험 금융
- 의료 효능 과장
- 정치 광고

Example preferred content:

- Instagram Reels
- 제품 리뷰
- 스토리 링크
- UGC 컷다운

Implemented API behavior:

```text
POST /api/v1/creators/{creatorId}/criteria
```

The backend updates the Creator Agent policy. These fields are private to the
Creator side. Brand screens only see sanitized outcomes such as accepted,
countered, rejected, or review-needed.

### 7.3 Creator result

Route:

```text
/creator/result
```

Purpose: show all Brand proposals that the Creator Agent has processed.

Displayed state:

- Brand name
- Product title
- Negotiation status
- Public result summary
- Amount if agreed
- `termsHash` if agreed

The page intentionally does not expose:

- Brand hard maximum price.
- Brand internal candidate score.
- Full A2A messages.
- Internal policy snapshots.

### 7.4 Creator brand detail

Route:

```text
/creator/brands/glow-bar
```

Purpose: show one agreed Brand deal in detail.

Displayed state for an agreed deal:

- Agreement terms
- Milestones
- Creator actions per milestone
- Milestone progress
- Escrow status
- Released and pending amounts

For non-agreed deals, the Creator only sees sanitized outcome text and no
milestone/settlement workflow.

## 8. Agent and A2A UX

The user experience is designed to make agent autonomy visible without leaking
private negotiation data.

Current UX rules:

- The human does not manually send every offer/counter.
- The UI shows animated "진행중이에요!" agent work states.
- The UI displays sanitized task progress rather than full raw reasoning.
- Final results show public terms and `termsHash`.
- Private limits, blocked domains, hard caps, scoring details, and policy
  internals stay hidden from the counterparty.

Current technical boundary:

- Browser code does not construct official A2A `Message`, `Task`, or
  `Artifact` payloads.
- Frontend consumes Product API projections.
- Backend persists Negotiation messages/events, A2A Task, A2A Artifact, and
  Agreement documents.
- External service-to-service A2A orchestration remains a later integration
  step, but persisted shapes are kept aligned with `docs/09_A2A_PROTOCOL_v1.md`.

## 9. Developer Admin

Route:

```text
/dev/admin
```

Purpose: inspect whether the product is running in mock mode or API mode and
show integration status.

Displayed checks:

- Auth/session projection
- Product API repository boundary
- A2A projection boundary
- Deterministic policy checks
- Escrow receipt state

In API mode, the page checks Product API readiness through `/readyz`.

## 10. Frontend Data Modes

The frontend supports two data modes behind the same page components.

### Mock mode

Default mode:

```text
NEXT_PUBLIC_KNOT_DATA_MODE=mock
```

Purpose:

- Keep the UI runnable without backend services.
- Preserve deterministic fixture data for design and demo fallback.

### API mode

API mode:

```text
NEXT_PUBLIC_KNOT_DATA_MODE=api
KNOT_API_BASE_URL=<Product API URL>
```

Purpose:

- Use the same screens with Product API-backed data.
- Route browser calls through Next.js `/api/v1/[...path]`.
- Keep `KNOT_API_BASE_URL` server-side.

The current Cloud Run frontend is configured to use API mode against the
deployed Product API.

## 11. Product API Feature Coverage

Implemented Product API groups:

| Area | Endpoints |
|---|---|
| API metadata | `GET /api/v1`, `GET /readyz`, `GET /version` |
| Account | `POST /api/v1/users:bootstrap`, `GET /api/v1/users/{userId}` |
| Brand onboarding | `POST /api/v1/brands:onboard` |
| Creator onboarding | `POST /api/v1/creators:onboard` |
| Creator criteria | `POST /api/v1/creators/{creatorId}/criteria` |
| Promotion | `POST /api/v1/promotions`, `GET /api/v1/promotions`, `GET /api/v1/promotions/{promotionId}`, `POST /api/v1/promotions/{promotionId}:activate` |
| Matching | `POST /api/v1/promotions/{promotionId}/matches:run`, `GET /api/v1/match-runs/{matchRunId}`, `GET /api/v1/match-runs/{matchRunId}/candidates`, `POST /api/v1/match-runs/{matchRunId}/candidates/{creatorAgentId}:select` |
| Negotiation | `POST /api/v1/match-runs/{matchRunId}:start-negotiation`, `GET /api/v1/negotiations/{negotiationId}`, `GET /api/v1/negotiations/{negotiationId}/messages`, `GET /api/v1/negotiations/{negotiationId}/events`, `POST /api/v1/negotiations/{negotiationId}:cancel` |
| Agreement | `GET /api/v1/agreements/{agreementId}` |
| Evidence | `POST /api/v1/agreements/{agreementId}/evidence`, `GET /api/v1/evidence/{evidenceId}`, `POST /api/v1/evidence/{evidenceId}:verify` |
| Escrow and settlement state | `POST /api/v1/agreements/{agreementId}/escrow:lock`, `GET /api/v1/escrows/{escrowId}`, `POST /api/v1/escrows/{escrowId}/milestones/{milestoneId}:release`, `GET /api/v1/transaction-receipts/{receiptId}` |
| Timeline | `GET /api/v1/promotions/{promotionId}/timeline` |

## 12. Firestore Data Model Coverage

Current collections:

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

The browser does not write Firestore directly. All business writes go through
the Product API repository boundary, which can run against memory, emulator, or
real Firestore depending on environment settings.

## 13. Security and Privacy Decisions

Implemented guardrails:

- No private key, seed phrase, service-account JSON, API token, or secret is
  stored in source, fixtures, docs, or frontend public env vars.
- Local-demo auth stores account context only, not credentials.
- Creator private criteria are not shown to Brands.
- Brand hard caps and internal scoring details are not shown to Creators.
- LLM output is not used to authorize payments.
- Escrow lock/release endpoints require deterministic policy checks and
  idempotency keys.
- Simulated receipts are labeled by their state; the UI must not fabricate real
  explorer links.

## 14. What Is Completed Now

Completed for the current MVP baseline:

- Public root landing restored with the original long-form positioning copy.
- Product-like login and signup surfaces.
- Role selection before onboarding.
- Brand onboarding to Product API.
- Creator onboarding to Product API.
- Creator private negotiation criteria to Product API.
- Brand Product/Promotion creation to Product API.
- Mock and API data modes behind one frontend data-source interface.
- Next.js Product API proxy at `/api/v1/[...path]`.
- Brand matching/negotiation/result/settlement screens.
- Creator criteria/result/brand-detail/milestone/settlement screens.
- Role `My` and `Settings` pages.
- Dev admin integration status page.
- Firestore Native setup and seeded demo data in `knot-dev-503505`.
- Cloud Run deployment assets and direct demo deployment for frontend/backend.
- Backend tests for onboarding/account, Promotion, negotiation, evidence, and
  escrow-state APIs.

## 15. Not Completed / Remaining Risks

Still pending:

- Firebase Auth and production session enforcement.
- Real PDF/file upload and real document analysis for Brand onboarding.
- Live SNS ingestion and real platform profile analysis for Creator onboarding.
- Service-to-service external A2A HTTP orchestration in the live negotiation
  path.
- pay.sh/x402 paid API verification beat in the Brand Agent matching flow.
- Real web3 gateway signing from Product API; settlement receipts currently
  remain `SIMULATED`.
- Terraform/IaC for repeatable GCP provisioning.
- Dedicated least-privilege Cloud Run runtime service accounts.
- npm dependency audit remediation for frontend high-severity findings observed
  during Cloud Build.

## 16. Demo Script

Recommended current demo path:

```text
1. Open /
2. Show the KNOT problem statement and agentic settlement promise.
3. Go to /signup and choose Brand.
4. Complete Brand onboarding.
5. Create a Product/Promotion.
6. Open /brand/negotiate and show agent-led matching/A2A progress.
7. Open /brand/result and show the public Agreement Artifact result.
8. Open /brand/settlement and show evidence, escrow and release state.
9. Switch to Creator flow.
10. Complete Creator onboarding and negotiation criteria.
11. Open /creator/result and show all agent-negotiated Brand outcomes.
12. Open /creator/brands/glow-bar and show agreed milestones and settlement.
13. Open /dev/admin to show API mode, repository boundary, policy checks and
    simulated web3 receipt status.
```

For judging, the strongest remaining proof gap is real on-chain signing from
the Product API/gateway path and the pay.sh/x402 paid verification call.
