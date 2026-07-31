# Phase 2 - Live Card Onboarding API Boundary

## Goal

Connect the existing onboarding surface to Product API boundaries for URL analysis, backend resume state, and user confirmation without fabricating social/product metrics.

## Current Behavior

- Existing frontend onboarding pages render `BrandOnboardingScreen` and `CreatorOnboardingScreen` from `frontend/src/product/ProductScreens.tsx`.
- Existing profile completion endpoints create Brand/Creator profiles directly.
- `frontend/src/product/apiClient.ts` already had a `analyzeBrandSource` method, but Product API had no matching route.
- Gemini helper exists for explanations/rationale, but secure URL fetch/extraction is not implemented.

## In Scope

- Authenticated onboarding session read/patch API.
- Authenticated product URL analysis job API.
- Authenticated creator profile URL analysis job API.
- Analysis confirmation API.
- Secure HTTPS host validation that fails closed for localhost/private IP literals.
- Deterministic limited analysis fallback when secure fetch/Gemini are unavailable.
- Frontend typed API client methods.
- Focused API tests.

## Out of Scope

- Rebuilding the visual onboarding cards.
- External page fetching and Gemini extraction.
- Embedding generation.
- Creating Promotions from Brand card completion.
- Publishing Creator Agent on completion.

## Files and Symbols

- `backend/apps/api/routes.py`
- `backend/apps/api/schemas.py`
- `backend/libs/repositories/firestore_paths.py`
- `backend/tests/test_api_onboarding.py`
- `frontend/src/product/apiClient.ts`
- `docs/IMPLEMENTATION_STATUS.md`

## Data Migration

No migration executed. Added collection path helpers for `analysisJobs` and `onboardingSessions`.

## API Changes

- `GET /api/v1/onboarding`
- `PATCH /api/v1/onboarding`
- `POST /api/v1/analyses/product`
- `POST /api/v1/analyses/creator-profile`
- `GET /api/v1/analyses/{analysisId}`
- `POST /api/v1/analyses/{analysisId}:confirm`
- `POST /api/v1/onboarding/brand/analyze-source`

## UI Changes

No visual component rewrites. `ProductApiClient` now exposes typed methods for the new API boundary.

## Security Considerations

- Analysis APIs require authenticated role ownership.
- Source URLs must use `https`.
- Localhost, Google metadata host, `.local`, private, loopback, link-local, reserved, multicast, and unspecified IP literals are rejected.
- Analysis stores URL digest and structured draft, not raw fetched content.
- Deterministic limited analysis explicitly marks unknown fields; no fake metrics are generated.

## Milestones

- [x] Add schemas and routes.
- [x] Persist analysis jobs and onboarding sessions.
- [x] Add frontend API client methods.
- [x] Add owner/SSRF/idempotency tests.
- [x] Run full phase checks.
- [ ] Commit and push.

## Tests

Planned:

- `cd backend && ../.venv/bin/python -m pytest tests/test_api_onboarding.py`
- `cd backend && ../.venv/bin/python -m pytest`
- `cd backend && ../.venv/bin/python -m ruff check .`
- `cd backend && ../.venv/bin/python -m mypy`
- `cd frontend && npm run typecheck`
- `cd frontend && npm run lint`
- `cd frontend && npm test`
- `cd frontend && npm run build`

## Rollback

Revert the Phase 2 commit. Added collections are unused unless clients call the new endpoints; no destructive migration is required.

## Progress

- [x] API boundary implemented.
- [x] Focused onboarding tests passed.
- [x] Full checks passed.

## Decisions

- Use deterministic limited analysis until secure fetch and Gemini extraction are implemented, because successful fixture fallback in live mode is forbidden.
- Keep current onboarding visuals intact and expose typed API methods before rewiring screen state.

## Risks

- Full card-deck UX is still not complete.
- DNS rebinding protection and response-size MIME checks are pending because the Phase 2 implementation does not fetch external content.

## Completion Evidence

- `backend`: focused onboarding API tests passed, `5 passed, 2 warnings`.
- `backend`: full pytest passed, `100 passed, 5 skipped, 2 warnings`.
- `backend`: ruff passed.
- `backend`: mypy passed.
- `frontend`: typecheck passed.
- `frontend`: lint passed.
- `frontend`: unit tests passed, `18 passed`.
- `frontend`: production build passed.
