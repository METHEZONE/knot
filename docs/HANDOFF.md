# KNOT Handoff

Last updated: 2026-07-27

## Current Branch

`integration/frontend-backend-api`

## Latest Completed Milestone

Phase 6 Protected Dev Admin from `prompts/06_DEV_ADMIN.md`.

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

Phase 5 completed with external blocker:

- Product API escrow lock/release now requires `KNOT_WEB3_MODE=gateway`.
- Product API validates that gateway lock/release receipts are `CONFIRMED` and include a non-empty Solana Devnet signature.
- Receipt validation checks Agreement ID, Escrow ID, milestone ID when applicable, amount, mint, program, network, and `termsHash`.
- Missing gateway and simulated/non-confirmed gateway receipts no longer create successful escrow or settlement records.
- Failed gateway execution persists `FAILED` TransactionReceipt and PaymentOperation records.
- Evidence submission and deterministic verification remain required before milestone release.
- Lock and release idempotency remain tested.
- Frontend escrow action copy now states that success requires a confirmed Solana Devnet signature.
- External devnet smoke was not run because safe signing configuration is missing in the current process.

Phase 6 completed:

- Added `KNOT_DEV_ADMIN_ENABLED` and `KNOT_DEV_ADMIN_ALLOWLIST`.
- Backend dev-admin APIs require verified Firebase auth plus `admin: true` custom claim or strict server allowlist.
- Added protected endpoints for overview, user search/detail, disable/enable, deletion dry run, demo-only deletion job, deletion job lookup, commerce, agents, escrows, audit, demo seed, and scoped demo reset.
- Admin mutations write audit events.
- Confirmed receipts, settlements, payment operations, and audit records are retained.
- Frontend `/dev/admin` now reads protected Product API overview using Firebase bearer auth.

## Verification

```text
cd backend && ../.venv/bin/python -m ruff check apps libs tests/test_api_auth.py
cd backend && ../.venv/bin/python -m pytest tests/test_api_auth.py tests/test_health_apps.py tests/test_api_onboarding.py
cd backend && ../.venv/bin/python -m ruff check apps libs tests
cd backend && ../.venv/bin/python -m pytest tests/test_api_auth.py tests/test_api_dashboards.py tests/test_health_apps.py tests/test_api_onboarding.py
cd backend && ../.venv/bin/python -m pytest tests/test_api_auth.py tests/test_api_dashboards.py tests/test_api_resource_routes.py tests/test_health_apps.py
cd backend && ../.venv/bin/python -m pytest tests/test_a2a_negotiation.py tests/test_api_promotions.py tests/test_api_a2a_http_integration.py tests/test_api_resource_routes.py tests/test_health_apps.py
cd backend && ../.venv/bin/python -m pytest tests/test_api_escrow.py tests/test_settlement.py tests/test_domain_models.py tests/test_api_promotions.py tests/test_api_resource_routes.py tests/test_health_apps.py
cd backend && ../.venv/bin/python -m pytest tests/test_api_dev_admin.py tests/test_api_auth.py tests/test_health_apps.py tests/test_api_resource_routes.py
cd web3/gateway && npm run build
cd web3/gateway && npm run lint
cd web3/gateway && npm run test
cd frontend && npm run typecheck
cd frontend && npm run lint
cd frontend && npm run test
cd frontend && npm run build
```

Results:

- Backend Ruff passed.
- Backend selected pytest passed: 39 passed, 1 Starlette/httpx deprecation warning for Phase 5 escrow selection.
- Backend selected pytest passed: 15 passed, 1 Starlette/httpx deprecation warning for Phase 6 dev-admin selection.
- Web3 Gateway build/lint/tests passed: 9 tests passed, 1 Node `punycode` deprecation warning.
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

For escrow lock/release, Product API requires:

```text
KNOT_WEB3_MODE=gateway
WEB3_GATEWAY_BASE_URL=http://localhost:8082
```

The Web3 Gateway must return confirmed Solana Devnet receipts. Local simulated-mode gateway responses are allowed only for gateway boundary tests and are rejected by Product API as escrow success.

External devnet smoke remains blocked until safe existing values are provided to the Web3 Gateway process:

```text
KNOT_WEB3_SIGNING_MODE=devnet
KNOT_ESCROW_PROGRAM_ID=...
KNOT_USDC_MINT=...
SOLANA_RPC_URL=...
KNOT_BRAND_KEYPAIR_JSON=...
KNOT_CREATOR_KEYPAIR_JSON=...
KNOT_AGENT_KEYPAIR_JSON=...
```

For dev admin:

```text
KNOT_DEV_ADMIN_ENABLED=true
KNOT_DEV_ADMIN_ALLOWLIST=admin@example.com
```

Alternatively set Firebase custom claim `admin: true` for the operator account.

## Not Done In This Milestone

- Legacy demo endpoints still exist for compatibility.
- Legacy demo-step route files are redirect-only, but some unused legacy components remain until Phase 7 cleanup.
- Full server-cookie route middleware is not complete; current guards use Firebase client state and `/api/v1/me`.
- Firestore migration/reset was not run.
- No GCP IAM, Secret Manager, deployment, wallet funding, program deployment, or on-chain transaction was performed.
- External devnet escrow smoke is blocked by missing safe signing configuration.
- Final E2E and cleanup is still Phase 7.

## Next Recommended Milestone

Phase 7 should run the full real-data E2E cleanup pass, remove dead active mocks/fixtures, update README and deployment notes, and produce final evidence.
