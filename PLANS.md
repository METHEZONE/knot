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
/creator/onboarding -> /creator/criteria -> /creator/result -> /creator/brands/{brandId}
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
