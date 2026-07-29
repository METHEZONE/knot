# KNOT v2 Branch and API Audit

> Date: 2026-07-30  
> Worktree: `/private/tmp/knot-v2-product-flow`  
> Implementation branch: `feat/knot-v2-product-flow`  
> Frontend base: `origin/feat/two-user-session`  
> Backend/API/Web3 stable candidate: `origin/main`

## 1. Git Baseline

- Preserved original work in `/Users/yewonchoi/Desktop/knot`.
- Created backup branch before implementation work:
  - `backup/knot-v2-docs-pre-worktree-20260730`
- Created documentation source-of-truth commit:
  - original branch commit: `65e5523 docs: establish KNOT v2 source of truth`
  - new UI-base branch commit: `c880538 docs: establish KNOT v2 source of truth`
- Created separate worktree:
  - `/private/tmp/knot-v2-product-flow`
  - branch `feat/knot-v2-product-flow`
  - base `origin/feat/two-user-session`

## 2. Branch Comparison Summary

### `origin/feat/two-user-session`

Use as frontend source of truth.

Keep first:
- `frontend/src/features/onboard/BrandProduct.tsx`
- `frontend/src/features/onboard/BrandMood.tsx`
- `frontend/src/features/onboard/CreatorConnect.tsx`
- `frontend/src/features/onboard/CreatorRules.tsx`
- `frontend/src/features/settings/SettingsScreen.tsx`
- `frontend/src/features/chat/ManagerChat.tsx`
- `frontend/src/features/chat/Money.tsx`
- `frontend/src/product/session.ts`
- `frontend/src/product/dealBoard.ts`
- `frontend/src/product/setupStore.ts`
- `frontend/src/product/journey.ts`
- `frontend/src/product/currency.ts`
- visual tokens in `frontend/src/app/globals.css`
- `frontend/src/app/fonts/LeeSeoyun.ttf`

Current UI branch behavior:
- Uses `sessionStorage` for role session isolation.
- Uses `localStorage` shared board state for the two-window demo.
- Uses `setTimeout` to simulate product/social analysis and negotiation animation.
- Displays explicit `SIMULATED · 서명 없음` for demo escrow visualization.
- Does not contain Firebase Auth frontend wiring.
- Does not contain Next API proxy for Product API.
- Does not contain Cloud Build files.

### `origin/main`

Use as stable backend/API/Web3 source candidate.

Keep or port selectively:
- Firebase Auth client and Product API auth forwarding:
  - `frontend/src/auth/*`
  - `frontend/src/app/api/v1/[...path]/route.ts`
  - relevant parts of `frontend/src/product/apiClient.ts`
- Backend Product API:
  - `backend/apps/api/routes.py`
  - `backend/apps/api/schemas.py`
  - `backend/apps/api/repository_factory.py`
- Firebase verification:
  - `backend/libs/auth/firebase.py`
- Firestore repository boundaries:
  - `backend/libs/repositories/*`
- A2A:
  - `backend/apps/creator_agent/main.py`
  - `backend/libs/a2a/*`
  - `backend/libs/agents/*`
- deterministic policy:
  - `backend/libs/policies/*`
- Agreement/termsHash/domain:
  - `backend/libs/domain/*`
- Web3 gateway:
  - `web3/gateway/src/app.ts`
  - `web3/gateway/src/escrow.ts`
  - `web3/gateway/src/solana.ts`
  - `web3/gateway/src/config.ts`
- Solana escrow program:
  - `programs/knot-escrow/src/lib.rs`
- Cloud Run and local scripts:
  - `infra/cloudbuild/*.yaml`
  - `scripts/deploy_cloud_run_demo.sh`
  - `scripts/local/*.sh`

Observed `origin/main` route surface:
- `GET /api/v1/me`
- `POST /api/v1/me/role`
- `POST /api/v1/me/wallet`
- `GET /api/v1/me/wallet/balance`
- `GET /api/v1/me/notifications`
- `POST /api/v1/me/brand-profile`
- `POST /api/v1/me/creator-profile`
- `GET /api/v1/brand/dashboard`
- `GET /api/v1/creator/dashboard`
- `GET/POST /api/v1/brand/promotions`
- `GET /api/v1/brand/promotions/{promotionId}`
- `GET /api/v1/brand/promotions/{promotionId}/activity`
- `GET /api/v1/brand/agreements`
- `GET /api/v1/brand/agreements/{agreementId}`
- `GET /api/v1/creator/offers`
- `GET /api/v1/creator/offers/{negotiationId}`
- `GET /api/v1/creator/agreements`
- `GET /api/v1/creator/agreements/{agreementId}`
- legacy compatibility: `POST /api/v1/users:bootstrap`
- legacy onboarding: `POST /api/v1/brands:onboard`, `POST /api/v1/creators:onboard`
- promotion/matching: `POST /api/v1/promotions`, `POST /api/v1/promotions/{id}/matches:run`
- negotiation start: `POST /api/v1/match-runs/{matchRunId}:start-negotiation`
- negotiation detail: `GET /api/v1/negotiations/{id}`, `/messages`, `/events`, `/agreement`
- agreement and escrow: `GET /api/v1/agreements/{id}`, `POST /api/v1/agreements/{id}/escrow:lock`
- evidence: `POST /api/v1/agreements/{id}/evidence`, `POST /api/v1/evidence/{id}:verify`
- settlement: `POST /api/v1/escrows/{id}/milestones/{milestoneId}:release`
- receipts: `GET /api/v1/transaction-receipts/{id}`
- dev/admin endpoints under `/api/v1/dev-admin/*`

## 3. Stability Decision

`origin/main` is the current stable backend/API/Web3 candidate because it has:
- Firebase Admin verification code.
- Authenticated `/me` and role/profile endpoints.
- Product API resource routes.
- Firestore repository adapters and seed tooling.
- Real A2A HTTP client/server boundary.
- Agreement, evidence, escrow, settlement routes.
- Web3 gateway devnet signing path.
- Cloud Build configs for API, creator agent, frontend, and web3.
- Focused tests for auth, dashboards, A2A, escrow, resource routes, policies, and Firestore.

Verification still required before marking stable backend `VERIFIED`:
- Run selected backend tests in a clean worktree based on `origin/main` or after porting backend into this branch.
- Run web3 gateway tests.
- Run local smoke for API, creator agent, and gateway.
- Devnet smoke requires explicit approval because it can perform on-chain transactions.

## 4. UI to API Mapping

### Authentication and role

UI source:
- `/login`, `/signup`
- `frontend/src/product/session.ts` currently uses sessionStorage role demo.

API source:
- `GET /api/v1/me`
- `POST /api/v1/me/role`
- Firebase ID token from frontend auth.

Adapter needed:
- Keep two-window UX by using Firebase `browserSessionPersistence`.
- Replace demo role session with `CurrentUserContext` ViewModel.
- Do not use role-card clicks alone to create production users.

### Brand onboarding

UI source:
- `BrandProduct.tsx`: product URL, product snapshot, `읽어오기`.
- `BrandMood.tsx`: mood cards and budget/cap.

API source:
- Target spec: `POST /api/v1/brand-sources:analyze`, `POST /api/v1/brands:onboard`.
- Existing main: `POST /api/v1/me/brand-profile`, `POST /api/v1/brand/promotions`, legacy `POST /api/v1/brands:onboard`.

Adapter needed:
- Product analysis ViewModel with truthful degraded state.
- Manager connect action persists profile/policy/Agent and first `DRAFT` Promotion.
- On success route to `/brand`; do not start negotiation.

### Creator onboarding

UI source:
- `CreatorConnect.tsx`: Instagram username analysis.
- `CreatorRules.tsx`: minimum baseline and blocked categories.

API source:
- Target spec: `POST /api/v1/creator-sources:analyze`, `POST /api/v1/creators:onboard`.
- Existing main: `POST /api/v1/me/creator-profile`, legacy `POST /api/v1/creators:onboard`.

Adapter needed:
- Instagram analysis ViewModel with no fake metrics when unavailable.
- Manager connect persists Creator profile, policy, Agent, `availability=OFFLINE`, `acceptingOffers=false`.
- On success route to `/creator`; do not start negotiation.

### `/mypage`

UI source:
- `SettingsScreen.tsx`

API source:
- `GET /api/v1/me`
- `POST /api/v1/me/wallet`
- future role policy/profile update endpoints if absent.

Adapter needed:
- Replace board mutation with profile/policy update DTOs.
- Preserve visual language and tabs from docs: profile, manager criteria, wallet/settlement, account.
- Redirect `/brand/settings`, `/creator/settings`, `/brand/me`, `/creator/me` to `/mypage`.

### Dashboards

UI source:
- `ManagerChat.tsx` currently doubles as home/chat and demo flow.

API source:
- `GET /api/v1/brand/dashboard`
- `GET /api/v1/creator/dashboard`

Adapter needed:
- Split Dashboard summary from Negotiation Detail.
- Dashboard shows manager state, action required, active records, escrow/settlement summary, recent 3-5 activities.
- Negotiation detail owns full `에이전트끼리 대화` timeline.

### Promotion, candidates, negotiation

UI source:
- `ManagerChat.tsx` provides visual A2A conversation.

API source:
- `POST /api/v1/brand/promotions`
- `POST /api/v1/promotions/{id}/matches:run`
- `GET /api/v1/match-runs/{id}/candidates`
- `POST /api/v1/match-runs/{id}/candidates/{creatorAgentId}:select`
- `POST /api/v1/match-runs/{id}:start-negotiation`
- `GET /api/v1/negotiations/{id}/messages`
- `GET /api/v1/negotiations/{id}/events`

Adapter needed:
- Brand `협찬 제안하기` starts matching and negotiation only from dashboard/promotion CTA.
- Creator `협찬 받기` toggles availability/accepting offers; existing API endpoint must be added or ported if missing.
- Store and render rejected/expired history.
- Do not expose private policy values in candidate or negotiation DTOs.

### Agreement, escrow, evidence, settlement

UI source:
- `ManagerChat.tsx` Agreement/Escrow cards and `EscrowVault`.

API source:
- `GET /api/v1/agreements/{id}`
- `POST /api/v1/agreements/{id}/escrow:lock`
- `POST /api/v1/agreements/{id}/evidence`
- `POST /api/v1/evidence/{id}:verify`
- `POST /api/v1/escrows/{id}/milestones/{milestoneId}:release`
- `GET /api/v1/transaction-receipts/{id}`

Adapter needed:
- Show real `termsHash` from Agreement only.
- Show devnet signature/explorer only when receipt is confirmed.
- Keep `SIMULATED · 서명 없음` only in explicit local/demo mode.
- No timer-based success.

## 5. Risks and Required Fixes

- UI branch uses `setTimeout` for analysis and negotiation animation. This must become loading/streaming/polling against Product API.
- UI branch uses `localStorage` as business-state source. This must be replaced with Product API/Firestore-backed state.
- UI branch route names (`/brand/product`, `/brand/mood`, `/creator/connect`, `/creator/rules`) do not match v2 target routes. Keep components but mount them under `/onboarding/brand` and `/onboarding/creator`, with legacy redirects.
- `origin/main` frontend has useful auth/API code but old/new UI mixture. Do not wholesale merge it into this branch.
- `origin/main` still has mock data and fallback helpers in frontend. Port only API clients, auth, proxy, wallet, and tests that do not force old UI.
- `origin/main` web3 supports `SIMULATED`; final production happy path must not display it as real success.
- Devnet tests and deployment require explicit approval.

## 6. Immediate Next Steps

1. Phase 1: run UI reference app, capture screenshots, and freeze reference.
2. Phase 2: port Firebase Auth frontend wiring from `origin/main`, add `browserSessionPersistence`, and connect `/me` role routing.
3. Phase 3: adapt two-window onboarding components to Product API profile/policy/Agent endpoints.
4. Phase 4: port `SettingsScreen.tsx` into `/mypage`, replacing board mutation with API ViewModel.
5. Continue through phases listed in `.agent/execplans/KNOT_V2_FULL_IMPLEMENTATION.md`.
