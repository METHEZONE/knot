# KNOT Handoff

Last updated: 2026-07-27

## Current Branch

`integration/frontend-backend-api`

## Latest Completed Milestone

Phase 2 One-page Onboarding and Real Dashboards from `prompts/02_ONBOARDING_AND_DASHBOARDS.md`.

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

## Verification

```text
cd backend && ../.venv/bin/python -m ruff check apps libs tests/test_api_auth.py
cd backend && ../.venv/bin/python -m pytest tests/test_api_auth.py tests/test_health_apps.py tests/test_api_onboarding.py
cd backend && ../.venv/bin/python -m ruff check apps libs tests
cd backend && ../.venv/bin/python -m pytest tests/test_api_auth.py tests/test_api_dashboards.py tests/test_health_apps.py tests/test_api_onboarding.py
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
- Frontend tests passed: 11 passed.
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

- Resource-route migration is not done yet.
- Legacy demo endpoints still exist for compatibility.
- Legacy demo-step pages still exist until Phase 3 redirects.
- Full server-cookie route middleware is not complete; current guards use Firebase client state and `/api/v1/me`.
- Firestore migration/reset was not run.
- No GCP IAM, Secret Manager, deployment, wallet funding, program deployment, or on-chain transaction was performed.

## Next Recommended Milestone

Phase 3 should migrate active flows to Promotion and Agreement resource routes with real IDs and ownership checks.
