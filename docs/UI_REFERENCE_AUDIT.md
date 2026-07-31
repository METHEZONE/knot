# UI Reference Audit - two-user-session

## Reference

- Branch: `origin/feat/two-user-session`
- Commit: `263c9d3859c5979c51b418542e953637339e6583`
- Purpose: mandatory frontend UI/UX source for onboarding, Manager/Agent conversation, settings, visual tokens, and motion language.

## Route Inventory

Reference routes used for the current refactor:

- `/brand/product`
- `/brand/mood`
- `/brand`
- `/creator/connect`
- `/creator/rules`
- `/creator`
- `/settings`

Current branch keeps Firebase Auth and Product API route guards. Legacy onboarding routes redirect to the reference entries:

- `/brand/onboarding` -> `/brand/product`
- `/brand/products/new` -> `/brand/product`
- `/creator/onboarding` -> `/creator/connect`

## Component Inventory

Ported directly or adapted from the reference branch:

- `frontend/src/app/fonts/LeeSeoyun.ttf`
- `frontend/src/features/onboard/BrandProduct.tsx`
- `frontend/src/features/onboard/BrandMood.tsx`
- `frontend/src/features/onboard/CreatorConnect.tsx`
- `frontend/src/features/onboard/CreatorRules.tsx`
- `frontend/src/features/chat/ManagerChat.tsx`
- `frontend/src/features/chat/Money.tsx`
- `frontend/src/features/chat/RoleHome.tsx`
- `frontend/src/features/settings/SettingsScreen.tsx`
- `frontend/src/components/AgentAvatar.tsx`
- `frontend/src/product/dealBoard.ts`
- `frontend/src/product/journey.ts`
- `frontend/src/product/setupStore.ts`
- `frontend/src/product/useSessionRole.ts`

New current-branch adapter component:

- `frontend/src/features/dashboard/AgentDashboard.tsx`

## Decisions

- The reference onboarding UI is preserved, but its completion handlers now create authenticated backend Brand/Creator profiles through `ProductApiClient`.
- The reference `ManagerChat` remains available as a visual reference, but it is not used as the canonical dashboard negotiation path because it advances localStorage demo state.
- The dashboard renders real Product API summaries, Creator Agent state, created promotions, selected candidates, agreements, and persisted negotiation messages.
- Brand `검토 끝, 협상 시작` is the real run entry point. `매니저 붙이기` remains onboarding/profile completion and does not start negotiation.
- Creator `협찬 받기 켜기` maps to the owner-scoped Creator Agent publish/resume API.

## Screenshot Artifacts

Expected artifact directory:

- `artifacts/reference-ui/two-user-session/`

Screenshots should be refreshed from local smoke runs before visual sign-off.
