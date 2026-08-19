# ExecPlan 30 - Creator YouTube Onboarding Analysis

## Scope

Switch Creator signup source analysis from Instagram-first to YouTube-first so
the demo uses a more stable public metadata source.

## Source Documents Read

- `docs/00_DOCUMENT_INDEX.md`
- `docs/04_CARD_DECK_ONBOARDING_UX.md`
- `docs/11_GEMINI_ANALYSIS_AND_POLICY_ENGINE.md`
- Existing Creator onboarding frontend and backend analysis routes.

## Implementation Steps

1. [x] Change Creator connect UI copy and placeholder from Instagram handle to
   YouTube channel/video URL.
2. [x] Normalize bare handles to `https://www.youtube.com/@...`.
3. [x] Preserve the analyzed source URL when creating the Creator profile
   instead of forcing an Instagram URL.
4. [x] Add YouTube URL detection in Creator profile analysis.
5. [x] Add YouTube oEmbed metadata fetch as the stable no-key public source.
6. [x] Run Gemini structured analysis over YouTube public metadata when Vertex
   Gemini is enabled.
7. [x] Fall back to a truthful `youtube-oembed` draft when Gemini is off or
   unavailable.
8. [x] Keep subscriber/view/engagement metrics unknown until YouTube Data API
   statistics are explicitly connected.
9. [x] Update Creator card-deck documentation.
10. [x] Add backend regression tests and run frontend verification.

## Verification

- `./.venv/bin/pytest backend/tests/test_api_onboarding.py::test_creator_profile_analysis_uses_youtube_oembed_metadata backend/tests/test_api_onboarding.py::test_creator_profile_analysis_uses_gemini_for_youtube_metadata backend/tests/test_api_onboarding.py::test_creator_profile_analysis_treats_instagram_login_wall_as_limited -q`:
  3 passed.
- `npm --prefix frontend run typecheck`: passed.
- `npm --prefix frontend run lint`: passed.
- `npm --prefix frontend run build`: passed.

## Pending

- API/Web deployment is pending explicit approval.
- After deployment, verify `/creator/connect` with a public YouTube URL on the
  deployed app.
