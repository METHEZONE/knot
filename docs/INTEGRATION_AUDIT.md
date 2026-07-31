# KNOT Final Integration Audit

> Phase 1 audit. Do not treat unresolved items as implemented features.

## Git Baseline

| Item | Evidence |
|---|---|
| Working branch | `feat/final-agentic-matching-flow` |
| Local phase base | `65e55230c5d2076bae67aef70df7345e40df8674` |
| Stable backend/API/Web3 candidate | `origin/main` `e58aa9b9b13b2776962bfe0f56a38d44acfd0940` |
| UI reference | `origin/feat/two-user-session` `263c9d3859c5979c51b418542e953637339e6583` |
| Additional integrated product flow branch | `origin/feat/knot-v2-product-flow` `e1a2d22f50f37dbf89a9322858b5d15426dafcbe` |
| Remote | `https://github.com/METHEZONE/knot.git` |

`git fetch --all --prune` completed successfully on 2026-07-31.

## Framework and Package Managers

| Area | Current source | Evidence |
|---|---|---|
| Frontend | Next.js 16.2.11, React 19.2.4, TypeScript | `frontend/package.json` |
| Backend | FastAPI, Pydantic v2, Python >=3.12 | `backend/pyproject.toml` |
| A2A service | FastAPI app in creator-agent service | `backend/apps/creator_agent/main.py` |
| Web3 Gateway | Express 5, TypeScript, Solana Web3/SPL Token | `web3/gateway/package.json`, `web3/gateway/src/app.ts` |
| Escrow program | Anchor/Rust | `Anchor.toml`, `programs/knot-escrow/Cargo.toml` |

## Repository Layout

| Path | Role |
|---|---|
| `frontend/src/app` | Next.js routes |
| `frontend/src/product` | Existing KNOT product screens, API client, data source, mock fixture surface |
| `backend/apps/api` | Product API FastAPI app and routes |
| `backend/apps/creator_agent` | Creator A2A HTTP service |
| `backend/libs` | Domain, policies, A2A, AI, Web3, repository adapters |
| `backend/fixtures` | Explicit demo/test fixtures |
| `web3/gateway` | Private gateway for escrow lock/release operations |
| `programs/knot-escrow` | Anchor escrow program |
| `infra/cloudbuild` | Cloud Build configs for frontend/API/A2A/Web3 |
| `scripts` | Local, seed, deploy, Firestore smoke scripts |

## Routes and Navigation

Current frontend routes include:

- Public/auth: `/`, `/login`, `/signup`, `/signup/brand`, `/signup/creator`
- Brand: `/brand`, `/brand/onboarding`, `/brand/promotions`, `/brand/promotions/new`, `/brand/promotions/[promotionId]`, `/brand/negotiate`, `/brand/matching`, `/brand/negotiations/[negotiationId]`, `/brand/agreements/[agreementId]`, `/brand/result`, `/brand/settlement`, `/brand/settings`, `/brand/me`
- Creator: `/creator`, `/creator/onboarding`, `/creator/offers`, `/creator/offers/[negotiationId]`, `/creator/negotiate`, `/creator/agreements`, `/creator/agreements/[agreementId]`, `/creator/result`, `/creator/settlements`, `/creator/settings`, `/creator/me`, `/creator/criteria`, `/creator/milestones`
- Dev: `/dev/admin`

Compatibility note: legacy result/negotiate/matching routes still exist. Final canonical resource routes should be connected through adapters rather than deleting these paths during Phase 1.

## Visual and UX Source

The current app contains reusable visual components:

- `frontend/src/product/ProductScreens.tsx`
- `frontend/src/product/A2AVisualizer.tsx`
- `frontend/src/components/AgentCharacter.tsx`
- `frontend/src/components/SquiggleFilters.tsx`
- `frontend/src/components/TopBar.tsx`
- `frontend/src/app/globals.css`
- `frontend/public/knot/index.html`

Final UI implementation must preserve the existing card, paper, hand-drawn, agent, chat, and knot visual language. Screenshot baseline is not captured in Phase 1 because no UI behavior was changed.

## Auth, Role, and Ownership

| Area | Current behavior | Evidence |
|---|---|---|
| Auth verifier | Firebase token verifier with emulator/test modes | `backend/libs/auth/firebase.py` |
| Current user | `GET /api/v1/me` bootstraps account by Firebase UID | `backend/apps/api/routes.py` |
| Role selection | `POST /api/v1/me/role` idempotent, one role only | `backend/apps/api/routes.py` |
| Brand profile | `POST /api/v1/me/brand-profile` uses authenticated UID | `backend/apps/api/routes.py` |
| Creator profile | `POST /api/v1/me/creator-profile` uses authenticated UID | `backend/apps/api/routes.py` |
| Scoped routes | Brand/creator dashboard and resource routes enforce owner role | `backend/tests/test_api_resource_routes.py` |

Legacy bootstrap endpoints still exist and are less strict. They must remain only as compatibility/dev surfaces until migrated.

## Product API and Proxies

Current frontend API proxy:

- `frontend/src/app/api/v1/[...path]/route.ts`

Current typed client:

- `frontend/src/product/apiClient.ts`

Current Product API exposes health/readiness/version and many `/api/v1` operations. Full endpoint mapping is in `docs/API_COMPATIBILITY_MATRIX.md`.

## Firestore and State

Current repository abstraction:

- `KnotRepository`
- `InMemoryDocumentStore`
- `FirestoreDocumentStore`

Current Firestore adapter uses `collection(...).stream()` for list operations. This is acceptable for small seeded tests but conflicts with final bounded discovery requirements if reused for matching at scale.

Phase 3 adds `firestore.indexes.json` for Creator discovery composite query families. No `firestore.rules` file or deployed vector index configuration has been verified in source.

## Mock, Fixture, and Live Modes

Allowed explicit fixture surfaces exist:

- `backend/fixtures`
- `backend/libs/repositories/seed.py`
- `frontend/src/product/mockData.ts`
- `NEXT_PUBLIC_KNOT_DATA_MODE=mock`

Important safeguards already present:

- Frontend tests assert API mode does not silently fall back to mock.
- Backend escrow tests assert simulated gateway receipts are persisted as failed locks.
- Product copy says fake Solana success is not used before real claim signature integration.

Risk:

- Phase 5 records canonical Match Run state events and idempotency, but execution still completes synchronously in the request; this is not the final external worker flow.

## Gemini

Current Gemini boundary:

- `backend/libs/ai/gemini.py`
- Settings: `KNOT_GEMINI_MODE`, `GEMINI_MODEL`, `VERTEX_AI_LOCATION`

Current matching explanation uses deterministic fallback when Gemini mode is off. Final onboarding analysis and evidence observation remain later-phase work.

## Matching

Current implementation:

- `backend/libs/agents/matching.py`
- `rank_creators(promotion, creators)` scores in memory.
- Phase 4 `POST /api/v1/promotions/{promotion_id}/matches:run` queries `creatorDiscoveryProfiles` through `CreatorDiscoveryRepository`, applies `limit=100`, and bounds full Creator profile reads to Top 20.
- Candidate documents are written under `matchRuns/{run}/candidates/{creatorId}`.

Final gap:

- Needs live vector retrieval, reservation, durable state machine, and sequential candidate fallback in later phases.

## A2A

Current implementation:

- `backend/libs/a2a/models.py`
- `backend/libs/a2a/client.py`
- `backend/libs/a2a/store.py`
- `backend/apps/creator_agent/main.py`

Current A2A operations include:

- `GET /a2a/v1/.well-known/agent-card.json`
- `POST /a2a/v1/message:send`
- `POST /a2a/v1/message:stream`
- `GET /a2a/v1/tasks`
- `GET /a2a/v1/tasks/{task_id}`
- `POST /a2a/v1/tasks/{task_id}:subscribe`
- `POST /a2a/v1/tasks/{task_id}:cancel`

Final gap:

- Default task store is in-memory. Firestore-backed durable A2A Task/message/artifact storage is partially projected by Product API but not the Creator service default.

## Agreement, Escrow, Evidence, Settlement

Current implementation:

- Agreement terms/hash: `backend/libs/domain/hashing.py`, `backend/apps/api/routes.py`
- Evidence policy: `backend/libs/policies/evidence.py`
- Web3 client: `backend/libs/web3/client.py`
- Gateway: `web3/gateway/src/app.ts`, `web3/gateway/src/escrow.ts`
- Escrow program: `programs/knot-escrow/src/lib.rs`

Current API has:

- `GET /api/v1/agreements/{agreement_id}`
- `GET /api/v1/agreements/{agreement_id}/escrow`
- `POST /api/v1/agreements/{agreement_id}/evidence`
- `POST /api/v1/evidence/{evidence_id}:verify`
- `POST /api/v1/agreements/{agreement_id}/escrow:lock`
- `POST /api/v1/escrows/{escrow_id}/milestones/{milestone_id}:release`
- `GET /api/v1/transaction-receipts/{receipt_id}`

Final gap:

- Existing AgreementTerms tests still use legacy 30/70 milestone examples; final MVP requires one 100% post-verification milestone in product flow.

## Infrastructure and Deployment

Cloud Build configs exist:

- `infra/cloudbuild/web.yaml`
- `infra/cloudbuild/api.yaml`
- `infra/cloudbuild/creator-agent.yaml`
- `infra/cloudbuild/web3.yaml`

Local/deploy scripts exist:

- `scripts/local/dev_stack.sh`
- `scripts/deploy_cloud_run_demo.sh`
- `scripts/deploy_devnet.sh`
- `scripts/localnet_settlement.sh`
- `scripts/firestore_smoke.py`

No deployment, IAM, secret, wallet funding, program deployment, or on-chain transaction was performed in Phase 1.

## Baseline Commands

Discovered commands:

- Frontend: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`
- Backend: `python -m pytest`, `ruff`, `mypy` from `backend/pyproject.toml`
- Web3 gateway: `npm run build`, `npm run lint`, `npm test`
- Rust/Anchor: Cargo/Anchor project present, not run in Phase 1 unless required by tests

Test results are recorded in `docs/IMPLEMENTATION_STATUS.md`.
