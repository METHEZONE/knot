# Phase 6 Protected Dev Admin

## Goal
Add a protected `/dev/admin` Product API and frontend route for development diagnostics and safe demo-only account/data operations.

## Current Behavior
- `/dev/admin` frontend renders a diagnostic status panel.
- Backend has no `/api/v1/dev-admin` endpoints.
- Firebase Auth verifies identity but does not expose custom claims to route handlers.
- No admin allowlist or dev-admin feature flag exists.

## In Scope
- Add backend-enforced dev-admin authorization using Firebase custom claim `admin: true` or strict server allowlist.
- Add read-only overview, user search/detail, commerce, agents, escrow, and audit endpoints.
- Add disable/enable user status actions.
- Add deletion dry run and idempotent demo-only deletion job.
- Preserve financial records, confirmed receipts, settlement records, and audit records.
- Add scoped demo seed/reset using `seedBatchId` / `environment=demo`.
- Update frontend dev admin route to read Product API admin overview.
- Add focused tests for non-admin rejection, admin success, dry run, deletion job, retention, audit, and scoped reset.

## Out of Scope
- Arbitrary status editing.
- Global collection deletion.
- Deleting real or unknown users.
- Firebase user deletion outside an explicitly safe disposable demo path.
- Production deployment or IAM changes.

## Files and Symbols
- `backend/libs/auth/firebase.py`: custom claims on authenticated user.
- `backend/libs/settings/config.py`: dev-admin enabled flag and allowlist.
- `backend/apps/api/routes.py`: `/api/v1/dev-admin/*` endpoints.
- `backend/tests/test_api_dev_admin.py`: authorization and safe-operation tests.
- `frontend/src/product/apiClient.ts`, `frontend/src/product/dataSource.ts`, `frontend/src/product/ProductScreens.tsx`: admin overview projection.
- `docs/IMPLEMENTATION_STATUS.md`, `docs/HANDOFF.md`.

## Data Migration
No migration.

Deletion jobs only affect disposable demo-tagged documents and preserve retained financial/audit records.

## Security Considerations
- Every dev-admin API requires verified auth and admin claim or allowlist.
- `KNOT_DEV_ADMIN_ENABLED` must be true.
- Private policy values are not shown by default.
- All admin mutations write audit events.
- Demo reset never deletes global collections.

## Milestones
- [x] Read Phase 6 instructions and required docs.
- [x] Create Phase 6 ExecPlan.
- [x] Add admin auth primitives.
- [x] Add dev-admin API endpoints.
- [x] Update frontend admin overview.
- [x] Add/update tests.
- [x] Run phase tests.
- [x] Review diff.
- [x] Update status and handoff.

## Tests
Planned:

```text
cd backend && ../.venv/bin/python -m ruff check apps libs tests
cd backend && ../.venv/bin/python -m pytest tests/test_api_dev_admin.py tests/test_api_auth.py tests/test_health_apps.py
cd frontend && npm run typecheck
cd frontend && npm run lint
cd frontend && npm run test
cd frontend && npm run build
```

## Rollback
Revert the Phase 6 commit. No production deployment, IAM, or real-user deletion is performed.

## Progress
- [x] Phase 5 pushed as `a18eb50`.
- [x] ExecPlan created.
- [x] `AuthenticatedUser` now preserves token claims for admin authorization.
- [x] `KNOT_DEV_ADMIN_ENABLED` and `KNOT_DEV_ADMIN_ALLOWLIST` settings added.
- [x] Protected `/api/v1/dev-admin/*` endpoints added.
- [x] User search/detail, disable/enable, dry-run deletion, demo-only confirmed deletion, deletion job lookup, commerce/agents/escrow/audit projections, demo seed, and scoped demo reset added.
- [x] Frontend `/dev/admin` now calls protected Product API overview with Firebase bearer auth instead of server-side fixture loading.
- [x] Non-admin rejection, allowlist access, disable/enable audit, dry run, real-user deletion block, demo deletion retention, and scoped reset tests added.

## Risks
- Firebase Admin SDK user disable/delete side effects are not executed in automated tests; tests use emulator-mode tokens and Firestore state transitions.

## Completion Evidence
Implemented and verified.

Commands:

```text
cd backend && ../.venv/bin/python -m ruff check apps libs tests
cd backend && ../.venv/bin/python -m pytest tests/test_api_dev_admin.py tests/test_api_auth.py tests/test_health_apps.py tests/test_api_resource_routes.py
cd frontend && npm run typecheck
cd frontend && npm run lint
cd frontend && npm run test
cd frontend && npm run build
```

Results:

- Backend Ruff: passed.
- Backend selected pytest: 15 passed, 1 Starlette/httpx deprecation warning.
- Frontend typecheck: passed.
- Frontend lint: passed.
- Frontend tests: 12 passed.
- Frontend production build: passed.

Evidence:

- `tests/test_api_dev_admin.py` verifies non-admin rejection, disabled feature rejection, allowlist access, user list/detail, disable/enable audit events, deletion dry-run, real-user deletion block, demo-only deletion, financial receipt retention, demo seed, and scoped reset.
