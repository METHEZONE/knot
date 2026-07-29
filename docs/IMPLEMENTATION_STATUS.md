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
| Brand onboarding | NOT_STARTED | |
| Creator onboarding | NOT_STARTED | |
| Manager connect | NOT_STARTED | |
| MyPage unified | NOT_STARTED | |
| Creator dashboard | NOT_STARTED | |
| Brand dashboard | NOT_STARTED | |
| Creator availability | NOT_STARTED | |
| Brand proposal run | NOT_STARTED | |
| Candidate list | NOT_STARTED | |
| Negotiation history | NOT_STARTED | |
| Rejected negotiation | NOT_STARTED | |
| Real A2A counter | NOT_STARTED | |
| Human approval | NOT_STARTED | |
| Agreement Artifact | NOT_STARTED | |
| termsHash | NOT_STARTED | |
| Devnet escrow lock | NOT_STARTED | |
| Evidence URL | NOT_STARTED | |
| Milestone release | NOT_STARTED | |
| Explorer receipt | NOT_STARTED | |
| E2E | NOT_STARTED | |
| Deployment | NOT_STARTED | |

---

## 3. Known Blockers

No operational blocker yet. Implementation is proceeding phase-by-phase on `feat/knot-v2-product-flow`.

Current risks:

```text
RISK: Phase 1 screenshot capture is pending.
IMPACT: Visual reference is identified in code but not yet image-captured.
EVIDENCE: `npm run build` generated routes; `curl` returned HTML for UI routes; local CLI has no `chromium`, `google-chrome`, or `playwright`.
NEXT ACTION: Install/use a browser screenshot tool or capture manually before Phase 2 UI changes.

RISK: UI branch uses sessionStorage/localStorage and setTimeout demo flows.
IMPACT: Must not be treated as production business state or real success.
EVIDENCE: docs/V2_BRANCH_AND_API_AUDIT.md section 4 and 5.
NEXT ACTION: Replace with Product API ViewModels during Phases 2-4.

RISK: Live Firebase sign-in was not smoke-tested with real credentials.
IMPACT: Static and unit verification pass, but an environment-specific Firebase configuration issue may only appear in a configured dev session.
EVIDENCE: Frontend Firebase client/provider are ported; Product API auth tests pass; no secret or credential changes were made.
NEXT ACTION: Run a local configured browser smoke after Phase 3 onboarding endpoints are wired.
```

---

## 4. Latest Verified Build

```text
Commit: pending Phase 2 commit
Frontend revision: origin/feat/two-user-session UI plus Firebase Auth/Product API adapter changes
Backend revision: origin/main stable API/Auth/Firestore/A2A/Agreement/Escrow/Settlement baseline ported
Web3 version: origin/main gateway baseline ported
URL:
Verified at: 2026-07-30 Phase 2 tests
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

## 5. Update Rule

각 Phase:
1. code audit
2. implementation
3. tests
4. screenshots
5. commit
6. status update

`IMPLEMENTED`는 코드 존재, `VERIFIED`는 test 통과, `DEPLOYED`는 live smoke 통과를 뜻한다.
