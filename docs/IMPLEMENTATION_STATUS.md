# KNOT Final Implementation Status

> Updated for Phase 1 on 2026-07-31. Do not mark a capability verified without evidence.

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
| Firestore/indexes | IN_PROGRESS | `backend/libs/repositories/firestore_paths.py` | `docs/FIRESTORE_MIGRATION_PLAN.md` | Index config absent; canonical constants added |
| Async worker | NOT_STARTED | none verified | `docs/INTEGRATION_AUDIT.md` | Current Match Run is synchronous |
| Gemini analysis | IN_PROGRESS | `backend/libs/ai/gemini.py` | Audit complete | Final URL analysis flow pending |
| Matching | IN_PROGRESS | `backend/libs/agents/matching.py` | Audit complete | Current matching scans all creator profiles |
| A2A | IN_PROGRESS | `backend/apps/creator_agent`, `backend/libs/a2a` | Audit complete | HTTP boundary exists; durable Creator task store pending |
| Agreement | IN_PROGRESS | `backend/apps/api/routes.py`, `backend/libs/domain/hashing.py` | Audit complete | Final one-milestone shape pending |
| Escrow/release | IN_PROGRESS | `web3/gateway`, `backend/libs/web3` | Audit complete | Devnet path exists; no Phase 1 on-chain action |
| Cloud Run | IN_PROGRESS | `infra/cloudbuild/*.yaml` | Audit complete | No deployment in Phase 1 |

## 2. Capability Matrix

| Capability | UI | API | Firestore | External/A2A/On-chain | E2E | Evidence |
|---|---|---|---|---|---|---|
| Brand card onboarding | IN_PROGRESS | IN_PROGRESS | IN_PROGRESS | NOT_STARTED | NOT_STARTED | Existing profile endpoints; final card persistence pending |
| Creator card onboarding | IN_PROGRESS | IN_PROGRESS | IN_PROGRESS | NOT_STARTED | NOT_STARTED | Existing profile/policy endpoints; final publish flow pending |
| Creator Agent publish/pause | NOT_STARTED | NOT_STARTED | NOT_STARTED | N/A | NOT_STARTED | |
| Discovery projection/index | N/A | NOT_STARTED | IN_PROGRESS | NOT_STARTED | NOT_STARTED | Constants/path helpers added; no projection writes |
| Deterministic ranking | N/A | IN_PROGRESS | IN_PROGRESS | N/A | NOT_STARTED | Existing in-memory ranker |
| Match Run orchestration | IN_PROGRESS | IN_PROGRESS | IN_PROGRESS | NOT_STARTED | NOT_STARTED | Existing synchronous run; canonical aliases added |
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

## 4. Query-Bound Proof

```text
Discovery implementation: current in-memory rank_creators over list_creator_profiles()
Public hard-filter query: not implemented yet
Vector index: not implemented yet
Top K: not enforced yet
Maximum detailed profile reads: not enforced yet
Maximum paid tool calls: current pay.sh operation is one selected creator path, final Top 3 cap pending
Test proving no unbounded scan: not implemented yet
```

## 5. Test Evidence

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

## 6. Latest Verified E2E

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

No E2E or live transaction was executed in Phase 1.

## 7. Known Blockers

```text
BLOCKER: Final durable Match Run is not implemented.
IMPACT: Current run completes synchronously and cannot prove browser-closure-safe orchestration.
EVIDENCE: backend/apps/api/routes.py uses repository.list_creator_profiles() inside matches:run.
OWNER: Backend/Agent phase.
NEXT ACTION: Phase 5 durable orchestration after discovery projection/ranking phases.
WORKAROUND FOR DEMO (truthfully labeled): Existing synchronous path can be used only as legacy behavior, not final proof.
```

```text
BLOCKER: Firestore index/rules files are absent from the audited source tree.
IMPACT: Final bounded/vector discovery and security rules cannot be verified yet.
EVIDENCE: file search found no firestore.indexes.json or firestore.rules outside dependencies.
OWNER: Backend/Infra phase.
NEXT ACTION: Add indexes/rules or document managed configuration in Phase 3/4.
WORKAROUND FOR DEMO (truthfully labeled): Emulator/in-memory tests only.
```

## 8. Update Rule

For each phase:

1. audit or plan;
2. implement;
3. run checks;
4. capture evidence/screenshots/IDs;
5. commit;
6. update this file;
7. deploy only from verified commit.
