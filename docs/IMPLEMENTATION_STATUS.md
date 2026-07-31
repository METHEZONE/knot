# KNOT Final Implementation Status

> Updated for Phase 5 on 2026-07-31. Do not mark a capability verified without evidence.

## Status Legend

- `NOT_STARTED`
- `IN_PROGRESS`
- `BLOCKED`
- `IMPLEMENTED`
- `VERIFIED`
- `DEPLOYED`

## 1. Baseline Audit

| Area | Status | Existing source | Evidence | Notes |
|---|---|---|---|---|
| Stable/deployed base identified | IMPLEMENTED | `origin/main` | `e58aa9b9b13b2776962bfe0f56a38d44acfd0940` | Latest merged backend/API/Web3 wallet and settlement line |
| Existing design reference captured | IMPLEMENTED | `origin/feat/two-user-session` | `263c9d3859c5979c51b418542e953637339e6583` | Screenshot baseline not captured in Phase 1 |
| Auth | IMPLEMENTED | `backend/libs/auth/firebase.py`, `/api/v1/me` | Audit complete | Tests pending in this phase |
| Product API | IMPLEMENTED | `backend/apps/api/routes.py` | `docs/API_COMPATIBILITY_MATRIX.md` | Canonical Match Run aliases added |
| Firestore/indexes | IN_PROGRESS | `backend/libs/repositories/firestore_paths.py`, `firestore.indexes.json` | `docs/FIRESTORE_MIGRATION_PLAN.md` | Creator discovery composite index config added; rules/vector verification pending |
| Async worker | IN_PROGRESS | `backend/apps/api/routes.py` | Phase 5 tests | Canonical durable events/idempotency added; external worker pending |
| Gemini analysis | IN_PROGRESS | `backend/libs/ai/gemini.py` | Audit complete | Final URL analysis flow pending |
| Matching | IN_PROGRESS | `backend/libs/agents/discovery.py`, `backend/libs/agents/matching.py` | Phase 4 focused tests | Product API Match Run uses bounded discovery query; vector retrieval pending |
| A2A | IN_PROGRESS | `backend/apps/creator_agent`, `backend/libs/a2a` | Audit complete | HTTP boundary exists; durable Creator task store pending |
| Agreement | IN_PROGRESS | `backend/apps/api/routes.py`, `backend/libs/domain/hashing.py` | Audit complete | Final one-milestone shape pending |
| Escrow/release | IN_PROGRESS | `web3/gateway`, `backend/libs/web3` | Audit complete | Devnet path exists; no Phase 1 on-chain action |
| Cloud Run | IN_PROGRESS | `infra/cloudbuild/*.yaml` | Audit complete | No deployment in Phase 1 |

## 2. Capability Matrix

| Capability | UI | API | Firestore | External/A2A/On-chain | E2E | Evidence |
|---|---|---|---|---|---|---|
| Brand card onboarding | IN_PROGRESS | IMPLEMENTED | IMPLEMENTED | NOT_STARTED | NOT_STARTED | Phase 2 analysis/session APIs added; visual card flow still pending |
| Creator card onboarding | IN_PROGRESS | IMPLEMENTED | IMPLEMENTED | NOT_STARTED | NOT_STARTED | Phase 2 analysis/session APIs and Phase 3 publish API added; card UX wiring pending |
| Creator Agent publish/pause | IN_PROGRESS | IMPLEMENTED | IMPLEMENTED | N/A | NOT_STARTED | Phase 3 owner-scoped APIs added; visual dashboard controls pending |
| Discovery projection/index | N/A | IMPLEMENTED | IMPLEMENTED | NOT_STARTED | NOT_STARTED | Phase 4 Product API matching consumes discovery projections with bounded query |
| Deterministic ranking | N/A | IMPLEMENTED | IN_PROGRESS | N/A | NOT_STARTED | Phase 4 public score components and deterministic tie-breakers added |
| Match Run orchestration | IN_PROGRESS | IMPLEMENTED | IMPLEMENTED | NOT_STARTED | NOT_STARTED | Phase 5 idempotency, cancel, state history, and canonical events added; worker pending |
| Candidate reservation | N/A | NOT_STARTED | NOT_STARTED | N/A | NOT_STARTED | |
| A2A counteroffer | IN_PROGRESS | IN_PROGRESS | IN_PROGRESS | IN_PROGRESS | NOT_STARTED | Existing tests/routes audited |
| Agreement Artifact/hash | IN_PROGRESS | IN_PROGRESS | IN_PROGRESS | IN_PROGRESS | NOT_STARTED | Existing Agreement/hash code audited |
| pay.sh verification | N/A | IN_PROGRESS | IN_PROGRESS | IN_PROGRESS | NOT_STARTED | Existing sandbox route/tests audited |
| Devnet escrow | IN_PROGRESS | IN_PROGRESS | IN_PROGRESS | IN_PROGRESS | NOT_STARTED | Existing Gateway/devnet config audited; no tx run |
| Evidence verification | IN_PROGRESS | IN_PROGRESS | IN_PROGRESS | IN_PROGRESS | NOT_STARTED | Existing evidence route/policy audited |
| Settlement release | IN_PROGRESS | IN_PROGRESS | IN_PROGRESS | IN_PROGRESS | NOT_STARTED | Existing release route audited |
| Dashboard live/replay | IN_PROGRESS | IN_PROGRESS | IN_PROGRESS | IN_PROGRESS | NOT_STARTED | Current dashboards exist; event-driven final UX pending |
| Technical Proof | IN_PROGRESS | IN_PROGRESS | IN_PROGRESS | IN_PROGRESS | NOT_STARTED | Receipt/ID routes exist; final panel pending |
| Deployment | N/A | N/A | N/A | N/A | NOT_STARTED | No deployment in Phase 1 |

## 3. Phase 1 Changes

- Updated `AGENTS.md` to use `docs/KNOT_PRODUCT_MASTER_SPEC_FINAL.md`.
- Added final canonical status enums and `UsageRights` compatibility helpers.
- Added canonical Firestore collection/path constants.
- Added canonical Product API aliases:
  - `POST /api/v1/promotions/{promotion_id}/match-runs`
  - `GET /api/v1/match-runs/{match_run_id}/timeline`
  - `GET /api/v1/match-runs/{match_run_id}/events`
- Created:
  - `docs/INTEGRATION_AUDIT.md`
  - `docs/API_COMPATIBILITY_MATRIX.md`
  - `docs/FIRESTORE_MIGRATION_PLAN.md`
  - `.agent/execplans/01-final-compatibility-domain.md`

## 4. Phase 2 Changes

- Added authenticated onboarding state APIs:
  - `GET /api/v1/onboarding`
  - `PATCH /api/v1/onboarding`
- Added authenticated analysis APIs:
  - `POST /api/v1/analyses/product`
  - `POST /api/v1/analyses/creator-profile`
  - `GET /api/v1/analyses/{analysisId}`
  - `POST /api/v1/analyses/{analysisId}:confirm`
  - `POST /api/v1/onboarding/brand/analyze-source`
- Added `analysisJobs` and `onboardingSessions` path helpers.
- Added typed frontend API client methods.
- Added tests for owner scoping, idempotent analysis, confirmation, and unsafe URL rejection.

## 5. Phase 3 Changes

- Added authenticated Creator Agent control APIs:
  - `GET /api/v1/creator/agent`
  - `POST /api/v1/creator/agent:publish`
  - `POST /api/v1/creator/agent:pause`
  - `POST /api/v1/creator/agent:resume`
- New Creator Agent writes include publication, accepting-offers, availability, and capacity fields.
- Publishing/pause/resume writes `creatorDiscoveryProfiles/{creatorId}` through a shared public projection builder.
- Added `firestore.indexes.json` composite index source configuration for Creator discovery query families.
- Added `scripts/backfill_creator_discovery_profiles.py`; it is dry-run by default and was not executed against live Firestore.
- Added typed frontend API client methods for Creator Agent control.
- Added tests for projection privacy, owner mismatch rejection, dry-run backfill, and idempotent backfill replay.

## 6. Phase 4 Changes

- Added `CreatorDiscoveryRepository` and Firestore-backed bounded query implementation.
- Added repository `query_raw_documents(..., limit=...)` primitive for in-memory and Firestore stores.
- Updated Product API Match Run start routes to query `creatorDiscoveryProfiles` instead of scanning all `creatorProfiles`.
- Added deterministic public ranking components:
  - `semanticMoodFit`
  - `categoryAudienceFit`
  - `formatFit`
  - `scheduleFit`
  - `coarseBudgetFit`
  - `reliabilityFit`
- Candidate snapshots now store score components, ranking/index/profile version fields, safe explanation facts, and query metrics.
- Demo seed explicitly writes public discovery projections for active seeded Creators.
- Added no-scan and bounded query tests.

## 7. Phase 5 Changes

- Added `matchRuns/{runId}/events/{eventId}` path helper and canonical run events.
- Match Run starts now write ordered state events:
  - `MATCH_RUN_READY`
  - `MATCH_RUN_DISCOVERING`
  - `MATCH_RUN_RANKING`
  - `MATCH_RUN_SELECTING`
  - `MATCH_RUN_COMPLETED`
- Match Run starts accept optional `Idempotency-Key` and replay the same run for duplicate starts.
- Added active non-terminal run guard for a Promotion.
- Added `POST /api/v1/match-runs/{match_run_id}:cancel` with terminal-state guard.
- Added `matchRuns` active lookup index source configuration.

## 8. Query-Bound Proof

```text
Discovery implementation: CreatorDiscoveryRepository over creatorDiscoveryProfiles
Public hard-filter query: agentStatus, acceptingOffers, availability, capacityAvailable, countryCode, categoryKeys, primaryFormatKey, nextAvailableAt
Vector index: not implemented or deployed yet; semantic fit is deterministic neutral value
Top K: discovery limit 100 enforced by interface
Maximum detailed profile reads: Top 20 enforced by detail_candidates()
Maximum paid tool calls: current pay.sh operation is one selected creator path, final Top 3 cap pending
Test proving no unbounded scan: test_run_match_uses_indexed_discovery_without_creator_profile_scan
```

## 9. Test Evidence

| Command/suite | Result | Commit | Date | Artifact/log |
|---|---|---|---|---|
| Backend Phase 1 focused tests | VERIFIED: 20 passed, 1 warning | working tree | 2026-07-31 | `../.venv/bin/python -m pytest tests/test_domain_models.py tests/test_api_promotions.py` from `backend` |
| Backend full pytest | VERIFIED: 97 passed, 5 skipped, 1 warning | working tree | 2026-07-31 | `../.venv/bin/python -m pytest` from `backend` |
| Backend ruff | VERIFIED: all checks passed | working tree | 2026-07-31 | `../.venv/bin/python -m ruff check .` from `backend` |
| Backend mypy | VERIFIED: no issues in 47 source files | working tree | 2026-07-31 | `../.venv/bin/python -m mypy` from `backend` |
| Frontend typecheck | VERIFIED | working tree | 2026-07-31 | `npm run typecheck` from `frontend` |
| Frontend lint | VERIFIED | working tree | 2026-07-31 | `npm run lint` from `frontend` |
| Frontend unit | VERIFIED: 18 passed | working tree | 2026-07-31 | `npm test` from `frontend` |
| Frontend build | VERIFIED | working tree | 2026-07-31 | `npm run build` from `frontend` |
| Web3 build | VERIFIED | working tree | 2026-07-31 | `npm run build` from `web3/gateway` |
| Web3 unit | VERIFIED: 9 passed | working tree | 2026-07-31 | `npm test` from `web3/gateway` |
| Web3 lint | VERIFIED | working tree | 2026-07-31 | `npm run lint` from `web3/gateway` |
| Phase 2 onboarding API focused tests | VERIFIED: 5 passed, 2 warnings | working tree | 2026-07-31 | `../.venv/bin/python -m pytest tests/test_api_onboarding.py` from `backend` |
| Phase 2 backend full pytest | VERIFIED: 100 passed, 5 skipped, 2 warnings | working tree | 2026-07-31 | `../.venv/bin/python -m pytest` from `backend` |
| Phase 2 backend ruff | VERIFIED: all checks passed | working tree | 2026-07-31 | `../.venv/bin/python -m ruff check .` from `backend` |
| Phase 2 backend mypy | VERIFIED: no issues in 47 source files | working tree | 2026-07-31 | `../.venv/bin/python -m mypy` from `backend` |
| Phase 2 frontend typecheck | VERIFIED | working tree | 2026-07-31 | `npm run typecheck` from `frontend` |
| Phase 2 frontend lint | VERIFIED | working tree | 2026-07-31 | `npm run lint` from `frontend` |
| Phase 2 frontend unit | VERIFIED: 18 passed | working tree | 2026-07-31 | `npm test` from `frontend` |
| Phase 2 frontend build | VERIFIED | working tree | 2026-07-31 | `npm run build` from `frontend` |
| Phase 3 backend focused tests | VERIFIED: 7 passed, 1 warning | working tree | 2026-07-31 | `../.venv/bin/python -m pytest tests/test_api_dashboards.py tests/test_creator_discovery.py` from `backend` |
| Phase 3 backend full pytest | VERIFIED: 103 passed, 5 skipped, 2 warnings | working tree | 2026-07-31 | `../.venv/bin/python -m pytest` from `backend` |
| Phase 3 backend ruff | VERIFIED: all checks passed | working tree | 2026-07-31 | `../.venv/bin/python -m ruff check .` from `backend` |
| Phase 3 backend mypy | VERIFIED: no issues in 48 source files | working tree | 2026-07-31 | `../.venv/bin/python -m mypy` from `backend` |
| Phase 3 frontend typecheck | VERIFIED | working tree | 2026-07-31 | `npm run typecheck` from `frontend` |
| Phase 3 frontend lint | VERIFIED | working tree | 2026-07-31 | `npm run lint` from `frontend` |
| Phase 3 frontend unit | VERIFIED: 18 passed | working tree | 2026-07-31 | `npm test` from `frontend` |
| Phase 3 frontend build | VERIFIED | working tree | 2026-07-31 | `npm run build` from `frontend` |
| Phase 3 index config validation | VERIFIED | working tree | 2026-07-31 | `.venv/bin/python -m json.tool firestore.indexes.json` |
| Phase 3 backfill script syntax | VERIFIED | working tree | 2026-07-31 | `.venv/bin/python -m py_compile scripts/backfill_creator_discovery_profiles.py` |
| Phase 4 backend focused tests | VERIFIED: 30 passed, 1 warning | working tree | 2026-07-31 | `../.venv/bin/python -m pytest tests/test_api_promotions.py tests/test_creator_discovery.py tests/test_firestore_repositories.py tests/test_firestore_adapter.py tests/test_matching.py` from `backend` |
| Phase 4 backend full pytest | VERIFIED: 106 passed, 5 skipped, 2 warnings | working tree | 2026-07-31 | `../.venv/bin/python -m pytest` from `backend` |
| Phase 4 backend ruff | VERIFIED: all checks passed | working tree | 2026-07-31 | `../.venv/bin/python -m ruff check .` from `backend` |
| Phase 4 backend mypy | VERIFIED: no issues in 49 source files | working tree | 2026-07-31 | `../.venv/bin/python -m mypy` from `backend` |
| Phase 4 frontend typecheck | VERIFIED | working tree | 2026-07-31 | `npm run typecheck` from `frontend` |
| Phase 4 frontend lint | VERIFIED | working tree | 2026-07-31 | `npm run lint` from `frontend` |
| Phase 4 frontend unit | VERIFIED: 18 passed | working tree | 2026-07-31 | `npm test` from `frontend` |
| Phase 4 frontend build | VERIFIED | working tree | 2026-07-31 | `npm run build` from `frontend` |
| Phase 4 index config validation | VERIFIED | working tree | 2026-07-31 | `.venv/bin/python -m json.tool firestore.indexes.json` |
| Phase 5 backend focused tests | VERIFIED: 27 passed, 1 warning | working tree | 2026-07-31 | `../.venv/bin/python -m pytest tests/test_api_promotions.py tests/test_firestore_repositories.py` from `backend` |
| Phase 5 backend full pytest | VERIFIED: 108 passed, 5 skipped, 2 warnings | working tree | 2026-07-31 | `../.venv/bin/python -m pytest` from `backend` |
| Phase 5 backend ruff | VERIFIED: all checks passed | working tree | 2026-07-31 | `../.venv/bin/python -m ruff check .` from `backend` |
| Phase 5 backend mypy | VERIFIED: no issues in 49 source files | working tree | 2026-07-31 | `../.venv/bin/python -m mypy` from `backend` |
| Phase 5 frontend typecheck | VERIFIED | working tree | 2026-07-31 | `npm run typecheck` from `frontend` |
| Phase 5 frontend lint | VERIFIED | working tree | 2026-07-31 | `npm run lint` from `frontend` |
| Phase 5 frontend unit | VERIFIED: 18 passed | working tree | 2026-07-31 | `npm test` from `frontend` |
| Phase 5 frontend build | VERIFIED | working tree | 2026-07-31 | `npm run build` from `frontend` |
| Phase 5 index config validation | VERIFIED | working tree | 2026-07-31 | `.venv/bin/python -m json.tool firestore.indexes.json` |

## 10. Latest Verified E2E

```text
Commit:
Frontend revision:
Product API revision:
A2A revision:
Web3 revision:
Live URL:
Verified at:
Verifier:
Brand test account:
Creator test account:
Match Run ID:
Negotiation ID:
A2A Task ID:
Agreement ID:
Escrow lock signature:
Settlement release signature:
```

No E2E or live transaction was executed through Phase 5.

## 11. Known Blockers

```text
BLOCKER: External Match Run worker dispatch is not implemented.
IMPACT: Current run has durable records/events but still completes synchronously in the request.
EVIDENCE: Phase 5 adds canonical events/idempotency/cancel, but no queue or worker claim process is present.
OWNER: Backend/Agent phase.
NEXT ACTION: Add worker dispatch/claim/retry or document synchronous MVP limit before final E2E.
WORKAROUND FOR DEMO (truthfully labeled): Existing synchronous path can be used only as legacy behavior, not final proof.
```

```text
BLOCKER: Firestore rules and vector discovery index are not verified.
IMPACT: Final bounded/vector discovery and security rules cannot be verified yet.
EVIDENCE: Phase 4 uses composite discovery indexes in source, but no firestore.rules or deployed vector index was verified.
OWNER: Backend/Infra phase.
NEXT ACTION: Add rules and managed vector index verification in an infra phase.
WORKAROUND FOR DEMO (truthfully labeled): Emulator/in-memory tests only.
```

## 12. Update Rule

For each phase:

1. audit or plan;
2. implement;
3. run checks;
4. capture evidence/screenshots/IDs;
5. commit;
6. update this file;
7. deploy only from verified commit.
