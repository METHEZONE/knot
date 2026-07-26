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
- Full protected-page route guards are not complete beyond login/signup current-user redirects.
- Business data reads are not ownership scoped.
- Active frontend routes still include legacy step pages.
- Real A2A HTTP code exists, but local/in-memory A2A remains a configured fallback.
- Escrow gateway has devnet code, but current default/demo mode is simulated.
- Dev Admin UI exists as a status panel only; backend admin APIs are missing.

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

Still missing for target:

- Full protected-page route guards.
- Wrong-role and wrong-owner API 403 behavior.
- Ownership-scoped Promotion/Offer/Agreement reads.
- Legacy local-demo endpoint removal after cutover.

## Routes

Status: `ADAPT` / `REMOVE_AFTER_CUTOVER`

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

Target missing routes:

```text
/auth/callback
/logout
/onboarding/role
/brand/promotions/new
/brand/promotions/{promotionId}
/brand/agreements/{agreementId}
/brand/settings/profile
/brand/settings/agent
/creator/offers/{negotiationId}
/creator/settings/profile
/creator/settings/agent
```

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

Status: `REPLACE` / `REMOVE_AFTER_CUTOVER`

Frontend:

- `frontend/src/product/mockData.ts`: full mock sessions, negotiations, creator deals, fake `termsHash`, fake signature placeholders.
- `frontend/src/product/ProductScreens.tsx`: demo account resolver for `test1` to `test4`.
- `frontend/src/product/ProductScreens.tsx`: promotion creation falls back to `brand-001` and `brand-agent-001`.
- `frontend/src/product/ProductScreens.tsx`: creator criteria falls back to `creator-001`.
- `frontend/src/product/apiClient.ts`: evidence submission hardcodes `https://social.example/post/with-brand-and-ad`.
- `frontend/src/product/dataSource.ts`: API mode still returns mock `roleSessions` and `creatorCriteria`.
- `frontend/src/product/dataSource.ts`: no-id promotion resolution uses the first global promotion.
- `frontend/src/product/dataSource.ts`: hardcoded display names for demo creators and brand.
- No `setTimeout` or `setInterval` paths were found in `frontend/src`.

Backend:

- `backend/apps/api/repository_factory.py`: memory mode auto-seeds fixtures.
- `backend/apps/api/schemas.py`: `PromotionCreateRequest` defaults to `brand-001` and `brand-agent-001`.
- `backend/libs/settings/config.py`: defaults to memory repository, local A2A, local web3, Gemini off.
- `backend/libs/agents/demo_context.py`: in-memory creator policy contexts.
- `backend/fixtures/*.json`: seed data for users, brands, creators, agents, policies, promotions.
- `backend/apps/api/routes.py`: Gemini explanation/rationale fallbacks are acceptable only as non-authoritative display text.
- `backend/apps/api/routes.py`: simulated escrow receipts are successful local fallback and must not be accepted as MVP escrow success.

Web3:

- `web3/gateway/src/config.ts`: signing defaults to simulated unless `KNOT_WEB3_SIGNING_MODE=devnet`.
- `web3/gateway/src/escrow.ts`: simulated lock/release returns `202` with `signature: null`.

## Firestore Ownership

Status: `ADAPT`

Current collections/path helpers exist in:

- `backend/libs/repositories/firestore_paths.py`
- `backend/libs/repositories/store.py`
- `backend/libs/repositories/firestore_adapter.py`

Current gaps:

- `users/{userId}` is not `users/{firebaseUid}`.
- Brand/Creator docs lack `ownerUid`.
- Promotion create accepts caller-supplied `brandId` and `brandAgentId`.
- `list_promotions()` and `list_creator_profiles()` read whole collections.
- Product API resource reads do not verify caller participation.
- Dashboard queries do not enforce ownership.
- Schema version 2 fields from `docs/06_DATA_MODEL.md` are not implemented.

## A2A

Status: `ADAPT`

Keep:

- `backend/libs/a2a/models.py`
- `backend/libs/a2a/client.py`
- `backend/apps/creator_agent/main.py`
- A2A Task/Message/Artifact persistence from Product API orchestration.

Adapt:

- Product API uses actual HTTP A2A only when `KNOT_CREATOR_A2A_MODE=http`.
- Local fallback via `InMemoryA2ATaskStore` must not be a successful production/API-mode fallback.
- Creator Agent runtime contexts currently come from `demo_creator_contexts()`, not Firestore-owned creator policy.
- Product API persists `creatorPolicySnapshot` in negotiation documents; private policy redaction and access control are required.

## Escrow And Web3

Status: `ADAPT`

Keep:

- Backend termsHash recomputation before lock.
- Idempotency key requirement.
- Evidence gate before release.
- Gateway client boundary.
- Gateway devnet signing path.
- Anchor program workspace.

Adapt:

- Backend must not mark escrow as successfully locked/released when only simulated receipt exists in MVP mode.
- Gateway simulated mode should remain explicit local/test mode only.
- Devnet signing requires secrets, funded wallets, and approval before execution.
- Cloud Run demo deploy currently sets `KNOT_WEB3_SIGNING_MODE=simulated`.

## Dev Admin

Status: `REPLACE`

Current:

- `/dev/admin` frontend page displays diagnostic cards from `getDevOverview()`.
- Backend has audit event helper only.

Missing:

- Admin auth claim or allowlist.
- User list.
- Disable/enable/delete.
- Dry-run deletion job.
- Safe demo seed/reset API.
- Retry endpoint for known idempotent operations.
- Funded-record retention rules.

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

Phase 1 should implement real account/auth foundation only:

- Firebase Auth client and server token verification.
- `GET /api/v1/me` and first-login bootstrap.
- Real route/session guards.
- Server-derived role/profile context.
- No local-demo successful fallback in API mode.
- Tests for invalid token, refresh, wrong role, wrong owner, and no mock fallback.
