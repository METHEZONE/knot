# Phase 4 - Indexed Creator Discovery and Deterministic Ranking

## Goal

Move Match Run discovery off direct `creatorProfiles` collection scans and onto bounded public `creatorDiscoveryProfiles` queries with deterministic ranking and safe candidate snapshots.

## Current Behavior

- Phase 3 publishes Creator Agent state and writes public discovery projections.
- The legacy `rank_creators` function still exists for local/domain tests and helper code.
- Product API `matches:run` was still reading every Creator profile before this phase.

## In Scope

- Add a `CreatorDiscoveryRepository` interface and Firestore-backed implementation.
- Add bounded query primitives to repository stores.
- Query public discovery projections with hard filters and `limit=100`.
- Rank discovered candidates deterministically using public score components.
- Read detailed Creator profiles only for Top 20 candidates for private eligibility checks.
- Store candidate snapshots with exact score components, index/profile versions, and safe explanation facts.
- Seed demo discovery projections explicitly.
- Add no-scan and bounded query tests.

## Out of Scope

- Durable async Match Run state machine.
- Reservation leases and sequential fallback.
- Vector index deployment or live vector retrieval.
- Frontend removal of compatibility manual candidate selection route.
- Any live Firestore migration or index deployment.

## Files and Symbols

- `backend/libs/agents/discovery.py`
- `backend/apps/api/routes.py`
- `backend/libs/repositories/store.py`
- `backend/libs/repositories/firestore_adapter.py`
- `backend/libs/repositories/seed.py`
- `backend/tests/test_api_promotions.py`
- `backend/tests/test_firestore_adapter.py`
- `backend/tests/test_firestore_repositories.py`
- `firestore.indexes.json`
- `docs/API_COMPATIBILITY_MATRIX.md`
- `docs/FIRESTORE_MIGRATION_PLAN.md`
- `docs/IMPLEMENTATION_STATUS.md`
- `docs/INTEGRATION_AUDIT.md`

## API Changes

No new public routes. Existing Match Run start routes now use bounded discovery:

- `POST /api/v1/promotions/{promotion_id}/matches:run`
- `POST /api/v1/promotions/{promotion_id}/match-runs`

## Data Changes

Match Run documents now include discovery metrics:

- `rankingVersion`
- `discoveryLimit`
- `discoveryReturnedCount`
- `detailReadLimit`
- `detailReadCount`

Candidate snapshots now include:

- `scoreComponents`
- `rankingVersion`
- `profileVersion`
- `taxonomyVersion`
- `embeddingVersion`
- `indexVersion`
- `safeExplanationFacts`

## Security Considerations

- Public ranking uses only discovery projection fields.
- Private eligibility reads full Creator profiles only after bounded public retrieval and only for Top 20.
- Candidate snapshots do not expose exact Creator minimum rates or blocked policy.
- No browser Firestore writes were added.

## Milestones

- [x] Add repository query primitive.
- [x] Add Creator discovery repository.
- [x] Connect Product API Match Run start to bounded discovery.
- [x] Add deterministic public score components and tie-breakers.
- [x] Add no-scan tests.
- [x] Run focused checks.
- [x] Run full phase checks.
- [x] Commit and push.

## Tests

Planned:

- `cd backend && ../.venv/bin/python -m pytest tests/test_api_promotions.py tests/test_creator_discovery.py tests/test_firestore_repositories.py tests/test_firestore_adapter.py tests/test_matching.py`
- `cd backend && ../.venv/bin/python -m pytest`
- `cd backend && ../.venv/bin/python -m ruff check .`
- `cd backend && ../.venv/bin/python -m mypy`
- `cd frontend && npm run typecheck`
- `cd frontend && npm test`
- `cd frontend && npm run build`
- `.venv/bin/python -m json.tool firestore.indexes.json`

## Rollback

Revert the Phase 4 commit. Demo seed projections are additive and no live migration/index deployment is executed.

## Progress

- [x] Focused backend tests passed: `30 passed, 1 warning`.
- [x] Backend ruff passed.
- [x] Backend mypy passed.

## Decisions

- Keep legacy `rank_creators` in place for existing helper tests, while Product API uses the new discovery repository.
- Use deterministic neutral semantic fit until real embeddings/vector retrieval are available.
- Use `categoryKeys array_contains` plus `primaryFormatKey` to avoid multiple array filters in the Firestore query family.

## Risks

- Vector Top 100 is represented by bounded indexed retrieval with neutral semantic fit; live vector retrieval remains pending.
- Match Run remains synchronous until Phase 5.

## Completion Evidence

- `backend`: focused discovery/ranking tests passed, `30 passed, 1 warning`.
- `backend`: full pytest passed, `106 passed, 5 skipped, 2 warnings`.
- `backend`: ruff passed.
- `backend`: mypy passed.
- `frontend`: typecheck passed.
- `frontend`: lint passed.
- `frontend`: unit tests passed, `18 passed`.
- `frontend`: production build passed.
- `firestore.indexes.json`: valid JSON.
