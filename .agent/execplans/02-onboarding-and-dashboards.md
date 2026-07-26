# Phase 2 One-page Onboarding and Real Dashboards

## Goal
Implement compact one-page Brand and Creator onboarding and authenticated role dashboards using real Product API and Firestore data.

This phase builds on Phase 1 Auth. It stops before resource-route migration, real A2A, escrow, or dev admin.

## Current Behavior
Pre-change verification:

```text
cd backend && ../.venv/bin/python -m pytest tests/test_api_auth.py
cd frontend && npm run test
cd frontend && npm run typecheck
```

Results:

- Backend auth tests: 5 passed, 1 Starlette/httpx deprecation warning.
- Frontend tests: 10 passed.
- Frontend typecheck: passed.

Observed implementation:

- Auth verifier derives `uid` from Firebase token.
- `GET /api/v1/me` bootstraps `users/{uid}`.
- `/me/role`, `/me/brand-profile`, `/me/creator-profile` use verified UID.
- `/brand` redirects to `/brand/onboarding`.
- `/creator` redirects to `/creator/onboarding`.
- Brand onboarding still has single category input and target audience list shape.
- Creator onboarding and criteria are split across separate pages.
- API mode data source still has global latest Promotion fallback and mock criteria/session projections.
- Dashboard endpoints from `docs/07_API_CONTRACTS.md` do not exist yet.

## In Scope
- Compact one-page Brand onboarding.
- Compact one-page Creator onboarding including basic private Agent criteria.
- Category multi-select plus custom category input.
- Persist Brand and Creator profile data through authenticated Product API.
- Redirect completed Brand users to `/brand`.
- Redirect completed Creator users to `/creator`.
- Add authenticated `GET /api/v1/brand/dashboard`.
- Add authenticated `GET /api/v1/creator/dashboard`.
- Filter dashboard data by authenticated user's `brandId` or `creatorId`.
- Add frontend route guards for role roots and onboarding pages using `/api/v1/me`.
- Build real Brand and Creator dashboard screens with loading, empty, forbidden, not-found, and recoverable error states.
- Add focused backend and frontend tests.
- Update ExecPlan, implementation status, and handoff.

## Out of Scope
- Resource route migration to `/brand/promotions/*` or `/creator/offers/*`.
- Promotion creation changes.
- Real A2A runtime changes.
- Escrow/web3 changes.
- Dev admin.
- Deployment, IAM, secrets, Firestore migration/reset.
- Removing legacy page implementations.

## Files and Symbols
- `backend/apps/api/routes.py`: current-user profile endpoints, dashboard endpoints, ownership helpers.
- `backend/apps/api/schemas.py`: onboarding request schema changes.
- `backend/tests/test_api_auth.py`: auth/profile tests.
- `backend/tests/test_api_dashboards.py`: dashboard ownership tests.
- `frontend/src/product/apiClient.ts`: dashboard types and API methods.
- `frontend/src/auth/AuthGate.tsx`: client account guard component.
- `frontend/src/product/ProductScreens.tsx`: one-page onboarding and dashboard screens.
- `frontend/src/app/brand/page.tsx`: Brand dashboard page.
- `frontend/src/app/creator/page.tsx`: Creator dashboard page.
- `frontend/src/app/brand/onboarding/page.tsx`: guarded Brand onboarding.
- `frontend/src/app/creator/onboarding/page.tsx`: guarded Creator onboarding.
- `frontend/tests/product-flow.test.ts`: route/data/client behavior tests.
- `docs/IMPLEMENTATION_STATUS.md`, `docs/HANDOFF.md`: phase status and handoff.

## Data Migration
No destructive migration.

New writes are additive and use verified UID:

- Brand Profile writes `ownerUid`, `name`, `displayName`, `websiteUrl`, `categories`, `targetAudience`, `description`, `restrictedClaims`, `status`.
- Creator Profile writes `ownerUid`, `displayName`, `socialLinks`, `categories`, `publicRateBand`, `walletAddress`, `receivingOffers`, `status`.
- Creator Agent policy writes private criteria under `agentPolicies/{agentId}`.

Existing legacy documents are tolerated by dashboard readers if they have matching `brandId`/`creatorId`.

## API Changes
- Update `/api/v1/me/brand-profile` to accept `categories` and string `targetAudience`.
- Update `/api/v1/me/creator-profile` to accept `categories`, custom categories, social URL(s), minimum amount, blocked domains, preferred content, and optional wallet address.
- Add `GET /api/v1/brand/dashboard`.
- Add `GET /api/v1/creator/dashboard`.
- Dashboard endpoints require verified token and completed matching role.
- Dashboard queries must not use hardcoded IDs or global latest records.

## UI Changes
- `/brand/onboarding`: one compact page for stable Brand profile only.
- `/creator/onboarding`: one compact page for Creator profile and basic private Agent criteria.
- `/brand`: authenticated Brand dashboard.
- `/creator`: authenticated Creator dashboard.
- Loading/error/empty/forbidden/not-found states use existing panel/button design.
- Completed onboarding redirects to role root.

## Security Considerations
- Browser still cannot assert UID, brandId, creatorId, or ownership.
- Dashboard endpoints derive account from token and user doc.
- Creator private policy is not exposed to Brand dashboard.
- API mode must not convert failures into successful mock data.
- No secrets are added.

## Milestones
- [x] Read Phase 2 instructions and required docs.
- [x] Verify Phase 1 Auth behavior.
- [x] Create Phase 2 ExecPlan.
- [x] Implement backend schema/dashboard changes.
- [x] Implement frontend AuthGate, one-page onboarding, and dashboards.
- [x] Add/update tests.
- [x] Run phase tests.
- [x] Review diff.
- [x] Update status and handoff.

## Tests
Planned:

```text
cd backend && ../.venv/bin/python -m ruff check apps libs tests
cd backend && ../.venv/bin/python -m pytest tests/test_api_auth.py tests/test_api_dashboards.py tests/test_health_apps.py tests/test_api_onboarding.py
cd frontend && npm run typecheck
cd frontend && npm run lint
cd frontend && npm run test
cd frontend && npm run build
```

## Rollback
Rollback Phase 2 files with `git restore` for tracked files and remove newly added test/helper files if needed.

No deployment or data migration is performed.

## Progress
- [x] Baseline Auth and frontend checks passed.
- [x] ExecPlan created.
- [x] Brand onboarding now persists stable profile fields only.
- [x] Creator onboarding now persists public profile plus basic private Agent criteria.
- [x] Category multi-select with custom category input is supported.
- [x] `/brand` and `/creator` render authenticated dashboards instead of redirecting to onboarding.
- [x] Dashboard Product API endpoints added with ownership/participation filters.
- [x] Loading, empty, forbidden, not-found, and recoverable error states added to guarded/dashboard UI.
- [x] Backend dashboard ownership tests added.
- [x] Frontend dashboard API tests added.

## Decisions
- Dashboard endpoints will return bounded, owner-scoped summary projections instead of introducing full resource-route migration.
- Existing legacy routes stay available but should not be used as source of truth for dashboards.
- Category multi-select will persist normalized category slugs and `custom:<value>` entries.

## Risks
- Some legacy documents lack `ownerUid`; dashboard filters should use authenticated `brandId`/`creatorId` from the user account where needed.
- Full route middleware with server cookies is still limited because Phase 1 uses bearer tokens from Firebase client; guards are client-side for this phase.
- Legacy pages may still contain mock-oriented copy until resource-route migration.

## Completion Evidence
Implemented and verified.

Commands:

```text
cd backend && ../.venv/bin/python -m ruff check apps libs tests
cd backend && ../.venv/bin/python -m pytest tests/test_api_auth.py tests/test_api_dashboards.py tests/test_health_apps.py tests/test_api_onboarding.py
cd frontend && npm run typecheck
cd frontend && npm run lint
cd frontend && npm run test
cd frontend && npm run build
```

Results:

- Backend Ruff: passed.
- Backend selected pytest: 12 passed, 1 Starlette/httpx deprecation warning.
- Frontend typecheck: passed.
- Frontend lint: passed.
- Frontend tests: 11 passed.
- Frontend production build: passed.

Persistence evidence:

- `tests/test_api_auth.py` verifies `/me/brand-profile` writes `ownerUid` and links `users/{uid}.brandId`.
- `tests/test_api_dashboards.py` verifies Brand dashboard returns only authenticated Brand Promotions.
- `tests/test_api_dashboards.py` verifies Creator dashboard returns only authenticated Creator Agent offers.
- `tests/test_api_dashboards.py` verifies wrong-role access returns 403 and missing profile returns 404.
