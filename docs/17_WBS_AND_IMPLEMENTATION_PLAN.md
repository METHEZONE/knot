# WBS and Safe Implementation Plan

## 1. Delivery approach

This is an existing-code refactor. Work in phases with a testable commit at each boundary. Do not start by replacing the entire frontend or merging branches wholesale.

## Phase 0 — repository and deployment audit

Tasks:

- inspect branches/worktrees/status/remotes;
- identify stable/deployed base and current UI source;
- inventory routes, components, API clients, schemas, Firestore collections/indexes, A2A, Web3, tests, infra, environment variables;
- run baseline checks;
- capture reference UI screenshots;
- create `INTEGRATION_AUDIT.md`, `API_COMPATIBILITY_MATRIX.md` and status baseline.

Exit:

- stable base and current deployed revisions documented;
- no code behavior changed;
- baseline failures separated from new failures.

Suggested commit:

```text
chore: establish final KNOT integration baseline
```

## Phase 1 — documentation and domain compatibility layer

Tasks:

- install this docs bundle as source of truth;
- update root `AGENTS.md`;
- add canonical enums/types for MatchRun/MatchCandidate without deleting legacy types;
- add adapters mapping legacy `campaign/deal` fields to canonical Promotion/Negotiation where needed;
- add contract tests.

Exit:

- existing UI/API still builds;
- no endpoint removed;
- compatibility matrix complete.

Commit:

```text
docs: adopt final KNOT agentic matching specification
```

## Phase 2 — URL analysis and card-deck persistence

Tasks:

- preserve existing card components/motion;
- connect product/profile URL cards to live analysis job APIs;
- implement structured Gemini outputs, unknown/confidence states, confirmation/edit;
- persist onboarding card state/resume;
- create/update canonical product/creator profiles;
- generate embeddings after confirmation.

Exit:

- both roles complete onboarding via existing design;
- refresh resumes;
- no fabricated metrics;
- live mode fails visibly when Gemini/config is unavailable.

Commit:

```text
feat: connect card-deck onboarding to live profile analysis
```

## Phase 3 — Creator Agent publication and discovery projection

Tasks:

- distinguish publication, accepting offers, availability and capacity;
- implement publish/pause/resume APIs;
- create `creatorDiscoveryProfiles` projection/update pipeline;
- add required Firestore indexes/vector field;
- add backfill/migration script from existing creator data;
- add privacy tests.

Exit:

- Creator can publish and leave;
- discovery documents contain no private minimum/blocked policy;
- profile-only and availability-only updates behave correctly.

Commit:

```text
feat: publish creator agents and maintain discovery index
```

## Phase 4 — deterministic discovery and ranking

Tasks:

- implement `CreatorDiscoveryRepository` interface;
- indexed hard filters;
- vector Top 100;
- private eligibility check;
- deterministic score and tie-break;
- Top 20 detail bound;
- candidate snapshots and safe explanations;
- no-scan tests.

Exit:

- candidate order reproducible;
- exact score components stored;
- full collection scan impossible through interface;
- Brand UI cannot manually select candidates.

Commit:

```text
feat: add indexed creator discovery and deterministic ranking
```

## Phase 5 — durable Match Run orchestration

Tasks:

- start/cancel/get/timeline APIs;
- one active run per Promotion;
- dispatcher/worker using existing durable mechanism or safe adapter;
- run lease and idempotency;
- max three sequential candidate attempts;
- reservation lease/concurrency;
- canonical events and recovery.

Exit:

- run continues after browser closure/service restart simulation;
- candidate 1 failure advances to candidate 2;
- exhausted path works;
- duplicate start returns one run.

Commit:

```text
feat: orchestrate durable one-agreement match runs
```

## Phase 6 — actual A2A integration

Tasks:

- preserve current A2A service/SDK;
- AgentCard registry lookup;
- actual OFFER/COUNTER/ACCEPT/REJECT flows;
- one Task per candidate, multi-turn;
- policy snapshots and deterministic validation;
- persisted Message/Task/Artifact/event;
- sanitized role projections;
- contract and two-window tests.

Exit:

- real counteroffer path;
- creator owner may be offline;
- terminal Artifact produces one result;
- no private threshold leak.

Commit:

```text
feat: execute real asynchronous A2A creator negotiations
```

## Phase 7 — Dashboard and live/replay UX

Tasks:

- preserve current Dashboard/agent visual language;
- typed ViewModels/adapters;
- Brand run control;
- Creator accepting-offers control;
- real event-driven candidate animation/chat;
- reconnect/refresh/replay;
- Technical Proof panel;
- recent/history cards.

Exit:

- no business timer animation;
- Dashboard shows persisted current/result state;
- two role windows show same canonical event sequence.

Commit:

```text
feat: project live agent runs into existing KNOT control rooms
```

## Phase 8 — optional pay.sh verification

Tasks:

- audit current pay.sh integration;
- tool allowlist/quote/cap/idempotency;
- conditional trigger;
- receipt/effect storage;
- explicit failure policy/UI;
- sandbox and real configured smoke.

Exit:

- one real paid verification call if environment permits;
- no double payment;
- core run remains truthful when tool unavailable.

Commit:

```text
feat: let brand agent purchase bounded candidate verification
```

## Phase 9 — Agreement and escrow

Tasks:

- canonical term normalization;
- deterministic terms hash;
- exactly-once Agreement;
- preserve/repair Web3 Gateway;
- local validator tests;
- delegated authority truth audit;
- devnet lock receipt;
- Match Run completion only after escrow confirmation.

Exit:

- one Agreement/lock;
- actual signature/Explorer;
- creator sees funded state;
- failure recovery tested.

Commit:

```text
feat: bind A2A agreements to devnet escrow
```

## Phase 10 — evidence and settlement

Tasks:

- content URL submission/security;
- Gemini observations;
- deterministic gate/manual review state;
- one 100% release;
- idempotent operation and reconciliation;
- Dashboard updates and receipt.

Exit:

- actual release signature;
- ambiguity does not auto-pay;
- no duplicate payout.

Commit:

```text
feat: verify creator evidence and release escrow
```

## Phase 11 — QA, deployment and demo lock

Tasks:

- full test matrix;
- performance/query guard;
- security/secret scan;
- Cloud Run build/deploy;
- smoke and two-window E2E;
- screenshots/video artifacts;
- README, architecture and limitations;
- update status with commits/revisions/URLs/signatures.

Exit:

- final happy path live;
- rollback revision available;
- no silent mocks;
- 3-minute demo rehearsed.

Commit:

```text
release: deploy final KNOT agentic commerce demo
```

## 2. Parallel team ownership

Suggested boundaries for a three-person team:

| Owner | Primary scope |
|---|---|
| Frontend | Existing-design card deck, Dashboard ViewModels, live/replay, technical proof |
| Backend/Agent | Analysis, discovery/index, Match Run, A2A, policy, events, APIs |
| Web3/Payments | pay.sh, authority, escrow/release, receipt and transaction proof |

Shared contracts are frozen in docs/types before parallel changes.

## 3. Risk register

| Risk | Mitigation |
|---|---|
| UI branch conflicts with stable API code | selective port + adapters; no wholesale merge |
| existing field names differ | compatibility matrix and dual-read migration |
| async work stops after request | durable dispatcher/worker and persisted states |
| creator double-booked | transactional reservation/capacity |
| Gemini hallucinates data/decision | structured output, confirmation, deterministic policy |
| A2A only visual mock | contract tests, actual Task/Message/Artifact and IDs |
| escrow double charge | idempotent operation and reconciliation |
| pay.sh unavailable | explicit free-signal policy; no silent fake receipt |
| Instagram inaccessible | truthful limited profile + user confirmation |
| demo latency | warm critical service if budget allows; prepared real receipt backup clearly labeled historical |
| scope blow-up | P0 one Agreement, three candidates, one deliverable, one settlement milestone |
