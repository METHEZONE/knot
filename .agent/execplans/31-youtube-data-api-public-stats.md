# ExecPlan 31 - YouTube Data API Public Stats

Date: 2026-08-20 KST

## Goal

Creator onboarding should accept a YouTube channel or representative video link and,
when a configured YouTube Data API key is available, show truthful public metrics
instead of leaving every count as "확인 필요".

## Scope

- Add `YOUTUBE_API_KEY` backend configuration.
- Parse representative YouTube video IDs from `watch?v=`, `shorts/`, `youtu.be/`,
  `embed/`, and `live/` URLs.
- Call YouTube Data API `videos.list(part=snippet,statistics)` for representative
  video metrics and `channels.list(part=snippet,statistics)` for channel metrics.
- Map only returned public statistics into Creator analysis drafts:
  subscriber count, representative video views, likes, comments, channel views,
  and channel video count.
- Keep missing or failed statistics in `unknownFields`; do not fabricate values.
- Update Creator onboarding UI labels for YouTube statistics.

## Non-Goals

- No YouTube OAuth.
- No YouTube Data API key creation, Secret Manager mutation, or Cloud Run env
  changes in this phase.
- No historical average view calculation across multiple videos.

## Verification Plan

- Ruff for touched backend files.
- Focused onboarding tests for oEmbed fallback, Data API stat mapping, Shorts URL
  parsing, and Gemini + YouTube path.
- Frontend typecheck/lint/build.

## Operational Note

The deployed app will continue to show "공개 지표 확인 필요" until `YOUTUBE_API_KEY`
is provided to the API service, preferably from Secret Manager. The key must not be
committed to git.
