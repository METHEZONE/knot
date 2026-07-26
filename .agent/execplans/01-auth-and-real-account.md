# Phase 1 Firebase Auth and Real Account Context

## Goal
Replace local-demo account context in API mode with Firebase-authenticated account context and real `users/{uid}` bootstrap data.

The phase ends after tests and handoff updates. It does not implement dashboard/resource migration beyond minimal authenticated routing support.

## Current Behavior
Pre-change reproduction on `integration/frontend-backend-api`:

```text
cd frontend && npm run test
cd frontend && npm run typecheck
cd backend && ../.venv/bin/python -m pytest tests/test_health_apps.py tests/test_api_onboarding.py
```

Results:

- Frontend tests: 9 passed.
- Frontend typecheck: passed.
- Backend selected tests: 4 passed, 1 Starlette/httpx deprecation warning.

Observed current implementation:

- `frontend/src/product/ProductScreens.tsx` uses local demo accounts and stores `knot.localSession` in `localStorage`.
- `frontend/src/product/apiClient.ts` does not attach an ID token.
- `frontend/src/app/api/v1/[...path]/route.ts` proxies requests without forwarding `Authorization`.
- `backend/apps/api/routes.py` exposes `POST /api/v1/users:bootstrap` and onboarding routes that accept browser-supplied `userId`.
- `backend/libs/settings/config.py` has no explicit auth mode or Firebase project setting.
- `backend/pyproject.toml` has no Firebase Admin SDK dependency.

## In Scope
- Add explicit backend auth mode configuration.
- Verify Firebase ID tokens server-side in production mode.
- Support explicit emulator token mode for local tests.
- Add authenticated `GET /api/v1/me`.
- Add idempotent current-user role and profile bootstrap endpoints using verified UID.
- Attach Firebase ID tokens from the frontend API client.
- Forward `Authorization` through the Next API proxy.
- Replace login/signup local-demo flow with Firebase email/password and Google entry points.
- Add loading, unauthenticated, and error states for account resolution.
- Add focused backend and frontend tests for the new auth path.
- Update implementation status and handoff notes.

## Out of Scope
- Dashboard/resource ownership migration.
- A2A negotiation changes.
- Escrow, web3 gateway, wallet funding, on-chain transactions.
- GCP IAM, Firebase project configuration, Secret Manager, deployment.
- Removing all legacy local-demo endpoints.
- Full onboarding redesign.

## Files and Symbols
- `backend/libs/settings/config.py`: `Settings`.
- `backend/libs/auth/firebase.py`: Firebase token verifier and authenticated identity model.
- `backend/apps/api/schemas.py`: current-user auth request/response schemas.
- `backend/apps/api/routes.py`: `/api/v1/me` route family and auth dependency.
- `backend/pyproject.toml`: Firebase Admin SDK dependency.
- `backend/tests/test_api_auth.py`: auth contract tests.
- `frontend/src/auth/firebaseClient.ts`: Firebase client auth helpers.
- `frontend/src/product/apiClient.ts`: auth token provider and `/me` methods.
- `frontend/src/app/api/v1/[...path]/route.ts`: auth header forwarding.
- `frontend/src/product/ProductScreens.tsx`: real login/signup/account states.
- `frontend/tests/product-flow.test.ts`: API client auth behavior coverage.
- `.env.example`, `backend/.env.example`: documented auth env variables.
- `docs/IMPLEMENTATION_STATUS.md`, `docs/HANDOFF.md`: handoff/status updates.

## Data Migration
No destructive migration is performed.

New authenticated requests create or update `users/{uid}` idempotently with schema-version-2 fields:

- `uid`
- `email`
- `displayName`
- `photoUrl`
- `role`
- `onboardingStatus`
- `status`
- `brandId`
- `creatorId`
- `agentId`
- `schemaVersion`
- `createdAt`
- `updatedAt`
- `lastLoginAt`

Existing fixture and legacy demo records are left untouched for later cutover phases.

## API Changes
- Add `GET /api/v1/me`.
- Add `POST /api/v1/me/role`.
- Add `POST /api/v1/me/brand-profile`.
- Add `POST /api/v1/me/creator-profile`.
- Add `POST /api/v1/logout/revoke`.
- New current-user endpoints derive UID from verified ID token only.
- Existing legacy endpoints remain only for current compatibility tests and are not used by the new frontend auth path.

## UI Changes
- Login uses Firebase email/password and Google instead of predefined demo accounts.
- Signup creates a Firebase account, selects BRAND or CREATOR, then persists role through the backend.
- API requests attach the current Firebase ID token.
- Auth failures surface as unauthenticated/error states instead of successful mock fallback.
- Minimal routing uses `/api/v1/me` response for role/dashboard target decisions.

## Security Considerations
- Do not trust frontend UID, role, ownership, or profile IDs.
- Do not persist Firebase ID tokens manually in source-controlled fixtures.
- Emulator mode must be explicit through `KNOT_AUTH_MODE=emulator`.
- Production/default auth mode verifies with Firebase Admin SDK.
- Revocation endpoint requires a verified current user.
- No secrets, private keys, service-account JSON, or API tokens are added.

## Milestones
- [x] Read phase instructions and required docs.
- [x] Reproduce current behavior before code edits.
- [x] Create Phase 1 ExecPlan.
- [x] Implement backend auth verifier and current-user endpoints.
- [x] Implement frontend Firebase auth client and API token forwarding.
- [x] Replace local-demo login/signup usage with authenticated flow.
- [x] Add/update tests.
- [x] Run phase tests.
- [x] Review diff.
- [x] Update status and handoff.

## Tests
Planned phase tests:

```text
cd backend && ../.venv/bin/python -m pytest tests/test_api_auth.py tests/test_health_apps.py tests/test_api_onboarding.py
cd frontend && npm run test
cd frontend && npm run typecheck
cd frontend && npm run lint
```

Production build may also be run if dependency changes settle cleanly:

```text
cd frontend && npm run build
```

## Rollback
Rollback Phase 1 files with `git restore` for modified tracked files and remove newly added auth test/helper files if needed.

No deployment or data migration is performed, so rollback is code-only.

## Progress
- [x] Baseline tests passed before implementation.
- [x] ExecPlan created.
- [x] Backend Firebase/emulator token verifier added.
- [x] `/api/v1/me`, `/api/v1/me/role`, `/api/v1/me/brand-profile`, `/api/v1/me/creator-profile`, and `/api/v1/logout/revoke` added.
- [x] Frontend Firebase Auth client added.
- [x] Login/signup now use Firebase Auth and server-derived current-user context.
- [x] Next proxy forwards `Authorization`.
- [x] API client attaches bearer tokens through an injected token provider.
- [x] Auth tests and API client token-forwarding test added.

## Decisions
- Use Firebase Auth UID as the only server-side user identity key.
- Keep emulator test mode explicit instead of accepting local-demo identity.
- Keep legacy onboarding endpoints for compatibility until resource-route migration phases.

## Risks
- Firebase package installation may require network access.
- Full route authorization for dashboard/resource data belongs to later phases; this phase only establishes account context and minimal frontend auth flow.
- Existing local development requires Firebase web app env values or explicit Auth Emulator configuration.

## Completion Evidence
Implemented and verified.

Commands:

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
