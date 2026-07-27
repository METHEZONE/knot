# Phase 7 Final E2E And Cleanup

## Goal
Run the final real-data verification pass, remove stale fake-success documentation and active demo naming, and document remaining allowed mocks and external blockers.

## Current Behavior
- Phases 2-6 are implemented and pushed.
- README still described older simulated escrow status.
- Explicit local mock mode remains in frontend for tests/local fixture previews.
- Backend fixtures remain for seed/tests.
- Web3 Gateway keeps simulated mode for gateway boundary tests, but Product API rejects simulated receipts as escrow success.

## In Scope
- Inventory mock/fallback/fake-success strings.
- Remove stale active docs and misleading fixture names.
- Confirm legacy route files redirect only.
- Run full frontend/backend/web3 validation suite.
- Update README, status, handoff, and final evidence.

## Out of Scope
- New product scope.
- Mainnet or real-value transfers.
- Deployment, IAM, Secret Manager, wallet funding, or devnet transactions without safe existing configuration.

## Milestones
- [x] Read Phase 7 instructions and required docs.
- [x] Create Phase 7 ExecPlan.
- [x] Inventory mocks/fallback/fake-success strings.
- [x] Remove stale README and misleading active fixture strings.
- [x] Run final verification suite.
- [x] Review diff.
- [x] Update status and handoff.

## Tests
Planned:

```text
cd backend && ../.venv/bin/python -m ruff check apps libs tests
cd backend && ../.venv/bin/python -m pytest tests
cd web3/gateway && npm run build
cd web3/gateway && npm run lint
cd web3/gateway && npm run test
cd frontend && npm run typecheck
cd frontend && npm run lint
cd frontend && npm run test
cd frontend && npm run build
```

## Rollback
Revert the Phase 7 commit. No external infrastructure action is performed.

## Progress
- [x] Phase 6 pushed as `5d9d04d`.
- [x] ExecPlan created.
- [x] README rewritten for current KNOT v1 status.
- [x] Legacy bootstrap provider string changed from `local-demo` to `legacy-bootstrap`.
- [x] Frontend mock fixture names changed away from Glow Bar/fake signature placeholders.
- [x] Final backend, web3 gateway, and frontend validation suite passed.

## Remaining Allowed Mock Inventory
- `frontend/src/product/mockData.ts`: allowed only when `NEXT_PUBLIC_KNOT_DATA_MODE=mock` is explicitly selected.
- `backend/fixtures/*.json`: backend seed/test fixtures.
- `web3/gateway` simulated mode: allowed for gateway boundary tests only; Product API rejects simulated receipts as successful escrow.
- Gemini fallback display text: allowed as non-authoritative explanation only; deterministic policy still controls decisions.

## External Blockers
- Devnet escrow smoke remains blocked by missing safe existing devnet signer/RPC/program configuration.

## Completion Evidence
Implemented and verified.

Commands:

```text
cd backend && ../.venv/bin/python -m ruff check apps libs tests
cd backend && ../.venv/bin/python -m pytest tests
cd web3/gateway && npm run build
cd web3/gateway && npm run lint
cd web3/gateway && npm run test
cd frontend && npm run typecheck
cd frontend && npm run lint
cd frontend && npm run test
cd frontend && npm run build
```

Results:

- Backend Ruff: passed.
- Backend full pytest: 91 passed, 5 skipped, 1 Starlette/httpx deprecation warning.
- Web3 Gateway build: passed.
- Web3 Gateway lint: passed.
- Web3 Gateway tests: 9 passed, 1 Node `punycode` deprecation warning.
- Frontend typecheck: passed.
- Frontend lint: passed.
- Frontend tests: 12 passed.
- Frontend production build: passed.
