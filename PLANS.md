# KNOT Execution Plans

Use an execution plan for work that touches multiple services, changes architecture or schemas, or is expected to take more than one focused session.

## Plan template

### Goal

State the user-visible result in one paragraph.

### Scope

List the exact files/services that may change and what is explicitly excluded.

### Current state

Record the relevant implementation and known gaps. Do not assume a feature exists without inspecting code.

### Milestones

- [ ] M1 — smallest independently verifiable outcome
- [ ] M2 — integration outcome
- [ ] M3 — tests and documentation

### Contracts

Record API, Firestore, A2A, event, or on-chain schema changes before coding.

### Validation

Provide exact commands and expected observable results.

### Decisions and surprises

Append decisions, failed approaches, and reasons while working.

### Completion record

Summarize changed files, test results, deployment state, and remaining follow-ups.

---

## Active v1 milestone plan

- [x] Repository bootstrap
- [x] GCP project configuration
- [x] Firestore-independent domain model and backend fixtures
- [x] Firestore repository path, serialization, idempotency and demo seed baseline
- [x] Deterministic policy engine and matching pipeline
- [x] Brand Agent and Creator Agent A2A negotiation baseline
- [x] Product API baseline for Promotion, match run, negotiation and Agreement reads
- [x] Agreement hashing and escrow lock validation skeleton
- [x] Evidence submission and deterministic verification API baseline
- [x] Firestore emulator smoke and gated integration tests
- [x] Escrow lock/release API (fee 0, termsHash re-check, evidence-gated, idempotent; receipts SIMULATED)
- [x] Anchor program deployed to devnet (`Aj63…`) and on-chain milestone settlement verified
- [ ] Wire escrow API SIMULATED receipts to real on-chain signing
- [ ] pay.sh flow-1 (agent-paid verification) wired into Brand Agent flow
- [ ] Frontend Agent Workflow and Promotion Timeline
- [ ] Cloud Run deployment, logging, and end-to-end demo

---

## Frontend GCP Migration Plan

### Goal

Rebuild `frontend/` as a Cloud Run-targeted Next.js App Router application
using the current hand-drawn KNOT visual style and the
`docs/KNOT_MVP_v1_1_Document_Pack` MVP route/data contracts. The app must run
against deterministic mock state first while keeping the API boundary
replaceable by `NEXT_PUBLIC_KNOT_DATA_MODE=api`.

### Scope

May change `frontend/`, frontend-related docs, `PLANS.md`, and
`docs/20_IMPLEMENTATION_STATUS.md`. GCP deployment target is Cloud Run; other
preview hosts are ignored for this migration. Backend, Firestore, A2A, and web3
contracts are consumed as documented but not reworked in this frontend
migration.

### Current state

`frontend/` already contains a Next 16 + TypeScript + Tailwind app with the
paper/ink KNOT style, demo fixtures, and several route prototypes. It does not
yet expose the MVP pack route map, shared onboarding shell, deterministic
lifecycle controls for every P0 flow, or Cloud Run deployment documentation.

### Milestones

- [x] M1 — contracts, mock repository, status mappers, shell primitives
- [x] M2 — onboarding, dashboard, Promotion, candidate, workflow, negotiation,
      agreement, payment and evidence routes
- [x] M3 — settings/supporting pages, Cloud Run docs, tests and production build

### Contracts

- Use `Promotion`/`promotionId` in all user-visible code and frontend routes.
- Preserve MVP pack frontend contract field names.
- Page components call a `KnotApi` boundary selected by
  `NEXT_PUBLIC_KNOT_DATA_MODE=mock|api`.
- Mock mode must be deterministic and label fixture transaction signatures as
  demo data unless an API response provides a real signature.

### Validation

Run from `frontend/`:

```text
npm run typecheck
npm run lint
npm test
npm run build
```

### Decisions and surprises

- 2026-07-25: Work starts on branch `frontend/gcp-migration`.
- 2026-07-25: Next 16 local docs confirm dynamic route `params` are promises;
  dynamic pages must use `async`/`await` or React `use`.
- 2026-07-25: MVP pack references older docs under the pack. Repository
  canonical docs `01/02/03/07/23` remain higher-level constraints; the MVP pack
  supplies frontend page/data implementation details.
- 2026-07-25: Implemented MVP route shell, deterministic mock snapshot,
  lifecycle state controls, Cloud Run standalone config and frontend unit tests.
- 2026-07-25: Restored the long-form waitlist landing as the root `/` page and
  kept Brand/Creator demo onboarding as secondary entry points.
- 2026-07-25: Removed the Society Map from the MVP frontend scope. The
  Promotion center now links to an Agent Workflow execution log that separates
  A2A, pay.sh/x402 API spend, policy checks, evidence verification, and
  on-chain escrow events.

### Completion record

Branch `frontend/gcp-migration` contains the frontend migration baseline.
Validation passed: `npm run typecheck`, `npm run lint`, `npm test`, and
`npm run build` with network access for Google Fonts.

---

## Real A2A & Escrow MVP Plan

### Goal

Move the current Product MVP from fixture-led demo behavior toward a real
Golden Path where Promotion creation persists in Firestore, agent negotiation
resources are created only by explicit user actions, and escrow screens do not
pretend simulated receipts are real on-chain transactions.

### Scope

Phase 1 may change Product API read contracts, frontend data-source routing,
frontend tests, docs, and follow-up prompts. It does not wire the web3 gateway,
real Solana signing, pay.sh, Gemini structured output, Firebase Auth, or live
SNS/PDF analysis.

### Current state audit

| Capability | UI | API | Firestore | External/A2A/On-chain | E2E |
|---|---|---|---|---|---|
| Promotion | yes | yes | yes | n/a | partial |
| Matching | partial | yes | yes | no pay.sh/Gemini verification | partial |
| Gemini decisioning | no, deterministic copy only | no | no | no Vertex/Gemini call | no |
| A2A negotiation | projection only | Product API can call Creator A2A HTTP when configured | messages/tasks/artifacts persisted | HTTP `message:send` supported; Cloud Run OIDC not wired yet | partial |
| Agreement | yes | yes | yes | A2A Artifact relation persisted | partial |
| Escrow lock | yes | yes | yes | SIMULATED receipt, no Product API web3 gateway call | no real API path |
| Evidence verification | yes | yes | yes | deterministic URL/disclosure check, no live content fetch | partial |
| Escrow release | yes | yes | yes | SIMULATED receipt, no Product API web3 gateway call | no real API path |

### Mock dependency locations

- `frontend/src/product/mockData.ts`: deterministic UI fixtures kept for
  explicit mock mode only.
- `frontend/src/product/dataSource.ts`: `mock|api` boundary; API mode must not
  fabricate successful writes.
- `backend/libs/repositories/seed.py`: Firestore/in-memory demo seed.
- `backend/apps/api/routes.py`: current escrow receipts are explicitly
  `SIMULATED`.
- `web3/gateway/src`: gateway validation exists, but Product API is not wired to
  it for real signing.

### Boundaries

- Product API owns browser-facing reads/writes. Browser code must not create
  official A2A `Message`, `Task`, or `Artifact` payloads directly.
- Creator A2A service owns the external A2A HTTP surface. Product API calls it
  when `KNOT_CREATOR_A2A_MODE=http`; local/test mode keeps an in-process A2A
  task store for deterministic seeds.
- Escrow API currently guards idempotency and deterministic policy checks, then
  records `SIMULATED` receipts. Real lock/release must go through the private
  web3 gateway before being shown as devnet transactions.

### Missing Golden Path contracts

- Service-to-service Product API -> Creator A2A `message:send` contract with
  persisted task state reconciliation.
- Vertex/Gemini profile and negotiation summary contract that cannot authorize
  payments.
- pay.sh/x402 paid verification receipt schema in Promotion timeline.
- Product API -> web3 gateway lock/release request and response schema for real
  devnet signatures.
- Firebase Auth/session claims contract for Brand/Creator resource ownership.

### Milestones

- [x] M1 — default frontend API mode, explicit mock mode, no page-load write
      fallback, resource ID routing, and visible loading/empty/error states.
- [x] M2 — Product API calls Creator A2A service over HTTP and persists returned
      Task/Message/Artifact state.
- [ ] M3 — Product API calls private web3 gateway for real devnet lock/release
      signatures.
- [ ] M4 — pay.sh/x402 verification receipt appears in Promotion timeline.

### Contracts

- `NEXT_PUBLIC_KNOT_DATA_MODE=api` is now the default. Use
  `NEXT_PUBLIC_KNOT_DATA_MODE=mock` only for fixture-only UI work.
- `GET /api/v1/negotiations/{negotiationId}/agreement` returns the Agreement
  produced by a negotiation.
- `GET /api/v1/agreements/{agreementId}/escrow` returns the current escrow and
  settlement list for a deal without executing lock/release writes.
- Creator deal detail routes use `/creator/agreements/{agreementId}`. Legacy
  brand slug routes redirect back to the Creator result list.
- `KNOT_CREATOR_A2A_MODE=local|http` selects Product API negotiation
  orchestration. `http` posts to `CREATOR_AGENT_BASE_URL/message:send` using
  official A2A headers.

### Validation

```text
cd backend && ../.venv/bin/python -m pytest tests/test_api_promotions.py tests/test_api_escrow.py tests/test_a2a_negotiation.py
cd backend && ../.venv/bin/python -m ruff check apps/api libs/repositories tests/test_api_promotions.py tests/test_api_escrow.py
cd frontend && npm run typecheck
cd frontend && npm run lint
cd frontend && npm test
cd frontend && KNOT_API_BASE_URL=http://127.0.0.1:18080 NEXT_PUBLIC_KNOT_DATA_MODE=api npm run build
```

### Decisions and surprises

- 2026-07-26: The Real A2A/Escrow prompt explicitly scopes the first pass to
  audit + Phase 1 cleanup, not full real A2A/web3 implementation.
- 2026-07-26: Product API had useful read/write primitives, but frontend API
  mode was creating match/negotiation/settlement side effects during page
  render. Phase 1 separates reads from explicit button-triggered writes.
- 2026-07-26: No fixed `glow-bar` creator detail dependency remains in the
  active route map; creator deal detail is keyed by `agreementId`.
- 2026-07-26: Product API now has a Creator A2A HTTP client boundary. In HTTP
  mode it sends official `message:send`, persists returned Task/Message/Artifact
  state, and materializes an Agreement only from an accepted Artifact. Local
  mode remains the deterministic seed fallback.

---

## Product MVP Frontend Plan

### Goal

Replace the broad MVP pack route surface with a product-like flow that starts
from login/signup, sets up each role, lets agents negotiate through A2A, and
shows role-specific result, settlement/milestone, my page and settings screens.

### Scope

Frontend only. Backend, Firestore, A2A, and web3 code are not changed in this
reset. Documentation updates are limited to implementation status and frontend
handoff notes.

### Routes

```text
/
/login
/signup -> /signup/brand | /signup/creator
/brand/onboarding -> /brand/products/new -> /brand/negotiate -> /brand/result -> /brand/settlement
/brand/me
/brand/settings
/creator/onboarding -> /creator/criteria -> /creator/result -> /creator/agreements/{agreementId}
/creator/me
/creator/settings
/dev/admin
```

### Decisions and surprises

- 2026-07-25: User rejected the broad page-map approach as too complex.
- 2026-07-25: Current frontend MVP ignores the document-pack route map and
  keeps only the two role flows above.
- 2026-07-25: Creator onboarding is two decisions: SNS URL analysis, then
  minimum/blocked-topic preferences.
- 2026-07-25: Brand onboarding is two decisions: product document/PDF analysis,
  then proposal basics and maximum price.
- 2026-07-25: Offers, matching and negotiation must read as agent-driven A2A
  work, not manual human work. The UI shows "진행중이에요!" character states,
  sanitized progress, and final terms only. Private policy such as creator
  minimums, blocked topics, brand hard maximums and internal scoring details
  must not be shown to the counterparty.
- 2026-07-25: Productized the IA as login -> onboarding -> negotiation ->
  result for both roles, added `/dev/admin`, and introduced a `KnotDataSource`
  interface backed by mock data so Firestore/API can replace the source without
  changing route components.
- 2026-07-25: Refined the MVP into separate product pages instead of a connected
  01/02/03 stepper. Brand now has onboarding, product creation, matching/A2A
  negotiation, result and settlement pages. Creator now has SNS onboarding,
  private negotiation criteria, a multi-brand result list, brand detail
  milestones/quests, settlement status, my page and settings.
- 2026-07-25: Login/signup now look like real account surfaces. Signup chooses
  Brand or Creator first, then continues into role onboarding/profile creation.
- 2026-07-25: A2A negotiation remains agent-led. The UI shows animated
  "진행중이에요!" status and sanitized task progress only; private criteria,
  hard caps, internal scores and full A2A message bodies stay hidden.
- 2026-07-26: Removed the internal role sidebar because it still implied a
  single linear funnel. The global header now keeps only broad navigation,
  account pages (`My`, `Settings`) are exposed as small page-header actions,
  and each workspace page carries the current page title at the top. This
  better reflects that one Brand can manage many Promotions and one Creator can
  receive many agent-negotiated offers.

---

## Frontend-Backend API Integration Plan

### Goal

Connect the product MVP frontend to the existing `knot-api` without removing
mock mode. The frontend must keep the same page components in mock and API mode,
consume Product API projections instead of constructing A2A messages directly,
and make the hackathon proof points visible: Promotion, matching, A2A
negotiation, Agreement Artifact/termsHash, evidence verification and escrow
receipt state.

### Scope

May change `frontend/src/product`, frontend route call sites if needed,
frontend docs/tests, and status docs. Backend code changes are allowed only when
the documented API contract and implemented routes clearly disagree. Web3
program/gateway code is out of scope for this integration pass.

### Current state

Docs and backend agree on the core v1 transaction backbone:
Promotion -> MatchRun -> Negotiation -> Agreement -> Evidence -> Escrow ->
Settlement. Backend has concrete routes for those resources under `/api/v1`.
The Creator A2A service exposes AgentCard, `message:send`, `message:stream`,
tasks, subscribe and cancel. Frontend currently uses `KnotDataSource` with
deterministic mock state only.

Known contract gaps from the docs audit:

- The MVP document pack includes broader onboarding/auth/deal routes that are
  not implemented in backend yet. Current product MVP pages must remain mock for
  those onboarding/account surfaces.
- Product API does not expose a single deal aggregate route, so frontend API
  mode must compose Promotion, MatchRun, Negotiation, Agreement, Evidence,
  Escrow and Timeline responses.
- Product API currently persists A2A state but starts negotiation synchronously
  through the API orchestration route. Frontend should present it as agent work
  and avoid direct browser-to-A2A calls.
- Escrow receipts from Product API are `SIMULATED` until real web3 signing is
  wired. UI must not fabricate explorer links.
- pay.sh/x402 is documented as a required visible beat, but the Product API
  does not yet emit a paid API receipt event in the matching flow.
- 2026-07-26 follow-up scope: user asked to make login/signup/onboarding behave
  like a real site while excluding web3 payment. Product API now owns account
  bootstrap, brand onboarding, creator onboarding, creator criteria, and
  Promotion creation writes; frontend browser requests go through the Next
  `/api/v1/[...path]` proxy.

### Milestones

- [x] M1 — typed Product API client and `mock|api` data-source selector
- [x] M2 — API-mode mapping for Promotion, matching/A2A negotiation, Agreement
      terms, Creator deal list and settlement state
- [x] M3 — docs/status update that records API coverage, A2A compliance and
      remaining hackathon gaps
- [x] M4 — frontend checks and backend route smoke tests
- [x] M5 — API-backed login/signup/onboarding/Promotion creation without web3
      payment execution
- [x] M6 — minimal GCP setup and Cloud Run deployment for `knot-api` and
      `knot-web` against Firestore Native in `knot-dev-503505`

### Contracts

- `NEXT_PUBLIC_KNOT_DATA_MODE=mock|api` selects data mode; default is now
  `api`. Use `mock` explicitly for fixture-only UI work.
- `KNOT_API_BASE_URL` or `NEXT_PUBLIC_KNOT_API_BASE_URL` points Next server code
  at `knot-api`; default local URL is `http://127.0.0.1:8080`.
- Browser pages never write Firestore directly and never call private web3
  services.
- Frontend consumes `/api/v1` Product API projections. Direct A2A calls remain
  backend/service responsibility.

### Validation

Run from `frontend/`:

```text
npm run typecheck
npm run lint
npm test
npm run build
```

Run backend route tests from `backend/` if backend files change, or at minimum:

```text
python -m pytest tests/test_api_promotions.py tests/test_api_escrow.py tests/test_a2a_negotiation.py
```

### Decisions and surprises

- 2026-07-26: Started branch `integration/frontend-backend-api` from
  `origin/main`.
- 2026-07-26: Docs audit result: canonical v1 docs and backend implementation
  align on the core Promotion transaction backbone, but the MVP pack's broader
  auth/onboarding/deal aggregate routes are ahead of backend. Frontend API mode
  therefore composes implemented Product API routes and keeps onboarding/account
  surfaces on mock data.
- 2026-07-26: API mode smoke used local `knot-api` on port 18080 and confirmed
  `/brand/products/new`, `/brand/negotiate`, `/creator/result`,
  `/brand/settlement`, and `/dev/admin` render against backend data.
- 2026-07-26: Settlement page intentionally performs the current backend demo
  sequence in API mode: submit evidence, verify evidence, lock escrow, release
  the `content` milestone. Receipts remain `SIMULATED` and UI must not show
  explorer links until real signatures exist.
- 2026-07-26: Created GCP Firestore Native `(default)` in `us-central1`,
  Artifact Registry repo `knot`, and direct Cloud Build configs. Deployed:
  `knot-api` at `https://knot-api-260001601654.us-central1.run.app` and
  `knot-web` at `https://knot-web-260001601654.us-central1.run.app`. Verified
  real Firestore seed/smoke, backend `/readyz` and `/api/v1/promotions`,
  frontend `/`, `/brand/negotiate`, `/dev/admin`, and frontend proxy
  `/api/v1/promotions`.
