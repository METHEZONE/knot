# KNOT Implementation Status

Last updated: 2026-07-27

## Phase 0 Audit Summary

This status file records the repository audit from `prompts/00_REPOSITORY_AUDIT.md`.
No application code was changed during the audit.

Read:

- `AGENTS.md`
- `PLANS.md`
- `prompts/00_REPOSITORY_AUDIT.md`
- `docs/00_DOCUMENT_INDEX.md`
- `docs/01_PRODUCT_PRD.md`
- `docs/02_SCOPE_AND_GLOSSARY.md`
- `docs/03_INFORMATION_ARCHITECTURE_AND_ROUTES.md`
- `docs/12_MIGRATION_AND_CUTOVER.md`
- `docs/13_TEST_AND_ACCEPTANCE.md`

Created:

- `.agent/execplans/00-reboot-audit.md`
- `docs/IMPLEMENTATION_STATUS.md`

## Phase 1 Auth Summary

Status: `COMPLETED_FOR_APPROVED_MILESTONE`

Implemented from `prompts/01_AUTH_AND_REAL_ACCOUNT.md`:

- Added backend Firebase ID token verification with explicit `KNOT_AUTH_MODE`.
- Added explicit emulator token mode for local/test only.
- Added authenticated current-user endpoints:
  - `GET /api/v1/me`
  - `POST /api/v1/me/role`
  - `POST /api/v1/me/brand-profile`
  - `POST /api/v1/me/creator-profile`
  - `POST /api/v1/logout/revoke`
- First verified `/me` request now idempotently creates or updates `users/{uid}` with schema-version-2 fields.
- Role and profile creation derive identity from the verified Firebase UID; no frontend UID is accepted on the new path.
- Brand and Creator profile creation persist `ownerUid`.
- Frontend login/signup now use Firebase Auth client helpers instead of local demo accounts.
- Frontend API client attaches the current Firebase ID token.
- Next API proxy forwards `Authorization`.
- Firebase client and backend auth env vars were documented in `.env.example` and `backend/.env.example`.

Verification:

```text
cd backend && ../.venv/bin/python -m ruff check apps libs tests/test_api_auth.py
cd backend && ../.venv/bin/python -m pytest tests/test_api_auth.py tests/test_health_apps.py tests/test_api_onboarding.py
cd frontend && npm run typecheck
cd frontend && npm run lint
cd frontend && npm run test
cd frontend && npm run build
```

Results:

- Backend Ruff: passed.
- Backend selected pytest: 9 passed, 1 Starlette/httpx deprecation warning.
- Frontend typecheck: passed.
- Frontend lint: passed.
- Frontend tests: 10 passed.
- Frontend production build: passed.

Remaining after Phase 1:

- Existing legacy `POST /api/v1/users:bootstrap`, `POST /api/v1/brands:onboard`, and `POST /api/v1/creators:onboard` remain for compatibility but are no longer used by the new login/signup/onboarding path.
- Dashboard/resource APIs are not yet ownership-scoped; that belongs to later resource-route phases.
- Existing workspace pages still use some local UI session values for convenience; server authorization is established only for the new current-user endpoints.
- Real Firebase project/web-app config must be supplied through environment variables before local production-mode sign-in works.
- No deployment, IAM, Secret Manager, data migration, or destructive Firestore work was performed.

## Phase 2 Onboarding And Dashboard Summary

Status: `COMPLETED`

Implemented from `prompts/02_ONBOARDING_AND_DASHBOARDS.md`:

- Brand onboarding is now one compact page for stable Brand profile data only.
- Brand onboarding excludes product name, Promotion budget, deliverables, usage rights, and deadline.
- Creator onboarding is now one compact page for Creator profile plus basic private Agent criteria.
- Brand and Creator onboarding support category multi-select plus custom category input.
- Brand and Creator profile writes go through authenticated Product API endpoints and persist `ownerUid`.
- Completed Brand users redirect to `/brand`.
- Completed Creator users redirect to `/creator`.
- `/brand` renders an authenticated Brand dashboard.
- `/creator` renders an authenticated Creator dashboard.
- Added `GET /api/v1/brand/dashboard`.
- Added `GET /api/v1/creator/dashboard`.
- Dashboard API queries are scoped by the authenticated user's Brand ownership or Creator participation.
- Frontend guarded routes use `/api/v1/me` account context and expose loading, unauthenticated, forbidden, not-found, and recoverable error states.
- API mode dashboard reads do not use hardcoded user IDs, global latest records, Glow Bar fixtures, or successful mock fallback.

Verification:

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

Remaining after Phase 2:

- Resource routes are not migrated yet; legacy step routes still exist.
- Promotion creation still belongs to Phase 3.
- Real HTTP A2A, escrow, and dev admin are not implemented in this phase.
- Full server-cookie middleware is not implemented; current route guards are Firebase-client based and call `/api/v1/me`.

## Phase 3 Resource Routes And Real Data Summary

Status: `COMPLETED`

Implemented from `prompts/03_RESOURCE_ROUTES_AND_REAL_DATA.md`:

- Added `/brand/promotions/new`.
- Added `/brand/promotions/{promotionId}`.
- Added `/brand/agreements/{agreementId}`.
- Added `/creator/offers/{negotiationId}`.
- Replaced `/creator/agreements/{agreementId}` with authenticated resource-backed detail.
- Added authenticated Brand Promotion create/list/detail/activity Product API routes.
- Added authenticated Brand Agreement list/detail Product API routes.
- Added authenticated Creator Offer list/detail Product API routes.
- Added authenticated Creator Agreement list/detail Product API routes.
- Promotion fields now belong in Promotion creation rather than Brand onboarding.
- Legacy demo-step routes redirect instead of rendering the old active implementation.
- Removed active Creator brand-detail fixture dependency by redirecting `/creator/brands/{brandId}` to `/creator`.
- Resource APIs use verified Firebase account context and ownership/participation checks.

Verification:

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

Remaining after Phase 3:

- Real HTTP A2A negotiation internals are not implemented yet.
- Agreement creation still depends on the existing local/A2A orchestration path until Phase 4.
- Escrow execution is still Phase 5.
- Some old component code remains unused and will be removed during Phase 7 cleanup.

## Phase 4 Real HTTP A2A Summary

Status: `COMPLETED`

Implemented from `prompts/04_REAL_A2A.md`:

- Product API discovers the Creator A2A AgentCard before HTTP negotiation.
- Product API sends A2A HTTP requests with `A2A-Version: 1.0`, `application/a2a+json`, and bearer service auth when `KNOT_A2A_SERVICE_TOKEN` is configured.
- Creator A2A message and task APIs enforce the same service token when configured.
- Initial Brand OFFER is sent without `taskId`.
- Creator A2A Service creates the Task and returns `taskId`.
- Creator COUNTER responses are evaluated by deterministic Brand policy.
- If Brand policy allows the COUNTER, Product API sends ACCEPT on the same `contextId` and `taskId`.
- Creator completes the Task and returns an Agreement Artifact.
- Product API persists Negotiation, Messages, Decisions, A2A Task, A2A Artifact, Agreement, Milestones, and sanitized Promotion Activity.
- New Negotiation documents redact Creator private policy snapshots instead of persisting raw Creator policy values.
- HTTP failure returns an honest error and does not create a fake Agreement.

Verification:

```text
cd backend && ../.venv/bin/python -m ruff check apps libs tests/test_a2a_negotiation.py tests/test_api_promotions.py tests/test_api_a2a_http_integration.py
cd backend && ../.venv/bin/python -m pytest tests/test_a2a_negotiation.py tests/test_api_promotions.py tests/test_api_a2a_http_integration.py tests/test_api_resource_routes.py tests/test_health_apps.py
cd backend && ../.venv/bin/python -m ruff check apps libs tests
cd frontend && npm run typecheck
cd frontend && npm run lint
cd frontend && npm run test
cd frontend && npm run build
```

Results:

- Backend Ruff: passed.
- Backend selected pytest: 31 passed, 1 Starlette/httpx deprecation warning.
- Frontend typecheck: passed.
- Frontend lint: passed.
- Frontend tests: 12 passed.
- Frontend production build: passed.

Remaining after Phase 4:

- Escrow lock/release remains Phase 5.
- Dev Admin remains Phase 6.
- Legacy mock/dead-code cleanup remains Phase 7.
- `KNOT_CREATOR_A2A_MODE=local` still exists for local tests and development; API mode must use `http` when exercising the real service boundary.

## Phase 5 Devnet Escrow Summary

Status: `COMPLETED_WITH_EXTERNAL_BLOCKERS`

Implemented from `prompts/05_ESCROW.md`:

- Product API escrow lock/release now requires the restricted Web3 Gateway.
- Product API no longer treats missing gateway or simulated/non-confirmed gateway receipts as successful escrow execution.
- Lock success requires a `CONFIRMED` gateway receipt with a non-empty Solana signature.
- Release success requires a `CONFIRMED` gateway receipt with a non-empty Solana signature.
- Product API validates receipt Agreement ID, Escrow ID, milestone ID when applicable, amount, mint, program, network, and `termsHash`.
- Gateway unavailable or invalid receipt failures persist `FAILED` TransactionReceipt and PaymentOperation records.
- Canonical Agreement terms and deterministic `termsHash` remain the lock/release binding.
- Creator evidence submission and deterministic verification remain the release gate.
- Duplicate lock and duplicate release remain idempotent.
- Frontend escrow action copy now states that success requires a confirmed Solana Devnet signature.

Verification:

```text
cd backend && ../.venv/bin/python -m ruff check apps libs tests
cd backend && ../.venv/bin/python -m pytest tests/test_api_escrow.py tests/test_settlement.py tests/test_domain_models.py tests/test_api_promotions.py tests/test_api_resource_routes.py tests/test_health_apps.py
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
- Backend selected pytest: 39 passed, 1 Starlette/httpx deprecation warning.
- Web3 Gateway build: passed.
- Web3 Gateway lint: passed.
- Web3 Gateway tests: 9 passed, 1 Node `punycode` deprecation warning.
- Frontend typecheck: passed.
- Frontend lint: passed.
- Frontend tests: 12 passed.
- Frontend production build: passed.

External blocker:

- Devnet smoke was not run because the current process does not have safe existing devnet signing configuration: `KNOT_WEB3_SIGNING_MODE`, `KNOT_ESCROW_PROGRAM_ID`, `KNOT_USDC_MINT`, `SOLANA_RPC_URL`, `KNOT_BRAND_KEYPAIR_JSON`, `KNOT_CREATOR_KEYPAIR_JSON`, and `KNOT_AGENT_KEYPAIR_JSON` are missing.
- No wallet funding, Secret Manager, IAM, program deployment, or on-chain transaction was performed.

Remaining after Phase 5:

- Dev Admin remains Phase 6.
- Final mock/dead-code cleanup and safe E2E remain Phase 7.
- Web3 Gateway still supports explicit local simulated mode for local boundary tests; Product API rejects that mode as escrow success.

## Phase 6 Protected Dev Admin Summary

Status: `COMPLETED`

Implemented from `prompts/06_DEV_ADMIN.md`:

- Added `KNOT_DEV_ADMIN_ENABLED`.
- Added `KNOT_DEV_ADMIN_ALLOWLIST`.
- Backend dev-admin authorization now requires verified Firebase auth plus `admin: true` custom claim or strict server allowlist.
- Added protected `/api/v1/dev-admin/overview`.
- Added protected user search/detail endpoints.
- Added protected user disable/enable actions with audit events.
- Added deletion dry run.
- Added demo-only confirmed deletion job that redacts disposable demo user projection and preserves financial/audit records.
- Added deletion job lookup.
- Added protected Commerce, Agents & A2A, Escrow, and Audit projections.
- Added scoped demo seed/reset using `seedBatchId` and `environment=demo`.
- Frontend `/dev/admin` now calls the protected Product API overview with Firebase bearer auth.

Verification:

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

Remaining after Phase 6:

- Final E2E and cleanup remains Phase 7.
- Firebase Admin SDK disable/delete calls are not exercised in automated tests; emulator-mode tests verify Firestore state transitions and authorization.

## Phase 7 Final E2E And Cleanup Summary

Status: `COMPLETED_WITH_EXTERNAL_BLOCKERS`

Implemented from `prompts/07_FINAL_E2E_AND_CLEANUP.md`:

- README rewritten for the current KNOT v1 architecture, environment, checks, and deployment notes.
- Removed stale README claim that escrow success is simulated.
- Changed legacy bootstrap `authProvider` label from `local-demo` to `legacy-bootstrap`.
- Removed misleading active mock fixture names and fake devnet signature placeholders from frontend mock data.
- Updated mock-data test IDs after fixture cleanup.
- Updated this implementation status to replace stale Phase 0 audit gaps with current Phase 7 status.
- Confirmed legacy route files remain redirect-only compatibility shims.

Verification:

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

Remaining allowed mock inventory:

- `frontend/src/product/mockData.ts`: allowed only in explicit `NEXT_PUBLIC_KNOT_DATA_MODE=mock`.
- `backend/fixtures/*.json`: seed/test fixtures.
- `web3/gateway` simulated signing mode: allowed only for gateway boundary tests; Product API rejects simulated receipts as escrow success.
- Gemini fallback text: non-authoritative display fallback only; deterministic policy still controls decisions and payments.

External blockers:

- Solana devnet smoke remains blocked by missing safe existing signer/RPC/program configuration.
- No deployment, IAM, Secret Manager, wallet funding, program deployment, mainnet action, or real-value transfer was performed.

## Current Product Gap

Target MVP:

```text
Real authentication
-> one-page role onboarding
-> role dashboard
-> Promotion / Offer
-> real A2A negotiation
-> Agreement
-> Solana devnet Escrow
```

Current implementation is still partially demo-oriented beyond the completed Auth foundation:

- Login/signup use Firebase Auth and `/api/v1/me` for account context.
- Current primary Brand and Creator dashboards and resource pages use authenticated route guards.
- Primary Brand and Creator resource reads are ownership or participation scoped.
- Legacy step pages redirect, but some unused legacy component code remains until Phase 7 cleanup.
- Real A2A HTTP negotiation is implemented and tested through an actual localhost service boundary.
- Escrow lock/release requires confirmed gateway receipts; external devnet smoke is blocked by missing safe signing configuration.
- Dev Admin backend APIs and protected frontend overview are implemented.

## Repository Structure

```text
frontend/                 Next.js app
backend/                  Product API, Creator Agent, shared Python libs
web3/gateway/             TypeScript private transaction gateway
programs/knot-escrow/     Anchor/Rust Solana program
infra/cloudbuild/         Cloud Build configs
scripts/                  deploy, seed, smoke helpers
docs/                     current source-of-truth docs
prompts/                  phase prompts
.agent/execplans/         execution plans
```

## Auth And Session

Status: `ADAPT`

Observed files:

- `frontend/src/product/ProductScreens.tsx`
- `frontend/src/product/apiClient.ts`
- `frontend/src/app/api/v1/[...path]/route.ts`
- `backend/apps/api/routes.py`
- `backend/apps/api/schemas.py`

Phase 1 behavior:

- Frontend login/signup use Firebase Auth email/password and Google sign-in helpers.
- Frontend API calls attach a Firebase ID token via `ProductApiClient`.
- Next proxy forwards the `Authorization` header to Product API.
- Backend verifies ID tokens in `KNOT_AUTH_MODE=firebase`.
- `KNOT_AUTH_MODE=emulator` supports explicit local/test emulator tokens.
- `GET /api/v1/me` creates or updates `users/{uid}` with schema-version-2 account fields.
- `POST /api/v1/me/role` records one role per account and creates a DRAFT Agent shell.
- `POST /api/v1/me/brand-profile` and `/me/creator-profile` create owner-scoped profiles with `ownerUid`.

Current status:

- Primary role guards use Firebase client state and `/api/v1/me`.
- Wrong-role and wrong-owner API 403 behavior is covered for current resource routes.
- Promotion/Offer/Agreement resource reads are ownership or participation scoped.
- Legacy bootstrap remains for compatibility only and is not used by the current login/signup path.

## Routes

Status: `IMPLEMENTED_WITH_LEGACY_REDIRECTS`

Current active routes:

```text
/
/login
/signup
/signup/brand
/signup/creator
/brand
/brand/onboarding
/brand/products/new
/brand/negotiate
/brand/result
/brand/settlement
/brand/me
/brand/settings
/creator
/creator/onboarding
/creator/criteria
/creator/result
/creator/agreements/{agreementId}
/creator/me
/creator/settings
/dev/admin
```

Redirect-only legacy routes also exist:

```text
/brand/matching
/creator/brands/{brandId}
/creator/negotiate
/creator/offers
/creator/milestones
```

Current primary resource routes exist for Brand Promotion, Brand Agreement, Creator Offer, and Creator Agreement. Legacy step pages redirect and are retained only as compatibility shims until final product route polish.

## Frontend Visual System

Status: `KEEP` / `ADAPT`

Keep:

- `frontend/src/app/globals.css`
- `frontend/src/app/layout.tsx`
- `frontend/src/components/AgentCharacter.tsx`
- `frontend/src/components/SquiggleFilters.tsx`
- `frontend/src/lib/agentIdentity.ts`
- `frontend/src/product/apiClient.ts`
- `frontend/src/product/types.ts`

Adapt:

- `frontend/src/components/TopBar.tsx`
- `frontend/src/product/ProductScreens.tsx`
- `frontend/src/product/dataSource.ts`
- `frontend/src/product/flow.ts`
- `frontend/tests/product-flow.test.ts`

Note: `DESIGN.md` is referenced by `AGENTS.md` but was not present in the current tree. The effective visual source is the current CSS/component system.

## Mock, Fixture, Hardcoded, Timer, Fallback Audit

Status: `REVIEWED`

Frontend:

- `frontend/src/product/mockData.ts`: allowed only in explicit `NEXT_PUBLIC_KNOT_DATA_MODE=mock`.
- `frontend/src/product/ProductScreens.tsx`: fallback role session helpers are used only where a page lacks authenticated role context.
- `frontend/src/product/apiClient.ts`: evidence submission helper uses a deterministic test URL only when the user presses the escrow action button; Phase 7 E2E records this as a demo input, not fake success.
- `frontend/src/product/dataSource.ts`: API mode uses Product API resources; remaining mock `roleSessions` / `creatorCriteria` are display defaults for legacy helper views.
- No `setTimeout` or `setInterval` paths were found in `frontend/src`.

Backend:

- `backend/apps/api/repository_factory.py`: memory mode auto-seeds fixtures.
- `backend/apps/api/schemas.py`: `PromotionCreateRequest` defaults to `brand-001` and `brand-agent-001`.
- `backend/libs/settings/config.py`: defaults to memory repository, local A2A, local web3, Gemini off.
- `backend/libs/agents/demo_context.py`: in-memory creator policy contexts.
- `backend/fixtures/*.json`: seed data for users, brands, creators, agents, policies, promotions.
- `backend/apps/api/routes.py`: Gemini explanation/rationale fallbacks are acceptable only as non-authoritative display text.
- `backend/apps/api/routes.py`: Product API now rejects missing/simulated Web3 Gateway receipts as escrow success and persists failures.

Web3:

- `web3/gateway/src/config.ts`: signing defaults to simulated unless `KNOT_WEB3_SIGNING_MODE=devnet`.
- `web3/gateway/src/escrow.ts`: simulated lock/release remains local gateway boundary behavior only; Product API rejects it as successful escrow.

## Firestore Ownership

Status: `IMPLEMENTED_FOR_ACTIVE_RESOURCES`

Current collections/path helpers exist in:

- `backend/libs/repositories/firestore_paths.py`
- `backend/libs/repositories/store.py`
- `backend/libs/repositories/firestore_adapter.py`

Current status:

- Current-user path writes `users/{firebaseUid}` and schema-version-2 fields.
- Brand/Creator profile creation writes `ownerUid`.
- Authenticated Brand Promotion creation derives Brand context server-side.
- Active dashboard/resource APIs enforce ownership or participation.
- Legacy unscoped endpoints remain for compatibility and tests until a later full API cutover.

## A2A

Status: `IMPLEMENTED`

Keep:

- `backend/libs/a2a/models.py`
- `backend/libs/a2a/client.py`
- `backend/apps/creator_agent/main.py`
- A2A Task/Message/Artifact persistence from Product API orchestration.

Current status:

- Product API supports actual HTTP A2A when `KNOT_CREATOR_A2A_MODE=http`.
- HTTP A2A path is tested with AgentCard discovery, service auth, server-created Task, shared `contextId`/`taskId`, COUNTER, Brand ACCEPT, final Artifact, and Agreement creation.
- Local `InMemoryA2ATaskStore` remains explicit test/development mode.
- New negotiation documents redact Creator private policy snapshots.

## Escrow And Web3

Status: `IMPLEMENTED_WITH_EXTERNAL_BLOCKER`

Keep:

- Backend termsHash recomputation before lock.
- Idempotency key requirement.
- Evidence gate before release.
- Gateway client boundary.
- Gateway devnet signing path.
- Anchor program workspace.

Current status:

- Product API requires confirmed Web3 Gateway receipts and non-empty Solana signatures for successful lock/release.
- Gateway simulated mode remains explicit local/test mode only.
- Devnet smoke remains blocked by missing safe signer/RPC/program configuration.

## Dev Admin

Status: `IMPLEMENTED`

Current:

- `/dev/admin` frontend calls protected Product API overview with Firebase bearer auth.
- Backend dev-admin APIs require admin claim or allowlist.
- User list/detail, disable/enable, deletion dry run, demo-only deletion job, scoped seed/reset, audit, commerce, agents, and escrow projections are implemented.
- Confirmed receipts, settlements, payment operations, and audit records are retained.

## Document Status

Current source of truth:

- `docs/00_DOCUMENT_INDEX.md`
- `docs/01_PRODUCT_PRD.md`
- `docs/02_SCOPE_AND_GLOSSARY.md`
- `docs/03_INFORMATION_ARCHITECTURE_AND_ROUTES.md`
- `docs/04_AUTH_ONBOARDING_DASHBOARD.md`
- `docs/05_PAGE_SPEC.md`
- `docs/06_DATA_MODEL.md`
- `docs/07_API_CONTRACTS.md`
- `docs/08_A2A_AGENT_RUNTIME.md`
- `docs/09_ESCROW_AND_SETTLEMENT.md`
- `docs/10_DEV_ADMIN.md`
- `docs/11_SECURITY_AND_AUTHORIZATION.md`
- `docs/12_MIGRATION_AND_CUTOVER.md`
- `docs/13_TEST_AND_ACCEPTANCE.md`
- `docs/14_CODEX_EXECUTION_GUIDE.md`
- `docs/15_TOKEN_BUDGET_STRATEGY.md`

Legacy tracked docs are already deleted in the current working tree and are classified as `ARCHIVE_DOC`. This audit does not restore or move them.

## Verification

Commands run:

```text
cd frontend && npm run test
cd frontend && npm run typecheck
cd backend && ../.venv/bin/python -m pytest tests/test_health_apps.py tests/test_api_onboarding.py tests/test_api_promotions.py tests/test_a2a_negotiation.py tests/test_api_escrow.py
```

Results:

- Frontend tests: 9 passed.
- Frontend typecheck: passed.
- Backend selected tests: 39 passed.
- Warning: Starlette/httpx deprecation warning from FastAPI test client.

## Next Phase

No next reboot phase remains in this plan. Remaining external action is safe Solana devnet smoke once signer/RPC/program configuration is provided and approved.
