# Phase 3 - Creator Agent Publication and Discovery Projection

## Goal

Let Creators explicitly publish, pause, and resume their Agent, and maintain a public discovery projection that can be used by later bounded matching without exposing private policy.

## Current Behavior

- Creator onboarding creates a Creator profile, private Agent policy, and Agent identity.
- Existing dashboards read Creator offers and agreements, but no Creator-controlled publication API exists.
- Matching still reads `creatorProfiles` directly; Phase 4 will replace that path with bounded indexed discovery.
- No Firestore index configuration existed in source before this phase.

## In Scope

- Creator Agent control read/publish/pause/resume API.
- Publication status, accepting-offers state, availability, and capacity fields on new Creator Agents.
- `creatorDiscoveryProfiles/{creatorId}` public projection writes on publish/pause/resume.
- Shared projection builder that excludes exact minimum, blocked policy, raw prompts, credentials, and wallet secrets.
- Dry-run-by-default idempotent backfill script for existing Creator profiles.
- Firestore composite index source file for supported discovery query families.
- Owner/privacy/idempotency tests.

## Out of Scope

- Vector index creation or deployment.
- Bounded discovery repository and ranking changes.
- Frontend visual rewiring of Creator dashboard controls.
- Any live Firestore migration, deployment, or on-chain action.

## Files and Symbols

- `backend/apps/api/routes.py`
- `backend/libs/domain/discovery.py`
- `backend/tests/test_api_dashboards.py`
- `backend/tests/test_creator_discovery.py`
- `frontend/src/product/apiClient.ts`
- `scripts/backfill_creator_discovery_profiles.py`
- `firestore.indexes.json`
- `docs/API_COMPATIBILITY_MATRIX.md`
- `docs/FIRESTORE_MIGRATION_PLAN.md`
- `docs/IMPLEMENTATION_STATUS.md`

## API Changes

- `GET /api/v1/creator/agent`
- `POST /api/v1/creator/agent:publish`
- `POST /api/v1/creator/agent:pause`
- `POST /api/v1/creator/agent:resume`

## Data Changes

New Creator Agent writes include:

- `publicationStatus`
- `acceptingOffers`
- `availability`
- `activeNegotiations`
- `maxConcurrentNegotiations`
- `activeCollaborations`
- `maxActiveCollaborations`

Publishing writes `creatorDiscoveryProfiles/{creatorId}` with public fields only. The backfill script is dry-run unless `--write` is passed.

## Security Considerations

- APIs require authenticated completed `CREATOR` role.
- Agent ownership is verified against the authenticated user and Creator profile.
- Discovery projection excludes exact minimum rate, blocked categories/domains, private notes, raw model output, prompts, credentials, and wallet secrets.
- No browser Firestore writes were added.
- No migration was executed.

## Milestones

- [x] Add shared public projection builder.
- [x] Add Creator Agent control endpoints.
- [x] Add typed frontend API client methods.
- [x] Add dry-run-by-default backfill script.
- [x] Add Firestore composite index source file.
- [x] Add owner/privacy/backfill idempotency tests.
- [x] Run full phase checks.
- [x] Commit and push.

## Tests

Planned:

- `cd backend && ../.venv/bin/python -m pytest tests/test_api_dashboards.py tests/test_creator_discovery.py`
- `cd backend && ../.venv/bin/python -m pytest`
- `cd backend && ../.venv/bin/python -m ruff check .`
- `cd backend && ../.venv/bin/python -m mypy`
- `cd frontend && npm run typecheck`
- `cd frontend && npm run lint`
- `cd frontend && npm test`
- `cd frontend && npm run build`

## Rollback

Revert the Phase 3 commit. New fields and projections are additive, and the backfill script is dry-run by default.

## Progress

- [x] API/control path implemented.
- [x] Projection privacy and ownership tests added.
- [x] Focused backend checks passed.

## Decisions

- Default newly created Creator Agents to `DRAFT` and `acceptingOffers=false`; Creators must explicitly publish before discovery.
- Keep exact minimum rate in private profile/policy and expose only `publicRateBand`.
- Keep vector index deployment as a later verified infra step because no live deployment or index creation was approved.

## Risks

- Matching still does not use `creatorDiscoveryProfiles`; Phase 4 must remove the unbounded `creatorProfiles` discovery path.
- Firestore rules are still not present in source.

## Completion Evidence

- `backend`: focused Creator Agent/discovery tests passed, `7 passed, 1 warning`.
- `backend`: full pytest passed, `103 passed, 5 skipped, 2 warnings`.
- `backend`: ruff passed.
- `backend`: mypy passed.
- `frontend`: typecheck passed.
- `frontend`: lint passed.
- `frontend`: unit tests passed, `18 passed`.
- `frontend`: production build passed.
- `firestore.indexes.json`: valid JSON.
- `scripts/backfill_creator_discovery_profiles.py`: py_compile passed.
