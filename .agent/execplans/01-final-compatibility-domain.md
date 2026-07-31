# Phase 1 - Final Compatibility and Domain Baseline

## Goal

Adopt the final KNOT product baseline without breaking the current working API, A2A, Web3, auth, or visual surface. Phase 1 is limited to documentation installation/audit, canonical terminology, compatibility aliases, and tests proving existing behavior still works.

## Current Behavior

- Current branch: `feat/final-agentic-matching-flow`.
- Stable backend/API/Web3 candidate: `origin/main` at `e58aa9b9b13b2776962bfe0f56a38d44acfd0940`.
- UI reference: `origin/feat/two-user-session` at `263c9d3859c5979c51b418542e953637339e6583`.
- Current local HEAD before this phase: `65e55230c5d2076bae67aef70df7345e40df8674`.
- Product API has FastAPI routes under `/api/v1`.
- Current matching route `/api/v1/promotions/{promotion_id}/matches:run` is synchronous and writes `COMPLETED`.
- Current matching reads all creator profiles through `repository.list_creator_profiles()`.
- A2A crosses an HTTP boundary when configured, but Creator Agent task storage defaults to in-memory.
- Web3 Gateway has `simulated` and `devnet` signing modes; backend tests prevent simulated receipts from being reported as successful locks.

## In Scope

- Update active repository instructions from v2 to final spec references.
- Create required audit artifacts.
- Add canonical final status enums and usage-right compatibility helpers.
- Add Firestore path constants for final canonical collections.
- Add additive Product API route aliases for canonical Match Run naming.
- Add focused backend compatibility tests.

## Out of Scope

- Durable worker orchestration.
- New discovery index implementation.
- Card-deck live onboarding.
- A2A protocol replacement.
- Devnet transactions, deployment, IAM, Secret Manager, or wallet funding.

## Files and Symbols

- `AGENTS.md`
- `docs/INTEGRATION_AUDIT.md`
- `docs/API_COMPATIBILITY_MATRIX.md`
- `docs/FIRESTORE_MIGRATION_PLAN.md`
- `docs/IMPLEMENTATION_STATUS.md`
- `PLANS.md`
- `backend/libs/domain/models.py`
- `backend/libs/repositories/firestore_paths.py`
- `backend/apps/api/routes.py`
- `backend/tests/test_domain_models.py`
- `backend/tests/test_api_promotions.py`

## Data Migration

No data migration is executed in this phase. Additive Firestore path constants are introduced only for future migration/backfill phases.

## API Changes

- Add `POST /api/v1/promotions/{promotion_id}/match-runs` as an alias for the existing `matches:run` operation.
- Add `GET /api/v1/match-runs/{match_run_id}/timeline`.
- Add `GET /api/v1/match-runs/{match_run_id}/events` as a timeline-compatible alias.

Existing routes remain unchanged.

## UI Changes

None.

## Security Considerations

- No private policy, prompt, credential, or signing material is added to source or docs.
- New aliases reuse existing behavior and do not widen access beyond the current unauthenticated legacy matching routes.
- Prompt file `prompts/CODEX_IMPLEMENT_FINAL_KNOT.md` is reference-only and must not be added to git.

## Milestones

- [x] Read final docs/index/prompt.
- [x] Run required git audit commands.
- [x] Inventory current routes, packages, collections, mocks, A2A, Web3.
- [x] Add canonical enums/path constants and API aliases.
- [x] Run Phase 1 checks.
- [x] Update implementation status with test evidence.
- [ ] Review diff and stop before Phase 2.

## Tests

Planned:

- `cd backend && python -m pytest tests/test_domain_models.py tests/test_api_promotions.py`
- `cd backend && python -m pytest`
- `cd frontend && npm run typecheck`
- `cd frontend && npm run lint`
- `cd frontend && npm test`
- `cd frontend && npm run build`
- `cd web3/gateway && npm run build`
- `cd web3/gateway && npm test`

## Rollback

Revert this phase commit. Because schema changes are additive constants only and no migration runs, rollback does not require data changes.

## Progress

- [x] Branch created.
- [x] Final docs inspected.
- [x] Current behavior audited.
- [x] Compatibility code patched.
- [x] Audit documents written.
- [x] Phase 1 checks passed.

## Decisions

- Treat `origin/main` as the stable backend/API/Web3 base because it contains the latest merged wallet top-up, devnet escrow, settlement, and deployment work.
- Treat `origin/feat/two-user-session` as UI reference per repository instructions.
- Keep legacy lower-camel `UsageRights` storage values in Phase 1 and provide canonical-code helpers instead of rewriting persisted values.

## Risks

- Existing synchronous matching and unbounded creator profile listing conflict with the final discovery/worker requirements.
- No Firestore index configuration file is currently present outside docs.
- Current route aliases intentionally preserve legacy behavior until Phase 5 changes run semantics.

## Completion Evidence

- `backend`: focused tests passed, `20 passed, 1 warning`.
- `backend`: full pytest passed, `97 passed, 5 skipped, 1 warning`.
- `backend`: ruff passed.
- `backend`: mypy passed.
- `frontend`: typecheck passed.
- `frontend`: lint passed.
- `frontend`: unit tests passed, `18 passed`.
- `frontend`: production build passed.
- `web3/gateway`: TypeScript build passed.
- `web3/gateway`: unit tests passed, `9 passed`.
- `web3/gateway`: lint passed.
