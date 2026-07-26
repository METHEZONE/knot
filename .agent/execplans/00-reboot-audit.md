# Phase 0 Repository Audit and Reboot Plan

## Goal
Complete the repository audit required by `prompts/00_REPOSITORY_AUDIT.md` and define the reboot plan before any application-code changes.

The target product direction is:

```text
Real authentication
-> one-page role onboarding
-> role dashboard
-> Promotion / Offer
-> real A2A negotiation
-> Agreement
-> Solana devnet Escrow
```

Society Map remains out of scope.

## Current Behavior
Repository state was audited on branch `integration/frontend-backend-api`.

The working tree already contains a documentation reboot made before this audit:

- `AGENTS.md` and `PLANS.md` are modified.
- New source-of-truth docs exist as `docs/00_DOCUMENT_INDEX.md` through `docs/15_TOKEN_BUDGET_STRATEGY.md`.
- Legacy docs such as `docs/00_INDEX.md`, `docs/01_PRD_v1.md`, `docs/20_IMPLEMENTATION_STATUS.md`, and handoff/demo documents are deleted in the current working tree.
- `prompts/00_REPOSITORY_AUDIT.md` and later phase prompts are untracked.

Current app behavior:

- Frontend is a Next.js app in `frontend/`.
- Backend/Product API and Creator Agent are Python/FastAPI services in `backend/`.
- Web3 gateway is a TypeScript/Express service in `web3/gateway/`.
- Anchor/Solana program lives in `programs/knot-escrow/`.
- Cloud Build configs exist in `infra/cloudbuild/`.

Reproduction commands run during audit:

```text
cd frontend && npm run test
cd frontend && npm run typecheck
cd backend && ../.venv/bin/python -m pytest tests/test_health_apps.py tests/test_api_onboarding.py tests/test_api_promotions.py tests/test_a2a_negotiation.py tests/test_api_escrow.py
```

Results:

- Frontend product tests: 9 passed.
- Frontend typecheck: passed.
- Backend selected tests: 39 passed, 1 Starlette/httpx deprecation warning.

## In Scope
- Read `AGENTS.md`, `PLANS.md`, `prompts/00_REPOSITORY_AUDIT.md`.
- Follow prompt reading list: `docs/00_DOCUMENT_INDEX.md`, `docs/01_PRODUCT_PRD.md`, `docs/02_SCOPE_AND_GLOSSARY.md`, `docs/03_INFORMATION_ARCHITECTURE_AND_ROUTES.md`, `docs/12_MIGRATION_AND_CUTOVER.md`, `docs/13_TEST_AND_ACCEPTANCE.md`.
- Inventory repository structure.
- Identify auth/session implementation.
- Identify mock, fixture, hardcoded ID, timer, and fallback-success paths.
- Map current frontend routes and reusable visual components.
- Map Firestore ownership and missing fields.
- Classify notable files as `KEEP`, `ADAPT`, `REPLACE`, `REMOVE_AFTER_CUTOVER`, or `ARCHIVE_DOC`.
- Locate actual A2A and escrow code.
- Create `.agent/execplans/00-reboot-audit.md`.
- Create `docs/IMPLEMENTATION_STATUS.md`.

## Out of Scope
- Application code edits.
- Firebase Auth implementation.
- Firestore schema migration.
- Route cutover.
- Mock removal.
- Dev admin implementation.
- Deployment, IAM changes, Secret Manager changes.
- Wallet funding, program deployment, or on-chain transactions.
- Deleting data or modifying production Firestore.

## Files and Symbols
Instructions and source-of-truth docs:

- `AGENTS.md`
- `PLANS.md`
- `prompts/00_REPOSITORY_AUDIT.md`
- `docs/00_DOCUMENT_INDEX.md`
- `docs/01_PRODUCT_PRD.md`
- `docs/02_SCOPE_AND_GLOSSARY.md`
- `docs/03_INFORMATION_ARCHITECTURE_AND_ROUTES.md`
- `docs/12_MIGRATION_AND_CUTOVER.md`
- `docs/13_TEST_AND_ACCEPTANCE.md`

Frontend:

- `frontend/src/app/page.tsx`: `/` landing.
- `frontend/src/app/login/page.tsx`: `/login`.
- `frontend/src/app/signup/page.tsx`, `frontend/src/app/signup/brand/page.tsx`, `frontend/src/app/signup/creator/page.tsx`: signup routes.
- `frontend/src/app/brand/page.tsx`: redirects `/brand` to `/brand/onboarding`.
- `frontend/src/app/brand/products/new/page.tsx`: legacy product/promotion creation route.
- `frontend/src/app/brand/negotiate/page.tsx`, `frontend/src/app/brand/result/page.tsx`, `frontend/src/app/brand/settlement/page.tsx`: active legacy flow pages.
- `frontend/src/app/creator/result/page.tsx`, `frontend/src/app/creator/criteria/page.tsx`: active legacy creator flow pages.
- `frontend/src/app/creator/agreements/[agreementId]/page.tsx`: current dynamic creator agreement route.
- `frontend/src/app/api/v1/[...path]/route.ts`: Next API proxy.
- `frontend/src/product/ProductScreens.tsx`: current screen implementations, `LoginScreen`, `RoleSignupScreen`, `BrandProductScreen`, `AgentNegotiationPanel`, local session helpers.
- `frontend/src/product/dataSource.ts`: `MockKnotDataSource`, `ApiKnotDataSource`, `resolveDataMode`.
- `frontend/src/product/apiClient.ts`: `ProductApiClient`, `apiBaseUrl`, Product API methods.
- `frontend/src/product/mockData.ts`: mock sessions, negotiation, deals, fake signatures.
- `frontend/src/product/flow.ts`: current route constants.
- `frontend/src/components/TopBar.tsx`: global nav.
- `frontend/src/app/globals.css`: current visual tokens.
- `frontend/src/components/AgentCharacter.tsx`, `frontend/src/components/SquiggleFilters.tsx`, `frontend/src/lib/agentIdentity.ts`: reusable visual system.
- `frontend/tests/product-flow.test.ts`: current product route/data behavior tests.

Backend/Product API:

- `backend/apps/api/main.py`: FastAPI app construction.
- `backend/apps/api/routes.py`: Product API routes and orchestration.
- `backend/apps/api/schemas.py`: request/response schemas.
- `backend/apps/api/repository_factory.py`: repository selection and memory seed.
- `backend/libs/settings/config.py`: runtime settings.
- `backend/libs/repositories/firestore_paths.py`: Firestore path helpers.
- `backend/libs/repositories/store.py`: repository abstraction.
- `backend/libs/repositories/firestore_adapter.py`: Firestore adapter.
- `backend/libs/repositories/seed.py`, `backend/fixtures/*.json`: current explicit fixtures.
- `backend/libs/a2a/client.py`: `CreatorA2AClient`.
- `backend/libs/a2a/store.py`: `InMemoryA2ATaskStore`.
- `backend/apps/creator_agent/main.py`: Creator Agent A2A HTTP app.
- `backend/libs/agents/demo_context.py`: demo Creator Agent contexts.
- `backend/libs/ai/gemini.py`: non-authoritative Gemini rationale/explanation.
- `backend/libs/web3/client.py`: Product API to web3 gateway client.
- `backend/knot/escrow/client.py`, `backend/knot/escrow/pdas.py`: lower-level escrow utilities.

Web3/infra:

- `web3/gateway/src/app.ts`: internal gateway routes.
- `web3/gateway/src/config.ts`: signing mode and keypair env config.
- `web3/gateway/src/escrow.ts`: lock/release validation and simulated/devnet receipt behavior.
- `web3/gateway/src/solana.ts`: devnet transaction submission.
- `programs/knot-escrow/src/lib.rs`: Anchor program.
- `infra/cloudbuild/*.yaml`: Cloud Build configs.
- `scripts/deploy_cloud_run_demo.sh`: demo deployment script.
- `scripts/seed_demo.py`, `scripts/firestore_smoke.py`: seed/smoke helpers.

## Data Migration
No migration is executed in Phase 0.

Required future migration from `docs/12_MIGRATION_AND_CUTOVER.md`:

- Create schema version 2.
- Use Firebase Auth UID as `users/{uid}`.
- Add ownership fields such as `ownerUid`, `brandId`, `creatorId`, `onboardingStatus`, `role`, `agentId`, `schemaVersion`.
- Do not infer mappings from local-demo users to Firebase UIDs.
- Prefer controlled reset/reseed for disposable demo data.

Observed missing fields and risks:

- Backend-generated users currently use `user-{uuid}` rather than Firebase UID.
- Brand and Creator onboarding does not persist `ownerUid`.
- Promotion create request defaults to `brand-001` and `brand-agent-001`.
- API list/read methods use global collection reads without authenticated ownership scope.
- Existing fixture users map multiple test accounts to shared brand/creator documents.

## API Changes
No API changes are made in Phase 0.

Required future API phases:

- Add Firebase ID token verification and current-user dependency.
- Add `GET /api/v1/me`.
- Replace `POST /api/v1/users:bootstrap` local-demo semantics with authenticated first-request bootstrap.
- Derive user/profile/agent ownership from verified UID, not request body or localStorage.
- Add owner-scoped dashboard/resource endpoints.
- Add target resource routes from `docs/03_INFORMATION_ARCHITECTURE_AND_ROUTES.md`.
- Add Dev Admin endpoints for seed/reset, disable/enable/delete, retry, and audit, all behind admin authorization.
- Ensure API mode never falls back to a successful mock result.
- Ensure escrow lock/release cannot report success without confirmed devnet receipt in MVP mode.

## UI Changes
No UI changes are made in Phase 0.

Required future UI phases:

- Add Firebase Auth login/signup flow.
- Add route guards and redirects:
  - unauthenticated protected route -> `/login?next=...`
  - no role -> `/onboarding/role`
  - incomplete role profile -> role onboarding
  - completed brand -> `/brand`
  - completed creator -> `/creator`
- Convert active legacy demo routes to target resource routes:
  - `/brand/promotions/new`
  - `/brand/promotions/{promotionId}`
  - `/brand/agreements/{agreementId}`
  - `/creator/offers/{negotiationId}`
  - `/creator/agreements/{agreementId}`
  - role-specific settings routes
- Keep existing visual tokens and reusable agent character components.
- Remove legacy implementation pages only after redirects and E2E pass.

## Security Considerations
Critical current gaps:

- Browser-supplied email, role, and userId are trusted by current Product API.
- `localStorage` stores current session context.
- No Firebase Auth package or server token verification exists.
- No route middleware or server-side page guard exists.
- Product API has no role/ownership guards on resource routes.
- Next proxy does not forward auth cookies or Authorization tokens.
- Creator private policy is persisted in Product API negotiation documents as `creatorPolicySnapshot`; access controls and redaction are required before exposing these resources.
- Cloud Run demo script deploys services with `--allow-unauthenticated`.
- Web3 gateway defaults to simulated signing unless `KNOT_WEB3_SIGNING_MODE=devnet`.
- Simulated escrow receipts must not be presented as real on-chain success.

Constraints to preserve:

- Gemini can propose explanatory text only.
- Deterministic policy code must authorize matching, negotiation decisions, evidence, and escrow.
- LLM output must never authorize payments or escrow.
- No secrets, keypairs, service-account JSON, or private keys may be committed or printed.

## Milestones
- [x] Read instructions and phase prompt.
- [x] Read required audit docs.
- [x] Map repository structure.
- [x] Inventory current frontend routes and visual components.
- [x] Inventory auth/session implementation.
- [x] Inventory mock, fixture, hardcoded, timer, and fallback-success paths.
- [x] Inventory Firestore model/ownership gaps.
- [x] Locate A2A HTTP and local fallback code.
- [x] Locate escrow/web3 gateway and devnet/simulated behavior.
- [x] Classify notable files.
- [x] Reproduce current behavior with selected checks.
- [x] Create Phase 0 ExecPlan.
- [x] Create `docs/IMPLEMENTATION_STATUS.md`.
- [ ] Future Phase 1: implement real Firebase-authenticated account foundation.

## Tests
Run during Phase 0:

```text
cd frontend && npm run test
cd frontend && npm run typecheck
cd backend && ../.venv/bin/python -m pytest tests/test_health_apps.py tests/test_api_onboarding.py tests/test_api_promotions.py tests/test_a2a_negotiation.py tests/test_api_escrow.py
```

Recommended first tests for Phase 1:

- Backend Firebase token verification success/failure.
- `GET /api/v1/me` authenticated bootstrap.
- First-login idempotency.
- Wrong-role and wrong-owner 403.
- Frontend login/logout/session refresh.
- Protected route redirect tests.
- No local-demo successful fallback in API mode.

## Rollback
Phase 0 modifies only planning/status documents.

Rollback:

```text
git restore .agent/execplans/00-reboot-audit.md docs/IMPLEMENTATION_STATUS.md
```

If the wider pre-existing doc migration must be rolled back, handle it separately; this plan does not revert or rewrite user-provided doc changes.

## Progress
- [x] Audit completed.
- [x] Current behavior reproduced.
- [x] Phase 0 ExecPlan written.
- [x] Implementation status written.
- [!] Application code intentionally unchanged.

## Decisions
- Treat `docs/00_DOCUMENT_INDEX.md` and its listed documents as current source of truth.
- Treat deleted legacy docs in the current worktree as `ARCHIVE_DOC` rather than restoring them.
- Preserve reusable frontend visual system and adapt routes/data/auth around it.
- Preserve Product API/A2A/escrow deterministic policy code, but add authentication, ownership, and production-mode enforcement before feature expansion.
- Use resource routes rather than the old `/negotiate -> /result -> /settlement` flow.
- Defer deployment and any Cloud IAM/Secret/on-chain work until explicit approval.

## Risks
- The working tree was dirty before this Phase 0 audit; Phase 0 files should be reviewed separately from the existing doc migration.
- `DESIGN.md` is referenced as source of truth but is not present in the current tree.
- Current tests pass while asserting legacy route behavior, so passing tests do not imply compliance with new route requirements.
- Local/memory defaults can hide fixture fallback unless future phases make mock mode explicit and failing.
- Firestore ownership migration needs careful handling to avoid linking local-demo identities to real Firebase users incorrectly.
- Real devnet escrow requires signer secrets and funded wallets; none are changed in Phase 0.

## Completion Evidence
Created:

- `.agent/execplans/00-reboot-audit.md`
- `docs/IMPLEMENTATION_STATUS.md`

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

Verified:

- Frontend tests and typecheck pass.
- Selected backend health/onboarding/promotion/A2A/escrow tests pass.
- No application code was edited for Phase 0.
