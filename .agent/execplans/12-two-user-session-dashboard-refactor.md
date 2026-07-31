# Phase 12 ExecPlan - two-user-session UI Dashboard Refactor

## Goal

Restore the UI/UX language from `origin/feat/two-user-session` and keep the current real-auth/Product API backend path. Add only the role dashboards requested by the product update:

- 정산
- 에이전트 관리
- 에이전트 협상 기록

## Source Documents

- `docs/00_DOCUMENT_INDEX.md`
- `docs/00_UI_REFERENCE_TWO_USER_SESSION.md`
- `docs/03_USER_FLOWS_AND_INFORMATION_ARCHITECTURE.md`
- `docs/04_CARD_DECK_ONBOARDING_UX.md`
- `docs/05_DASHBOARD_AND_LIVE_AGENT_RUN_UX.md`
- `prompts/CODEX_IMPLEMENT_FINAL_KNOT.md` (read-only, do not commit)

## UI Reference

- Branch: `origin/feat/two-user-session`
- Commit: `263c9d3859c5979c51b418542e953637339e6583`
- Ported visual assets/components:
  - `frontend/src/app/fonts/LeeSeoyun.ttf`
  - `frontend/src/features/onboard/*`
  - `frontend/src/features/chat/*`
  - `frontend/src/features/settings/SettingsScreen.tsx`
  - `frontend/src/components/AgentAvatar.tsx`
  - `frontend/src/product/dealBoard.ts`
  - `frontend/src/product/journey.ts`
  - `frontend/src/product/setupStore.ts`
  - `frontend/src/product/useSessionRole.ts`

## Scope

- Preserve Firebase Auth and Product API account context.
- Preserve the reference two-step onboarding routes:
  - Brand: `/brand/product` -> `/brand/mood` -> `/brand`
  - Creator: `/creator/connect` -> `/creator/rules` -> `/creator`
- Redirect old onboarding URLs to the reference route entries.
- Replace only `/brand` and `/creator` dashboard surfaces with the new role dashboards.
- Brand dashboard starts real Product API promotion creation and A2A negotiation after user review.
- Creator dashboard uses owner-scoped Creator Agent publish/pause/resume routes.

## Out of Scope

- Main branch changes.
- Backend route rewrites.
- Firestore browser writes.
- Production deploy, IAM, secrets, wallet funding, or on-chain transactions.
- Silent mock fallback in production.

## Verification Plan

- `cd frontend && npm run typecheck`
- `cd frontend && npm run lint`
- `cd frontend && npm test`
- `cd frontend && npm run build`
- Local frontend/backend smoke with easy Firebase test accounts.

## Current Result

In progress. Typecheck passes after the UI port and dashboard route swap.
