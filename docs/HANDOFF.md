# KNOT Handoff

Last updated: 2026-07-27

## Current Branch

`integration/frontend-backend-api`

## Latest Completed Milestone

Phase 4 Real HTTP A2A from `prompts/04_REAL_A2A.md`.

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

Phase 4 completed:

- Product API discovers the Creator A2A AgentCard before HTTP negotiation.
- Product API sends HTTP A2A requests with `A2A-Version: 1.0`, `application/a2a+json`, and bearer service auth when `KNOT_A2A_SERVICE_TOKEN` is configured.
- Creator A2A message and task APIs enforce the same service token when configured.
- Product API now supports the real multi-turn golden path:
  `OFFER -> Creator COUNTER -> Brand policy evaluation -> Brand ACCEPT -> TASK_STATE_COMPLETED -> Agreement Artifact`.
- The first OFFER has no `taskId`; Creator A2A Service creates the Task.
- ACCEPT uses the same `contextId` and `taskId`.
- Negotiation, Messages, Decisions, A2A Task, A2A Artifact, Agreement, Milestones, and sanitized Promotion Activity are persisted.
- Creator private policy snapshots are redacted in new Negotiation documents.
- HTTP failure remains honest and does not create a fake Agreement.

## Verification

```text
cd backend && ../.venv/bin/python -m ruff check apps libs tests/test_api_auth.py
cd backend && ../.venv/bin/python -m pytest tests/test_api_auth.py tests/test_health_apps.py tests/test_api_onboarding.py
cd backend && ../.venv/bin/python -m ruff check apps libs tests
cd backend && ../.venv/bin/python -m pytest tests/test_api_auth.py tests/test_api_dashboards.py tests/test_health_apps.py tests/test_api_onboarding.py
cd backend && ../.venv/bin/python -m pytest tests/test_api_auth.py tests/test_api_dashboards.py tests/test_api_resource_routes.py tests/test_health_apps.py
cd backend && ../.venv/bin/python -m pytest tests/test_a2a_negotiation.py tests/test_api_promotions.py tests/test_api_a2a_http_integration.py tests/test_api_resource_routes.py tests/test_health_apps.py
cd frontend && npm run typecheck
cd frontend && npm run lint
cd frontend && npm run test
cd frontend && npm run build
```

Results:

- Backend Ruff passed.
- Backend selected pytest passed: 31 passed, 1 Starlette/httpx deprecation warning.
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

For real HTTP A2A testing, run Product API with:

```text
KNOT_CREATOR_A2A_MODE=http
CREATOR_AGENT_BASE_URL=http://localhost:8081/a2a/v1
KNOT_A2A_SERVICE_TOKEN=...
```

Run Creator A2A Service with the same `KNOT_A2A_SERVICE_TOKEN`.

## Not Done In This Milestone

- Legacy demo endpoints still exist for compatibility.
- Legacy demo-step route files are redirect-only, but some unused legacy components remain until Phase 7 cleanup.
- Full server-cookie route middleware is not complete; current guards use Firebase client state and `/api/v1/me`.
- Firestore migration/reset was not run.
- No GCP IAM, Secret Manager, deployment, wallet funding, program deployment, or on-chain transaction was performed.
- Escrow lock/release is still Phase 5.
- Dev Admin backend implementation is still Phase 6.

## Next Recommended Milestone

Phase 5 should implement the Solana devnet escrow lock/release path behind the existing Web3 gateway boundary, with external devnet smoke tests only when safe local configuration already exists.
