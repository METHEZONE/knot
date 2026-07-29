# KNOT v2 Implementation Status

> 이 문서는 **코드·테스트·배포 증거를 확인한 뒤 갱신**한다.  
> 이전 대화나 오래된 배포 상태를 현재 사실로 간주하지 않는다.

## Status Legend

- `NOT_STARTED`
- `IN_PROGRESS`
- `BLOCKED`
- `IMPLEMENTED`
- `VERIFIED`
- `DEPLOYED`

---

## 1. Baseline Audit

| 영역 | 상태 | 증거 | 비고 |
|---|---|---|---|
| UI branch runs | VERIFIED | Worktree `/private/tmp/knot-v2-product-flow` from `origin/feat/two-user-session`; `cd frontend && npm run test`, `npm run typecheck`, `npm run build` passed on 2026-07-30 | Screenshot capture still pending because no headless browser is installed |
| Stable backend identified | VERIFIED | `origin/main` selected as stable branch in `docs/V2_BRANCH_AND_API_AUDIT.md`; stable backend/API/Web3 code ported into this worktree on 2026-07-30; selected backend and web3 tests passed | Full suite still deferred to later phases |
| Auth | VERIFIED | Frontend Firebase Auth provider/client and Product API token forwarding ported; `/api/v1/me` backend tests passed; frontend typecheck/test/build passed | Live Firebase account smoke requires configured credentials |
| Firestore | IN_PROGRESS | `origin/main` repository, Firestore paths, seed tooling, and fixtures ported into this worktree | Repository tests are planned in later data-path phases |
| A2A | IN_PROGRESS | `origin/main` has Creator A2A HTTP service and Product API start-negotiation route; UI branch has `에이전트끼리 대화` visual | Not yet connected in UI-base branch |
| Agreement | IN_PROGRESS | `origin/main` has Agreement routes and termsHash-related domain code | UI adapter not yet implemented |
| Escrow | IN_PROGRESS | Web3 gateway devnet path and Product API escrow lock/release routes ported; gateway unit tests passed | Devnet smoke/on-chain actions require explicit approval |
| Settlement | IN_PROGRESS | Settlement policy/tests and release route ported from stable branch | UI adapter not yet implemented |
| Cloud Run | IN_PROGRESS | `infra/cloudbuild/*.yaml` and deploy scripts ported from stable branch | Not deployed; deployment requires approval |

---

## 2. v2 Feature Matrix

| Feature | Status | Test/Commit/URL |
|---|---|---|
| Firebase per-tab login | VERIFIED | Frontend `npm run typecheck`, `npm run test`, `npm run build`; backend `pytest tests/test_api_auth.py tests/test_health_apps.py` |
| Brand onboarding | VERIFIED | Frontend `npm run typecheck`, `npm run test`, `npm run build`; backend `pytest tests/test_api_auth.py tests/test_api_onboarding.py` |
| Creator onboarding | VERIFIED | Frontend `npm run typecheck`, `npm run test`, `npm run build`; backend `pytest tests/test_api_auth.py tests/test_api_onboarding.py` |
| Manager connect | VERIFIED | `/me/role`, `/me/brand-profile`, `/me/creator-profile` create/activate role Agent without starting negotiation; Creator receiving offers defaults OFF |
| MyPage unified | VERIFIED | `/mypage` added; `/brand/me`, `/creator/me`, `/brand/settings`, `/creator/settings` redirect; frontend `npm run test`, `npm run build`, `npm run typecheck` passed |
| Creator dashboard | VERIFIED | `/creator` loads `GET /api/v1/creator/dashboard`; frontend test/typecheck/build and backend dashboard/resource tests passed |
| Brand dashboard | VERIFIED | `/brand` loads `GET /api/v1/brand/dashboard`; frontend test/typecheck/build and backend dashboard/resource tests passed |
| Creator availability | VERIFIED | `POST /api/v1/creator/availability`; dashboard CTA toggles receiving state; backend dashboard tests passed |
| Brand proposal run | VERIFIED | `/brand/promotions/new` creates Brand Promotion and runs matching through Product API |
| Candidate list | VERIFIED | Promotion flow lists match candidates and allows explicit eligible candidate selection |
| Negotiation history | IMPLEMENTED | `/brand/promotions/[promotionId]` shows promotion activity and existing Agreement/negotiation references; full negotiation detail is Phase 7 |
| Rejected negotiation | NOT_STARTED | |
| Real A2A counter | VERIFIED | Candidate-selected Promotion flow calls `startNegotiation`; backend A2A/promotion tests passed |
| Human approval | NOT_STARTED | |
| Agreement Artifact | IMPLEMENTED | Negotiation Detail reads Agreement artifact from Product API when present; escrow/evidence are Phase 8 |
| termsHash | VERIFIED | Backend promotion/A2A tests verify real `termsHash`; UI displays API-provided hash only |
| Devnet escrow lock | VERIFIED | Negotiation Detail calls `escrow:lock`; backend escrow and web3 gateway tests passed; live devnet smoke skipped pending approval |
| Evidence URL | VERIFIED | Negotiation Detail submits user-entered Evidence URL and verifies via Product API |
| Milestone release | VERIFIED | Negotiation Detail releases milestone only after verified evidence and API escrow state |
| Explorer receipt | IMPLEMENTED | UI displays API receipt signature/explorer only when returned; no fake URL generated |
| E2E | BLOCKED | Unit/build/full backend/web3 checks and unauthenticated visual screenshots passed; authenticated browser E2E requires Firebase credentials/test users |
| Deployment | BLOCKED | Deployment requires explicit approval; no deploy/IAM/Secret/mainnet action performed |

---

## 3. Known Blockers

No operational blocker yet. Implementation is proceeding phase-by-phase on `feat/knot-v2-product-flow`.

Current risks:

```text
RISK: Authenticated browser E2E is still pending.
IMPACT: Code, build, backend, web3, and unauthenticated visual surfaces are verified, but full logged-in two-user browser automation has not run.
EVIDENCE: Headless Chrome screenshots exist for landing, login, and signup; Firebase credentials/test users were not configured in this environment.
NEXT ACTION: Run authenticated two-window E2E after providing a Firebase test environment.

RISK: Live Firebase sign-in was not smoke-tested with real credentials.
IMPACT: Static and unit verification pass, but an environment-specific Firebase configuration issue may only appear in a configured dev session.
EVIDENCE: Frontend Firebase client/provider are ported; Product API auth tests pass; no secret or credential changes were made.
NEXT ACTION: Run a local configured browser smoke after Phase 3 onboarding endpoints are wired.

RISK: Deployment and live devnet smoke are approval-gated.
IMPACT: Local tests verify code paths, but production Cloud Run and live devnet receipts are not updated.
EVIDENCE: No deployment, IAM, Secret, wallet funding, or on-chain transaction command was run.
NEXT ACTION: Request explicit approval before deployment or live devnet actions.
```

---

## 4. Latest Verified Build

```text
Commit: f33fbc1 test: remove frontend mock flow and verify build; pending screenshot evidence commit
Frontend revision: origin/feat/two-user-session UI plus Firebase Auth/Product API onboarding, MyPage, dashboard, Promotion, Negotiation, Escrow, Evidence, Settlement, and mock-removal changes
Backend revision: origin/main stable API/Auth/Firestore/A2A/Agreement/Escrow/Settlement baseline ported
Web3 version: origin/main gateway baseline ported
URL:
Verified at: 2026-07-30 Phase 9 tests
Verifier: Codex
```

## 6. Phase 1 Baseline Evidence

Commands run in `/private/tmp/knot-v2-product-flow/frontend`:

```text
npm install
npm run test
npm run typecheck
npm run build
```

Results:
- `npm install`: completed with Node engine warning (`eslint-visitor-keys` wants newer Node than v20.13.0) and 12 high severity npm audit findings. No remediation was applied during baseline capture.
- `npm run test`: 8 passed.
- `npm run typecheck`: passed.
- `npm run build`: passed. Static routes generated: `/`, `/brand`, `/brand/mood`, `/brand/product`, `/brand/settings`, `/creator`, `/creator/connect`, `/creator/rules`, `/creator/settings`, `/dev/admin`, `/login`, `/signup`.
- Local dev server smoke: `npm run dev -- --port 3100` started successfully; route HTML was fetched with `curl`.
- Landing adjustment after review: `/` now uses the production long landing from `origin/main` via `frontend/public/knot/index.html`; the UI-base React `LandingScreen` page was removed. Re-run `npm run test`, `npm run typecheck`, and `npm run build`: all passed.

Screenshot status:
- Pending. Local CLI has `/usr/sbin/screencapture` and `/usr/bin/open`, but no headless `chromium`, `google-chrome`, or `playwright`. Capturing role pages accurately requires a browser session because the current UI branch gates role pages through client-side `sessionStorage`.
- Attempted `open http://127.0.0.1:3100/login` and `screencapture -x .agent/screenshots/phase1-login-reference.png`; the captured image showed only the desktop background, not the browser UI, so the invalid artifact was deleted.

---

## 7. Phase 2 Firebase Auth And Stable Baseline

Changes:
- Ported stable backend/API/Web3/Cloud Run baseline from `origin/main` into the UI-base branch.
- Wrapped the frontend app in `AuthProvider`.
- Switched `/login` from role-demo session entry to Firebase email/Google sign-in plus `/api/v1/me` role/onboarding routing.
- Set Firebase browser session persistence so separate browser windows can keep independent auth sessions for two-user demos.
- Added a Suspense boundary for `/login` so Next.js production prerender succeeds with `useSearchParams`.

Commands run:

```text
cd frontend && npm run typecheck
cd frontend && npm run test
cd frontend && npm run build
cd backend && /Users/yewonchoi/Desktop/knot/.venv/bin/python -m pytest tests/test_api_auth.py tests/test_health_apps.py
cd web3/gateway && npm run test
```

Results:
- Frontend typecheck: passed.
- Frontend tests: 8 passed.
- Frontend production build: passed; dynamic API proxy route `/api/v1/[...path]` generated.
- Backend auth/health tests: 7 passed, 1 Starlette/httpx deprecation warning.
- Web3 gateway tests: 12 passed.

Warnings:
- `npm install` left existing audit findings: frontend 12 high severity findings; web3 gateway 15 findings.
- Web3 Solana packages warn that the current Node v20.13.0 is below their preferred `>=20.18.0`.
- No deployment, secret mutation, wallet funding, or on-chain transaction was performed.

---

## 8. Phase 3 Two-Window Onboarding API Connection

Changes:
- `/signup` now renders actual role selection for authenticated Firebase users instead of redirecting back to `/login`.
- Role selection calls `POST /api/v1/me/role` with an idempotency key, refreshes Auth context, and routes to `/brand/onboarding` or `/creator/onboarding`.
- `/brand/**` and `/creator/**` layout guards now use Firebase/Product API account context instead of `sessionStorage`.
- Added v2 onboarding routes: `/brand/onboarding`, `/creator/onboarding`, `/onboarding/brand`, `/onboarding/creator`.
- Brand `읽어오기` calls `POST /api/v1/onboarding/brand/analyze-source`; no successful local fallback is used.
- Brand `매니저 붙이기` calls `POST /api/v1/me/brand-profile`.
- Creator onboarding no longer displays deterministic fake Instagram metrics.
- Creator `매니저 붙이기` calls `POST /api/v1/me/creator-profile`; API stores `receivingOffers=false`, `acceptingOffers=false`, `availability=OFFLINE`.

Commands run:

```text
cd frontend && npm run typecheck
cd frontend && npm run test
cd frontend && npm run build
cd backend && /Users/yewonchoi/Desktop/knot/.venv/bin/python -m pytest tests/test_api_auth.py tests/test_api_onboarding.py
```

Results:
- Frontend typecheck: passed.
- Frontend tests: 8 passed.
- Frontend production build: passed; 19 app routes generated including `/brand/onboarding`, `/creator/onboarding`, `/onboarding/brand`, `/onboarding/creator`.
- Backend auth/onboarding tests: 9 passed, 1 Starlette/httpx deprecation warning.

Screenshot status:
- Pending for the same local browser tooling reason recorded in Phase 1.

---

## 9. Phase 4 MyPage Integration

Changes:
- Added `/mypage` as the single account/profile/settings surface.
- Changed `/brand/me`, `/creator/me`, `/brand/settings`, and `/creator/settings` to redirect to `/mypage`.
- Updated top navigation route inventory so both roles use `/mypage` instead of role-specific settings pages.
- Replaced local board mutation settings UI with Product API account/profile summary display and `/me/wallet` save action.
- Removed old session logout from SettingsScreen; logout now uses Firebase Auth through `AuthProvider`.

Commands run:

```text
cd frontend && npm run test
cd frontend && npm run build
cd frontend && npm run typecheck
```

Results:
- Frontend tests: 8 passed.
- Frontend production build: passed; 22 app routes generated including `/mypage`, role me redirects, and role settings redirects.
- Frontend typecheck: passed after build completed. A simultaneous first run raced with `.next/types` regeneration and failed on a missing generated `routes.js`; rerunning after build passed.

Screenshot status:
- Pending for the same local browser tooling reason recorded in Phase 1.

---

## 10. Phase 5 Role Dashboards

Changes:
- Replaced `/brand` and `/creator` first screens with API-backed dashboard views.
- Dashboard shows Manager state, summary metrics, action-required panel, active/in-progress list, and recent activity.
- `RoleGate` now redirects incomplete accounts from dashboard routes back to role onboarding while allowing onboarding routes.
- Preserved `ManagerChat` for later Negotiation Detail work instead of using it as the Dashboard.

Commands run:

```text
cd frontend && npm run test
cd frontend && npm run build
cd frontend && npm run typecheck
cd backend && /Users/yewonchoi/Desktop/knot/.venv/bin/python -m pytest tests/test_api_dashboards.py tests/test_api_resource_routes.py
```

Results:
- Frontend tests: 8 passed.
- Frontend production build: passed.
- Frontend typecheck: passed after build completed. Parallel typecheck/build can race on generated `.next/types`.
- Backend dashboard/resource tests: 8 passed, 1 Starlette/httpx deprecation warning.

Screenshot status:
- Pending for the same local browser tooling reason recorded in Phase 1.

---

## 11. Phase 6 Promotion, Candidates, Negotiation Lists

Changes:
- Added Creator availability API: `POST /api/v1/creator/availability`.
- Creator dashboard `협찬 받기` toggles availability through Product API.
- Brand dashboard `협찬 제안하기` links to `/brand/promotions/new`.
- Added `/brand/promotions/new` flow: creates Brand-owned Promotion, runs matching, lists candidates, and allows explicit eligible candidate selection.
- Added `/brand/promotions/[promotionId]` detail: reads Product API detail/activity and lists Agreement/negotiation references.
- No `setTimeout` success path, fake signature, fake explorer, or automatic negotiation success was added.

Commands run:

```text
cd frontend && npm run test
cd frontend && npm run typecheck
cd frontend && npm run build
cd backend && /Users/yewonchoi/Desktop/knot/.venv/bin/python -m pytest tests/test_api_dashboards.py tests/test_api_promotions.py tests/test_api_resource_routes.py
```

Results:
- Frontend tests: 8 passed.
- Frontend typecheck: passed.
- Frontend production build: passed; 23 app routes generated including `/brand/promotions/new` and `/brand/promotions/[promotionId]`.
- Backend dashboard/promotions/resource tests: 24 passed, 1 Starlette/httpx deprecation warning.

Screenshot status:
- Pending for the same local browser tooling reason recorded in Phase 1.

---

## 12. Phase 7 Real A2A Negotiation Detail

Changes:
- Candidate-selected Promotion flow now exposes an explicit `협상 시작` action that calls `POST /api/v1/match-runs/{matchRunId}:start-negotiation`.
- Added `/negotiations/[negotiationId]` detail route.
- Negotiation Detail reads `GET /api/v1/negotiations/{id}`, `/messages`, and `/agreement`; it displays only API-returned messages, Agreement status, and termsHash.
- Creator dashboard offer/activity rows link to Negotiation Detail when a `negotiationId` is present.
- No timer-based success, fake termsHash, or fake Agreement path was added.

Commands run:

```text
cd frontend && npm run test
cd frontend && npm run typecheck
cd frontend && npm run build
cd backend && /Users/yewonchoi/Desktop/knot/.venv/bin/python -m pytest tests/test_a2a_negotiation.py tests/test_api_a2a_http_integration.py tests/test_api_promotions.py
```

Results:
- Frontend tests: 8 passed.
- Frontend typecheck: passed.
- Frontend production build: passed; dynamic `/negotiations/[negotiationId]` route generated.
- Backend A2A/promotion tests: 28 passed, 1 Starlette/httpx deprecation warning.

Screenshot status:
- Pending for the same local browser tooling reason recorded in Phase 1.

---

## 13. Phase 8 Agreement, Escrow, Evidence, Settlement

Changes:
- Negotiation Detail now loads Agreement escrow bundle.
- Added explicit Escrow lock action using `POST /api/v1/agreements/{agreementId}/escrow:lock`.
- Added Evidence URL input and submit/verify action using Product API evidence endpoints.
- Added milestone release action using `POST /api/v1/escrows/{escrowId}/milestones/{milestoneId}:release`.
- Receipt display shows only API-returned receipt ID, status, signature, and explorer URL.

Commands run:

```text
cd frontend && npm run test
cd frontend && npm run typecheck
cd frontend && npm run build
cd backend && /Users/yewonchoi/Desktop/knot/.venv/bin/python -m pytest tests/test_api_escrow.py tests/test_escrow_devnet.py
cd web3/gateway && npm run test
```

Results:
- Frontend tests: 8 passed.
- Frontend typecheck: passed.
- Frontend production build: passed.
- Backend escrow tests: 13 passed, 1 skipped devnet test, 1 Starlette/httpx deprecation warning.
- Web3 gateway tests: 12 passed.

Devnet note:
- No live wallet funding, on-chain transaction, or mainnet action was performed. Live devnet smoke still requires explicit approval.

Screenshot status:
- Pending for the same local browser tooling reason recorded in Phase 1.

---

## 14. Phase 9 Mock Removal, E2E, Deploy Gate

Changes:
- Removed frontend production mock data source, mock data fixtures, legacy session role store, local deal board, local journey engine, and unused chat simulation entry files.
- Rewrote `ProductScreens.tsx` to expose only real Firebase login and Product API role selection surfaces.
- Replaced `/dev/admin` mock overview with Product API dev-admin overview loading.
- Removed deterministic Instagram/product generator helpers and fake frontend termsHash fixtures.
- Frontend route tests now cover route surface and auth routing invariants rather than deterministic fixture negotiations.

Commands run:

```text
cd frontend && npm run test
cd frontend && npm run typecheck
cd frontend && npm run build
cd backend && /Users/yewonchoi/Desktop/knot/.venv/bin/python -m pytest
cd web3/gateway && npm run test
cd web3/gateway && npm run build
```

Results:
- Frontend tests: 4 passed.
- Frontend typecheck: passed.
- Frontend production build: passed.
- Backend full test suite: 98 passed, 5 skipped, 1 Starlette/httpx deprecation warning.
- Web3 gateway tests: 12 passed.
- Web3 gateway build: passed.
- Frontend production-code mock search: no legacy mock data source, fake Instagram generator, fake termsHash fixture, session role store, local journey, or local deal board references remain. Two `setTimeout` calls remain only to clear MyPage saved-state UI messages.
- Headless Chrome screenshots generated:
  - `.agent/screenshots/phase9-landing.png`
  - `.agent/screenshots/phase9-login.png`
  - `.agent/screenshots/phase9-signup.png`

Not performed:
- Authenticated browser E2E: requires Firebase credentials/test users.
- Deployment: requires explicit user approval.
- Live devnet on-chain smoke: requires explicit user approval.

---

## 5. Update Rule

각 Phase:
1. code audit
2. implementation
3. tests
4. screenshots
5. commit
6. status update

`IMPLEMENTED`는 코드 존재, `VERIFIED`는 test 통과, `DEPLOYED`는 live smoke 통과를 뜻한다.
