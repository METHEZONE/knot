# Phase 5 - Durable Match Run Orchestration Surface

## Goal

Add durable Match Run API/state surfaces that survive refresh and can be replayed, while preserving the existing synchronous compatibility behavior until the worker phase is split out.

## Current Behavior

- Phase 4 Match Run start uses bounded discovery and deterministic ranking.
- The request still completes the run synchronously for compatibility.
- Timeline aliases previously projected only Promotion events.

## In Scope

- Canonical `matchRuns/{runId}/events` subcollection path.
- Match Run state history and canonical state transition events.
- Idempotent Match Run start replay through `Idempotency-Key`.
- One active run guard per Promotion for non-terminal runs.
- `POST /api/v1/match-runs/{match_run_id}:cancel`.
- Firestore index source config for active Match Run lookup.
- Focused API/path tests.

## Out of Scope

- External queue/Cloud Run worker deployment.
- Browser-closure asynchronous worker execution.
- Reservation leases and candidate retry/fallback.
- A2A retry/reconciliation changes.
- Any deployment or live data migration.

## Files and Symbols

- `backend/apps/api/routes.py`
- `backend/libs/repositories/firestore_paths.py`
- `backend/tests/test_api_promotions.py`
- `backend/tests/test_firestore_repositories.py`
- `firestore.indexes.json`
- `docs/API_COMPATIBILITY_MATRIX.md`
- `docs/FIRESTORE_MIGRATION_PLAN.md`
- `docs/IMPLEMENTATION_STATUS.md`

## API Changes

- `POST /api/v1/match-runs/{match_run_id}:cancel`
- `GET /api/v1/match-runs/{match_run_id}/timeline`
- `GET /api/v1/match-runs/{match_run_id}/events`

Start routes now accept optional `Idempotency-Key`:

- `POST /api/v1/promotions/{promotion_id}/matches:run`
- `POST /api/v1/promotions/{promotion_id}/match-runs`

## Data Changes

- `matchRuns/{runId}/events/{eventId}` canonical events.
- `matchRuns/{runId}.stateHistory`.
- `matchRuns/{runId}.idempotencyKey` when provided.

## Security Considerations

- Idempotency conflicts use existing payload hash conflict handling.
- Terminal Match Runs cannot be canceled.
- No client-created success event path was added.

## Milestones

- [x] Add Match Run event path helper.
- [x] Add canonical Match Run events.
- [x] Add idempotent duplicate start replay.
- [x] Add cancel endpoint and terminal guard.
- [x] Add focused tests.
- [x] Run full phase checks.
- [x] Commit and push.

## Tests

Planned:

- `cd backend && ../.venv/bin/python -m pytest tests/test_api_promotions.py tests/test_firestore_repositories.py`
- `cd backend && ../.venv/bin/python -m pytest`
- `cd backend && ../.venv/bin/python -m ruff check .`
- `cd backend && ../.venv/bin/python -m mypy`
- `cd frontend && npm run typecheck`
- `cd frontend && npm run lint`
- `cd frontend && npm test`
- `cd frontend && npm run build`
- `.venv/bin/python -m json.tool firestore.indexes.json`

## Rollback

Revert the Phase 5 commit. New event documents and fields are additive.

## Progress

- [x] Focused backend tests passed: `27 passed, 1 warning`.
- [x] Backend ruff passed.
- [x] Backend mypy passed.

## Decisions

- Preserve 201 compatibility for Match Run start routes even when an idempotent replay returns an existing run.
- Record canonical events immediately in the Product API as a safe adapter until a real worker claims runs.

## Risks

- Match Run still completes synchronously. Browser-closure-safe worker execution remains pending.
- Candidate retry/fallback and reservation leases remain pending.

## Completion Evidence

- `backend`: focused Match Run tests passed, `27 passed, 1 warning`.
- `backend`: full pytest passed, `108 passed, 5 skipped, 2 warnings`.
- `backend`: ruff passed.
- `backend`: mypy passed.
- `frontend`: typecheck passed.
- `frontend`: lint passed.
- `frontend`: unit tests passed, `18 passed`.
- `frontend`: production build passed.
- `firestore.indexes.json`: valid JSON.
