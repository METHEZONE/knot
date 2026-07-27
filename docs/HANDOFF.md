# KNOT Handoff

Last updated: 2026-07-27

## Current Branch

`integration/frontend-backend-api`

## Latest Completed Milestone

Phase 3 Resource Routes and Real Data from `prompts/03_RESOURCE_ROUTES_AND_REAL_DATA.md`.

Previously completed Auth foundation:

- Firebase client auth helpers added for email/password and Google sign-in.
- Backend Firebase ID token verification added.
- Explicit backend auth modes:
  - `KNOT_AUTH_MODE=firebase`
  - `KNOT_AUTH_MODE=emulator`
- Product API current-user endpoints added:
  - `GET /api/v1/me`
  - `POST /api/v1/me/role`
  - `POST /api/v1/me/brand-profile`
  - `POST /api/v1/me/creator-profile`
  - `POST /api/v1/logout/revoke`
- First verified request creates or updates `users/{uid}`.
- New Brand/Creator profile endpoints write `ownerUid`.
- Frontend login/signup no longer use local-demo accounts.
- API client forwards Firebase bearer token.
- Next proxy forwards `Authorization`.

Phase 2 completed:

- Brand onboarding is one compact page with only stable profile fields.
- Creator onboarding is one compact page with public profile plus basic private Agent criteria.
- Category multi-select and custom category input persist through Product API.
- Completed Brand users go to `/brand`.
- Completed Creator users go to `/creator`.
- `/brand` and `/creator` are authenticated real-data dashboards.
- Added Product API dashboard endpoints:
  - `GET /api/v1/brand/dashboard`
  - `GET /api/v1/creator/dashboard`
- Dashboard data is filtered by authenticated Brand ownership or Creator participation.
- Guarded UI states include loading, unauthenticated, forbidden, not-found, and retryable errors.

Phase 3 completed:

- Added active resource pages:
  - `/brand/promotions/new`
  - `/brand/promotions/{promotionId}`
  - `/brand/agreements/{agreementId}`
  - `/creator/offers/{negotiationId}`
  - `/creator/agreements/{agreementId}`
- Added authenticated Product API resource endpoints for Brand Promotions, Brand Agreements, Creator Offers, and Creator Agreements.
- Promotion creation now uses authenticated Brand context instead of browser-supplied `brandId`.
- Legacy demo-step routes now redirect rather than rendering old flow pages.
- Cross-user Brand Promotion access and Creator participation access are tested.

## Verification

```text
cd backend && ../.venv/bin/python -m ruff check apps libs tests/test_api_auth.py
cd backend && ../.venv/bin/python -m pytest tests/test_api_auth.py tests/test_health_apps.py tests/test_api_onboarding.py
cd backend && ../.venv/bin/python -m ruff check apps libs tests
cd backend && ../.venv/bin/python -m pytest tests/test_api_auth.py tests/test_api_dashboards.py tests/test_health_apps.py tests/test_api_onboarding.py
cd backend && ../.venv/bin/python -m pytest tests/test_api_auth.py tests/test_api_dashboards.py tests/test_api_resource_routes.py tests/test_health_apps.py
cd frontend && npm run typecheck
cd frontend && npm run lint
cd frontend && npm run test
cd frontend && npm run build
```

Results:

- Backend Ruff passed.
- Backend selected pytest passed: 12 passed, 1 Starlette/httpx deprecation warning.
- Frontend typecheck passed.
- Frontend lint passed.
- Frontend tests passed: 12 passed.
- Frontend production build passed.

## Environment Needed For Manual Auth Test

Set real Firebase web app values before testing production-mode login:

```text
KNOT_AUTH_MODE=firebase
FIREBASE_PROJECT_ID=knot-dev-503505
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=knot-dev-503505.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=knot-dev-503505
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

For local Firebase Auth emulator testing, set this explicitly:

```text
KNOT_AUTH_MODE=emulator
NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST=localhost:9099
```

## Not Done In This Milestone

- Real HTTP A2A is not implemented yet.
- Legacy demo endpoints still exist for compatibility.
- Legacy demo-step route files are redirect-only, but some unused legacy components remain until Phase 7 cleanup.
- Full server-cookie route middleware is not complete; current guards use Firebase client state and `/api/v1/me`.
- Firestore migration/reset was not run.
- No GCP IAM, Secret Manager, deployment, wallet funding, program deployment, or on-chain transaction was performed.

## Next Recommended Milestone

Phase 4 should replace local A2A fallback with a real HTTP Creator A2A service boundary and persisted multi-turn negotiation.
