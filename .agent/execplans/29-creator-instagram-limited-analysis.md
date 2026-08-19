# ExecPlan 29 - Creator Instagram Limited Analysis

## Scope

Fix the Creator signup Instagram analysis path so Instagram login-wall pages are
not treated as valid scraped profile data.

## Source Documents Read

- `docs/00_DOCUMENT_INDEX.md`
- `docs/04_CARD_DECK_ONBOARDING_UX.md`
- `docs/11_GEMINI_ANALYSIS_AND_POLICY_ENGINE.md`
- Existing Creator onboarding frontend and backend analysis routes.

## Implementation Steps

1. [x] Reproduce deployed API behavior for a Creator Instagram URL.
2. [x] Confirm Instagram returns a login-wall page that was being treated as
   fetched source content.
3. [x] Detect Instagram access/login-wall pages in Creator profile analysis.
4. [x] Return a truthful limited analysis using the URL handle instead of
   storing `Instagram` or login copy as profile data.
5. [x] Update Creator onboarding copy for limited Instagram access.
6. [x] Avoid showing unknown public metrics as `0`; show `확인 필요` instead.
7. [x] Add backend regression coverage and run frontend verification.

## Verification

- Deployed API reproduction before fix:
  `https://instagram.com/ye__5o` returned a fetched Instagram login page with
  `displayName=Instagram`, `provider=secure-fetch`,
  `fallbackReason=model_schema_invalid`.
- `./.venv/bin/pytest backend/tests/test_api_onboarding.py::test_creator_profile_analysis_treats_instagram_login_wall_as_limited backend/tests/test_api_onboarding.py::test_creator_profile_analysis_extracts_public_metrics_when_present backend/tests/test_api_onboarding.py::test_creator_profile_analysis_and_confirmation_are_owner_scoped -q`:
  3 passed.
- `npm --prefix frontend run typecheck`: passed.
- `npm --prefix frontend run lint`: passed.
- `npm --prefix frontend run build`: passed.

## Pending

- API/Web deployment is pending explicit approval.
- After deployment, re-run Creator Instagram analysis on the deployed URL and
  confirm `fallbackReason=instagram_access_limited`.
