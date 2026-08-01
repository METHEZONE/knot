# KNOT Final Implementation Status

> Updated for Agent settlement automation follow-up on 2026-08-01. Do not mark a capability verified without evidence.

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
| A2A | IN_PROGRESS | `backend/apps/creator_agent`, `backend/libs/a2a`, `backend/libs/a2a/registry.py` | Phase 6 focused tests | Registry lookup, AgentCard validation, service auth, dedupe, terminal guard, task event persistence covered |
| Agreement | IN_PROGRESS | `backend/apps/api/routes.py`, `backend/libs/domain/hashing.py` | Audit complete | Final one-milestone shape pending |
| Escrow/release | IN_PROGRESS | `web3/gateway`, `backend/libs/web3` | Audit complete | Devnet path exists; no Phase 1 on-chain action |
| Cloud Run | IN_PROGRESS | `infra/cloudbuild/*.yaml` | Audit complete | No deployment in Phase 1 |

## 2. Capability Matrix

| Capability | UI | API | Firestore | External/A2A/On-chain | E2E | Evidence |
|---|---|---|---|---|---|---|
| Brand card onboarding | IN_PROGRESS | IMPLEMENTED | IMPLEMENTED | NOT_STARTED | NOT_STARTED | Phase 2 analysis/session APIs added; visual card flow still pending |
| Creator card onboarding | IN_PROGRESS | IMPLEMENTED | IMPLEMENTED | NOT_STARTED | NOT_STARTED | Phase 2 analysis/session APIs and Phase 3 publish API added; card UX wiring pending |
| Creator Agent publish/pause | IMPLEMENTED | IMPLEMENTED | IMPLEMENTED | N/A | NOT_STARTED | Phase 7 Creator Dashboard control calls owner-scoped publish/pause/resume APIs |
| Discovery projection/index | N/A | IMPLEMENTED | IMPLEMENTED | NOT_STARTED | NOT_STARTED | Phase 4 Product API matching consumes discovery projections with bounded query |
| Deterministic ranking | N/A | IMPLEMENTED | IN_PROGRESS | N/A | NOT_STARTED | Phase 4 public score components and deterministic tie-breakers added |
| Match Run orchestration | IN_PROGRESS | IMPLEMENTED | IMPLEMENTED | NOT_STARTED | NOT_STARTED | Phase 5 idempotency, cancel, state history, and canonical events added; worker pending |
| Candidate reservation | N/A | NOT_STARTED | NOT_STARTED | N/A | NOT_STARTED | |
| A2A counteroffer | IN_PROGRESS | IMPLEMENTED | IMPLEMENTED | IMPLEMENTED | NOT_STARTED | Phase 6 registry-validated HTTP A2A counter/accept path tested |
| Agreement Artifact/hash | IMPLEMENTED | VERIFIED | VERIFIED | IMPLEMENTED | NOT_STARTED | Phase 9 enforces canonical terms hash at Agreement creation and stores one 100% milestone |
| pay.sh verification | IMPLEMENTED | VERIFIED | VERIFIED | IN_PROGRESS | NOT_STARTED | Phase 8 adds allowlist, configured quote/caps, idempotent operation/receipt storage, and explicit skipped/failed continuation policy; real sandbox smoke skipped by environment |
| Devnet escrow | IN_PROGRESS | VERIFIED | VERIFIED | IN_PROGRESS | NOT_STARTED | Agent automation can trigger lock when `KNOT_AGENT_AUTO_SETTLEMENT=1`; localnet on-chain smoke confirmed lock signature `5t3Fhm...XvQu`. Shared devnet deploy remains blocked by missing funded signer/pay.sh secrets |
| Evidence verification | IN_PROGRESS | VERIFIED | VERIFIED | IN_PROGRESS | NOT_STARTED | Phase 10 requires funded escrow, validates external https source URLs, stores source digest, records verification results, and blocks failed evidence |
| Settlement release | IN_PROGRESS | VERIFIED | VERIFIED | IN_PROGRESS | NOT_STARTED | Agent automation released after passed evidence in localnet smoke: release signature `5tD6e7...19No`, creator token balance 650 USDC. Shared devnet deploy remains blocked by missing funded signer/pay.sh secrets |
| Dashboard live/replay | IMPLEMENTED | IMPLEMENTED | IMPLEMENTED | IMPLEMENTED | NOT_STARTED | Phase 7 dashboards read canonical Match Run events, candidate snapshots, and negotiation resources through Product API |
| Technical Proof | IMPLEMENTED | IMPLEMENTED | IMPLEMENTED | IMPLEMENTED | NOT_STARTED | Phase 7 UI shows sanitized IDs, event sequence, A2A task/context, Agreement state, and data source badge |
| Deployment | N/A | N/A | N/A | N/A | BLOCKED | Phase 11 local QA passed; Cloud Run deploy/live smoke requires explicit approval |

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

## 8. Phase 6 Changes

- Added `backend/libs/a2a/registry.py` for public Creator Agent routing projections.
- Seed and Creator publish/pause write `agentRegistry/{agentId}` entries.
- Product API negotiation start requires registry lookup before A2A send.
- HTTP A2A AgentCard is validated for selected tenant, protocol binding, protocol version, and advertised negotiation skill when present.
- Product API persists ordered `a2aTasks/{taskId}/events` alongside task/message/artifact documents.
- Focused tests verify registry privacy and task event persistence.

## 9. Phase 7 Changes

- Added frontend Product API client methods for:
  - `GET /api/v1/match-runs/{match_run_id}/events`
  - `GET /api/v1/negotiations/{negotiation_id}/events`
- Extended frontend ViewModels with canonical run events, run status, last event time, and sanitized Technical Proof items.
- Brand Dashboard now includes an Agent Control Room card:
  - `탐색·협상 시작` calls Product API only.
  - Candidate cards are rendered from stored candidate snapshots.
  - Replay is rendered from stored Match Run events, not timers.
  - Technical Proof is collapsed by default.
- Creator Dashboard now includes:
  - `제안 받기 ON/OFF` control wired to Creator Agent publish/pause/resume APIs.
  - Recent negotiation replay loaded from the same canonical Match Run event stream.
- Added frontend tests proving API mode reads canonical Match Run event replay and proof through Product API routes.

## 10. Phase 8 Changes

- Added pay.sh/x402 verification policy settings:
  - `PAYSH_QUOTE_AMOUNT_USDC`
  - `PAYSH_MAX_CALL_AMOUNT_USDC`
  - `PAYSH_RUN_SPEND_CAP_USDC`
  - `PAYSH_DAILY_SPEND_CAP_USDC`
  - `PAYSH_ALLOWED_RESOURCE_PREFIXES`
  - `PAYSH_FAILURE_POLICY`
- Match Run paid verification now validates allowlist and configured quote/caps before invoking `pay fetch`.
- pay.sh operations use a deterministic operation ID for the Match Run, selected Creator Agent, resource, and purpose; duplicate idempotent Match Run starts do not call pay.sh twice.
- `paymentOperations` records every pay.sh decision, including disabled/skipped paths.
- `transactionReceipts` records settled/failed pay.sh attempts with `paymentType: PAYSH_X402` and `network: pay.sh:{mode}`; no blockchain signature is fabricated.
- `API_PAYMENT` timeline data now carries quote, spend cap, result digest, score impact metadata, receipt ID, external receipt ID, and continuation policy.
- No real pay.sh call was executed in this environment; `tests/test_paysh_sandbox.py` skipped because the configured sandbox prerequisites were unavailable.

## 11. Phase 9 Changes

- `build_initial_terms` now creates the MVP settlement schedule:
  - one `content` milestone;
  - `trigger: contentLiveVerified`;
  - `releasePct: 100`.
- Agreement creation recomputes canonical `termsHash` and rejects A2A Artifact hash mismatch with `TERMS_HASH_MISMATCH`.
- Agreement documents now store `hashAlgorithm: sha256` and `hashVersion: knot.agreement-terms.v1`.
- Agreement milestone subdocuments are written from the canonical one-milestone terms.
- Escrow release idempotency now checks an existing settlement before rejecting a completed aggregate, so duplicate release requests with the same key return the original receipt.
- Frontend fixture milestone UI was updated away from legacy 30/70 examples.
- Web3 Gateway build/unit/lint passed. No live devnet transaction was submitted in this phase.

## 12. Phase 10 Changes

- Evidence submission now requires a funded Agreement escrow with `status: LOCKED` and a confirmed `lockSignature`.
- Evidence submitter authorization is checked before escrow state and source URL validation.
- Evidence source URLs are normalized through the external-https URL guard and stored with a `sha256:` `sourceDigest`.
- Duplicate evidence submissions for the same Agreement milestone are rejected with `EVIDENCE_ALREADY_SUBMITTED`.
- Evidence verification persists a separate `verificationResults/{id}` document with provider, observations, policy decision, status, and source digest.
- Settlement release now requires a passed evidence document and stores `evidenceId` plus `sourceDigest` on the settlement, released milestone, and `MILESTONE_RELEASED` timeline event.
- Failed evidence remains persisted but does not authorize release or create a settlement.
- No live devnet release transaction was submitted in this phase because on-chain actions require explicit approval.

## 13. Phase 11 Changes

- Final local QA matrix was run across backend, frontend, and Web3 Gateway.
- A tracked-file secret pattern scan found no matches for the configured high-risk token/key patterns.
- No Cloud Run deployment, IAM/Secret change, wallet funding, program deployment, or on-chain transaction was executed.
- No final live two-window E2E was claimed because deployment and devnet signatures remain approval-gated.
- README was not edited in this phase because it already has unrelated local changes outside this phase.

## 14. Query-Bound Proof

```text
Discovery implementation: CreatorDiscoveryRepository over creatorDiscoveryProfiles
Public hard-filter query: agentStatus, acceptingOffers, availability, capacityAvailable, countryCode, categoryKeys, primaryFormatKey, nextAvailableAt
Vector index: not implemented or deployed yet; semantic fit is deterministic neutral value
Top K: discovery limit 100 enforced by interface
Maximum detailed profile reads: Top 20 enforced by detail_candidates()
Maximum paid tool calls: one selected creator path in the current synchronous MVP, with configured per-call/per-run/daily caps and idempotent operation reuse
Test proving no unbounded scan: test_run_match_uses_indexed_discovery_without_creator_profile_scan
```

## 15. Test Evidence

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
| Phase 6 backend focused tests | VERIFIED: 38 passed, 1 warning | working tree | 2026-07-31 | `../.venv/bin/python -m pytest tests/test_api_promotions.py tests/test_api_dashboards.py tests/test_api_a2a_http_integration.py tests/test_a2a_negotiation.py` from `backend` |
| Phase 6 backend full pytest | VERIFIED: 108 passed, 5 skipped, 2 warnings | working tree | 2026-07-31 | `../.venv/bin/python -m pytest` from `backend` |
| Phase 6 backend ruff | VERIFIED: all checks passed | working tree | 2026-07-31 | `../.venv/bin/python -m ruff check .` from `backend` |
| Phase 6 backend mypy | VERIFIED: no issues in 50 source files | working tree | 2026-07-31 | `../.venv/bin/python -m mypy` from `backend` |
| Phase 6 frontend typecheck | VERIFIED | working tree | 2026-07-31 | `npm run typecheck` from `frontend` |
| Phase 6 frontend lint | VERIFIED | working tree | 2026-07-31 | `npm run lint` from `frontend` |
| Phase 6 frontend unit | VERIFIED: 18 passed | working tree | 2026-07-31 | `npm test` from `frontend` |
| Phase 6 frontend build | VERIFIED | working tree | 2026-07-31 | `npm run build` from `frontend` |
| Phase 7 frontend typecheck | VERIFIED | working tree | 2026-07-31 | `npm run typecheck` from `frontend` |
| Phase 7 frontend lint | VERIFIED | working tree | 2026-07-31 | `npm run lint` from `frontend` |
| Phase 7 frontend unit | VERIFIED: 19 passed | working tree | 2026-07-31 | `npm test` from `frontend` |
| Phase 7 frontend build | VERIFIED | working tree | 2026-07-31 | `npm run build` from `frontend` |
| Phase 8 backend focused tests | VERIFIED: 35 passed, 1 warning | working tree | 2026-07-31 | `../.venv/bin/python -m pytest tests/test_api_promotions.py tests/test_api_escrow.py` from `backend` |
| Phase 8 backend full pytest | VERIFIED: 111 passed, 5 skipped, 2 warnings | working tree | 2026-07-31 | `../.venv/bin/python -m pytest` from `backend` |
| Phase 8 backend ruff | VERIFIED: all checks passed | working tree | 2026-07-31 | `../.venv/bin/python -m ruff check .` from `backend` |
| Phase 8 backend mypy | VERIFIED: no issues in 50 source files | working tree | 2026-07-31 | `../.venv/bin/python -m mypy` from `backend` |
| Phase 8 pay.sh sandbox smoke | SKIPPED | working tree | 2026-07-31 | `../.venv/bin/python -m pytest tests/test_paysh_sandbox.py` from `backend`: 1 skipped |
| Phase 8 frontend typecheck | VERIFIED | working tree | 2026-07-31 | `npm run typecheck` from `frontend` |
| Phase 8 frontend lint | VERIFIED | working tree | 2026-07-31 | `npm run lint` from `frontend` |
| Phase 8 frontend unit | VERIFIED: 19 passed | working tree | 2026-07-31 | `npm test` from `frontend` |
| Phase 8 frontend build | VERIFIED | working tree | 2026-07-31 | `npm run build` from `frontend` |
| Phase 9 backend focused tests | VERIFIED: 52 passed, 1 warning | working tree | 2026-07-31 | `../.venv/bin/python -m pytest tests/test_api_promotions.py tests/test_api_escrow.py tests/test_a2a_negotiation.py tests/test_domain_models.py` from `backend` |
| Phase 9 backend full pytest | VERIFIED: 112 passed, 5 skipped, 2 warnings | working tree | 2026-07-31 | `../.venv/bin/python -m pytest` from `backend` |
| Phase 9 backend ruff | VERIFIED: all checks passed | working tree | 2026-07-31 | `../.venv/bin/python -m ruff check .` from `backend` |
| Phase 9 backend mypy | VERIFIED: no issues in 50 source files | working tree | 2026-07-31 | `../.venv/bin/python -m mypy` from `backend` |
| Phase 9 frontend typecheck | VERIFIED | working tree | 2026-07-31 | `npm run typecheck` from `frontend` |
| Phase 9 frontend lint | VERIFIED | working tree | 2026-07-31 | `npm run lint` from `frontend` |
| Phase 9 frontend unit | VERIFIED: 19 passed | working tree | 2026-07-31 | `npm test` from `frontend` |
| Phase 9 frontend build | VERIFIED | working tree | 2026-07-31 | `npm run build` from `frontend` |
| Phase 9 Web3 build | VERIFIED | working tree | 2026-07-31 | `npm run build` from `web3/gateway` |
| Phase 9 Web3 unit | VERIFIED: 9 passed | working tree | 2026-07-31 | `npm test` from `web3/gateway` |
| Phase 9 Web3 lint | VERIFIED | working tree | 2026-07-31 | `npm run lint` from `web3/gateway` |
| Phase 10 backend focused tests | VERIFIED: 40 passed, 2 warnings | working tree | 2026-07-31 | `../.venv/bin/python -m pytest tests/test_api_promotions.py tests/test_api_escrow.py` from `backend` |
| Phase 10 backend full pytest | VERIFIED: 116 passed, 5 skipped, 3 warnings | working tree | 2026-07-31 | `../.venv/bin/python -m pytest` from `backend` |
| Phase 10 backend ruff | VERIFIED: all checks passed | working tree | 2026-07-31 | `../.venv/bin/python -m ruff check .` from `backend` |
| Phase 10 backend mypy | VERIFIED: no issues in 50 source files | working tree | 2026-07-31 | `../.venv/bin/python -m mypy` from `backend` |
| Phase 11 backend full pytest | VERIFIED: 116 passed, 5 skipped, 3 warnings | working tree | 2026-07-31 | `../.venv/bin/python -m pytest` from `backend` |
| Phase 11 backend ruff | VERIFIED: all checks passed | working tree | 2026-07-31 | `../.venv/bin/python -m ruff check .` from `backend` |
| Phase 11 backend mypy | VERIFIED: no issues in 50 source files | working tree | 2026-07-31 | `../.venv/bin/python -m mypy` from `backend` |
| Phase 11 frontend typecheck | VERIFIED | working tree | 2026-07-31 | `npm run typecheck` from `frontend` |
| Phase 11 frontend lint | VERIFIED | working tree | 2026-07-31 | `npm run lint` from `frontend` |
| Phase 11 frontend unit | VERIFIED: 19 passed | working tree | 2026-07-31 | `npm test` from `frontend` |
| Phase 11 frontend build | VERIFIED | working tree | 2026-07-31 | `npm run build` from `frontend` |
| Phase 11 Web3 build | VERIFIED | working tree | 2026-07-31 | `npm run build` from `web3/gateway` |
| Phase 11 Web3 unit | VERIFIED: 9 passed | working tree | 2026-07-31 | `npm test` from `web3/gateway` |
| Phase 11 Web3 lint | VERIFIED | working tree | 2026-07-31 | `npm run lint` from `web3/gateway` |
| Phase 11 tracked-file secret pattern scan | VERIFIED: no matches | working tree | 2026-07-31 | `git grep` over tracked files for high-risk token/key patterns |
| Phase 11 Cloud Run deploy/live smoke | SKIPPED | working tree | 2026-07-31 | Requires explicit approval for deployment/IAM/Secret changes |
| Phase 11 devnet lock/release smoke | SKIPPED | working tree | 2026-07-31 | Requires explicit approval for wallet funding/on-chain transactions |

## 16. Latest Verified E2E

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

No E2E, live pay.sh purchase, or live devnet transaction was executed through Phase 11.

## 17. Known Blockers

```text
BLOCKER: External Match Run worker dispatch is not implemented.
IMPACT: Current run has durable records/events but still completes synchronously in the request.
EVIDENCE: Phase 5 adds canonical events/idempotency/cancel, but no queue or worker claim process is present.
OWNER: Backend/Agent phase.
NEXT ACTION: Add worker dispatch/claim/retry or document synchronous MVP limit before final E2E.
WORKAROUND FOR DEMO (truthfully labeled): Existing synchronous path can be used only as legacy behavior, not final proof.
```

```text
BLOCKER: Reservation and sequential fallback are not implemented.
IMPACT: Candidate conflict/reject/expire does not yet advance through three ranked candidates automatically.
EVIDENCE: Phase 6 hardens selected-candidate A2A only; no reservation lease collection or retry loop exists.
OWNER: Backend/Agent phase.
NEXT ACTION: Add reservation/concurrency or document MVP limitation before final E2E.
WORKAROUND FOR DEMO (truthfully labeled): Current path negotiates one selected Creator Agent.
```

```text
BLOCKER: Firestore rules and vector discovery index are not verified.
IMPACT: Final bounded/vector discovery and security rules cannot be verified yet.
EVIDENCE: Phase 4 uses composite discovery indexes in source, but no firestore.rules or deployed vector index was verified.
OWNER: Backend/Infra phase.
NEXT ACTION: Add rules and managed vector index verification in an infra phase.
WORKAROUND FOR DEMO (truthfully labeled): Emulator/in-memory tests only.
```

```text
BLOCKER: Live devnet escrow release signature is not verified.
IMPACT: Settlement release is verified only through fake-gateway/local tests, not a live Solana devnet transaction.
EVIDENCE: Phase 10 adds evidence-gated release tests but does not submit an on-chain transaction without approval.
OWNER: Web3/Payments phase.
NEXT ACTION: Run an approved devnet lock/release smoke with funded test wallet and record the signature/Explorer URL.
WORKAROUND FOR DEMO (truthfully labeled): Use fake-gateway/local evidence-gated release proof only.
```

## 18. Update Rule

For each phase:

1. audit or plan;
2. implement;
3. run checks;
4. capture evidence/screenshots/IDs;
5. commit;
6. update this file;
7. deploy only from verified commit.
