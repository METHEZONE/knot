# Phase 3 Resource Routes and Real Data

## Goal
Move active frontend flows from demo-step routes to Promotion, Offer, and Agreement resource routes backed by authenticated Product API data.

## Current Behavior
- `/brand` and `/creator` dashboards are authenticated from Phase 2.
- Legacy step routes still render active pages:
  - `/brand/products/new`
  - `/brand/negotiate`
  - `/brand/result`
  - `/brand/settlement`
  - `/creator/result`
  - `/creator/criteria`
  - `/creator/brands/{brandId}`
- Product API has unscoped legacy Promotion and Agreement routes.
- API data source still contains global latest Promotion fallback for legacy pages.

## In Scope
- Add authenticated Product API routes for Brand Promotions and Agreements.
- Add authenticated Product API routes for Creator Offers and Agreements.
- Add frontend resource pages:
  - `/brand/promotions/new`
  - `/brand/promotions/{promotionId}`
  - `/brand/agreements/{agreementId}`
  - `/creator/offers/{negotiationId}`
  - `/creator/agreements/{agreementId}`
- Convert legacy demo-step routes to redirects only.
- Use real resource IDs in links.
- Add ownership/participation checks and 403/404 behavior.
- Preserve current visual system and reusable components.
- Add focused tests.

## Out of Scope
- Real A2A internals.
- Escrow execution changes.
- Dev admin.
- Deleting all legacy components or mock fixtures.
- Deployment or data migration.

## Files and Symbols
- `backend/apps/api/routes.py`: authenticated resource endpoints and authorization helpers.
- `backend/apps/api/schemas.py`: authenticated Promotion create schema.
- `backend/tests/test_api_resource_routes.py`: ownership and resource route tests.
- `frontend/src/product/apiClient.ts`: resource API types and methods.
- `frontend/src/product/ProductScreens.tsx`: resource screens.
- `frontend/src/app/brand/promotions/new/page.tsx`
- `frontend/src/app/brand/promotions/[promotionId]/page.tsx`
- `frontend/src/app/brand/agreements/[agreementId]/page.tsx`
- `frontend/src/app/creator/offers/[negotiationId]/page.tsx`
- `frontend/src/app/creator/agreements/[agreementId]/page.tsx`
- Legacy route page files changed to redirects.
- `frontend/tests/product-flow.test.ts`: route and API-client tests.
- `docs/IMPLEMENTATION_STATUS.md`, `docs/HANDOFF.md`.

## Data Migration
No migration.

Authenticated Promotion creation writes `ownerUid`, `brandId`, and `brandAgentId` from the verified user context.

Existing Agreement/Negotiation documents are read when they match the authenticated Brand or Creator participation fields.

## API Changes
- Add `GET /api/v1/brand/promotions`.
- Add `POST /api/v1/brand/promotions`.
- Add `GET /api/v1/brand/promotions/{promotionId}`.
- Add `GET /api/v1/brand/promotions/{promotionId}/activity`.
- Add `GET /api/v1/brand/agreements`.
- Add `GET /api/v1/brand/agreements/{agreementId}`.
- Add `GET /api/v1/creator/offers`.
- Add `GET /api/v1/creator/offers/{negotiationId}`.
- Add `GET /api/v1/creator/agreements`.
- Add `GET /api/v1/creator/agreements/{agreementId}`.

## UI Changes
- Resource routes become primary active pages.
- Legacy demo-step routes redirect to role dashboard or equivalent resource root.
- Resource pages display loading, empty, forbidden, not-found, and retryable error states.

## Security Considerations
- Resource reads derive identity from verified Firebase token.
- Browser cannot supply `brandId`, `creatorId`, or ownership.
- Creator private policy remains hidden.
- No fake signatures or fake termsHash are introduced.

## Milestones
- [x] Read Phase 3 instructions and required docs.
- [x] Create Phase 3 ExecPlan.
- [x] Implement authenticated resource API routes.
- [x] Implement frontend resource pages and legacy redirects.
- [x] Add/update tests.
- [x] Run phase tests.
- [x] Review diff.
- [x] Update status and handoff.

## Tests
Planned:

```text
cd backend && ../.venv/bin/python -m ruff check apps libs tests
cd backend && ../.venv/bin/python -m pytest tests/test_api_auth.py tests/test_api_dashboards.py tests/test_api_resource_routes.py tests/test_health_apps.py
cd frontend && npm run typecheck
cd frontend && npm run lint
cd frontend && npm run test
cd frontend && npm run build
```

## Rollback
Revert the Phase 3 commit. No deployment or destructive data work is performed.

## Progress
- [x] Phase 2 pushed as `a5153d4`.
- [x] ExecPlan created.
- [x] Authenticated Brand Promotion create/list/detail/activity endpoints added.
- [x] Authenticated Brand Agreement list/detail endpoints added.
- [x] Authenticated Creator Offer and Agreement resource endpoints added.
- [x] Frontend resource pages added.
- [x] Legacy demo-step routes changed to redirects.
- [x] Backend ownership tests added.
- [x] Frontend resource API tests added.

## Decisions
- Use thin resource projections in Product API rather than changing A2A/escrow internals in this phase.
- Keep legacy components in `ProductScreens.tsx` until Phase 7 cleanup, but stop active routes from rendering them.

## Risks
- Some old documents may lack `brandId`/`creatorId`; these are intentionally excluded unless participation can be proven.

## Completion Evidence
Implemented and verified.

Commands:

```text
cd backend && ../.venv/bin/python -m ruff check apps libs tests
cd backend && ../.venv/bin/python -m pytest tests/test_api_auth.py tests/test_api_dashboards.py tests/test_api_resource_routes.py tests/test_health_apps.py
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
- Frontend tests: 12 passed.
- Frontend production build: passed.

Evidence:

- `tests/test_api_resource_routes.py` verifies multiple Brand Promotions remain independently addressable and cross-Brand access is rejected.
- `tests/test_api_resource_routes.py` verifies Creator Offer and Agreement access is scoped by Creator Agent participation.
- `frontend/tests/product-flow.test.ts` verifies Product API client uses resource routes for Promotion, Offer, and Agreement reads.
- Legacy route files now redirect instead of rendering the previous demo-step implementations.
