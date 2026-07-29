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
| Stable backend identified | IN_PROGRESS | `origin/main` selected as stable candidate in `docs/V2_BRANCH_AND_API_AUDIT.md` | Test execution still required before `VERIFIED` |
| Auth | IN_PROGRESS | `origin/main` has `backend/libs/auth/firebase.py`, `/api/v1/me`, frontend `src/auth/*`, and API token forwarding | Not yet ported into UI-base branch |
| Firestore | IN_PROGRESS | `origin/main` has `backend/libs/repositories/*`, Firestore paths, seed tooling, and repository tests | Not yet verified in this worktree |
| A2A | IN_PROGRESS | `origin/main` has Creator A2A HTTP service and Product API start-negotiation route; UI branch has `에이전트끼리 대화` visual | Not yet connected in UI-base branch |
| Agreement | IN_PROGRESS | `origin/main` has Agreement routes and termsHash-related domain code | UI adapter not yet implemented |
| Escrow | IN_PROGRESS | `origin/main` has Web3 gateway devnet path and Product API escrow lock/release routes | Devnet smoke requires explicit approval |
| Settlement | IN_PROGRESS | `origin/main` has settlement policy/tests and release route | UI adapter not yet implemented |
| Cloud Run | IN_PROGRESS | `origin/main` has `infra/cloudbuild/*.yaml` and deploy scripts | Not yet ported or deployed |

---

## 2. v2 Feature Matrix

| Feature | Status | Test/Commit/URL |
|---|---|---|
| Firebase per-tab login | NOT_STARTED | |
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

No operational blocker yet. Implementation is intentionally paused before code changes until Phase 1 reference screenshots and baseline tests are captured.

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

RISK: Stable backend candidate is code-identified but not test-verified in this worktree.
IMPACT: Cannot mark backend/Web3 as VERIFIED yet.
EVIDENCE: origin/main route/test inventory in docs/V2_BRANCH_AND_API_AUDIT.md.
NEXT ACTION: Run selected tests when backend code is ported or in an origin/main worktree.
```

---

## 4. Latest Verified Build

```text
Commit: c880538 docs: establish KNOT v2 source of truth
Frontend revision: origin/feat/two-user-session @ 263c9d3 plus docs commit
Backend revision: origin/main candidate, not ported into this branch
Web3 version: origin/main candidate, not ported into this branch
URL:
Verified at: 2026-07-30 audit + frontend baseline tests
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

Screenshot status:
- Pending. Local CLI has `/usr/sbin/screencapture` and `/usr/bin/open`, but no headless `chromium`, `google-chrome`, or `playwright`. Capturing role pages accurately requires a browser session because the current UI branch gates role pages through client-side `sessionStorage`.
- Attempted `open http://127.0.0.1:3100/login` and `screencapture -x .agent/screenshots/phase1-login-reference.png`; the captured image showed only the desktop background, not the browser UI, so the invalid artifact was deleted.

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
