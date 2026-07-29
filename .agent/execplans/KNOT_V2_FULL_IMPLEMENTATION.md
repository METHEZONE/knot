# KNOT v2 Full Implementation ExecPlan

## Goal
Build KNOT v2 on branch `feat/knot-v2-product-flow`, using `origin/feat/two-user-session` as the frontend UI/UX base and `origin/main` as the current stable backend/API/Web3 source candidate.

The target path is:

```text
Real authentication
-> two-window role onboarding
-> role dashboard
-> Promotion / Offer
-> real A2A negotiation
-> Agreement
-> Solana devnet Escrow
-> Evidence
-> Settlement
```

## Non-Negotiable Rules
- Do not continue patching the tangled frontend from the previous integration branch.
- Do not mix old and new onboarding, dashboard, or settings UI.
- Keep `origin/feat/two-user-session` UI components and visual language unless a security or correctness issue requires a local adapter.
- Port backend/API/Web3 from `origin/main` selectively.
- If UI and API models differ, add Adapter/ViewModel code.
- `매니저 붙이기` creates and activates an Agent only; it does not start negotiation.
- Creator `협찬 받기` enables inbound matching.
- Brand `협찬 제안하기` starts Promotion matching and negotiation.
- No production silent mock fallback, timer success, fake metrics, fake hash, fake signature, fake explorer URL, private policy leak, mainnet, or direct push to main.

## Phase 1: UI Reference and Screenshots

Scope:
- Run current UI-base app from this worktree.
- Capture reference screenshots for onboarding, settings, Manager chat, Agreement/Escrow visualization, and two-window layout.
- Record exact reusable files and visual tokens.
- Do not port backend code in this phase.

Tests:
```text
cd frontend && npm run test
cd frontend && npm run typecheck
cd frontend && npm run build
```

Exit:
- Screenshots saved under a non-source artifact path or documented.
- `docs/IMPLEMENTATION_STATUS.md` updated.
- Commit: `chore: freeze two-window reference`.

## Phase 2: Firebase Auth and Role

Scope:
- Port frontend Firebase auth from `origin/main`.
- Add `browserSessionPersistence` before sign-in/account creation/token observation.
- Port Next API proxy and Product API token forwarding.
- Port backend Firebase auth and `/me` endpoints from `origin/main` if not already present.
- Keep two-window behavior via browser session persistence.

Tests:
```text
cd backend && ../.venv/bin/python -m pytest tests/test_api_auth.py tests/test_health_apps.py
cd frontend && npm run test
cd frontend && npm run typecheck
```

Exit:
- Real Firebase ID token is the frontend/backend identity path.
- Role routing uses backend `/me`.
- Commit: `feat: connect firebase auth and role routing`.

## Phase 3: Two-Window Onboarding API Connection

Scope:
- Reuse `features/onboard` components.
- Mount target routes `/onboarding/brand` and `/onboarding/creator`.
- Adapt Brand product URL, mood, budget/cap into API DTOs.
- Adapt Creator Instagram, minimum baseline, blocked categories into API DTOs.
- Persist profile, policy, Agent, onboarding state through Product API.
- Manager connect ends at dashboard with `availability=OFFLINE`.

Tests:
```text
cd backend && ../.venv/bin/python -m pytest tests/test_api_onboarding.py tests/test_api_dashboards.py
cd frontend && npm run test
cd frontend && npm run typecheck
```

Exit:
- Refresh survives onboarding state.
- No fake analysis metrics in API mode.
- No automatic negotiation after Manager connect.
- Commit: `feat: connect two-window onboarding to product api`.

## Phase 4: `/mypage` Integration

Scope:
- Reuse `features/settings/SettingsScreen.tsx` visual language.
- Create `/mypage`.
- Redirect `/brand/me`, `/brand/settings`, `/creator/me`, `/creator/settings` to `/mypage`.
- Replace board mutation with profile/policy/wallet ViewModels.
- Remove duplicate settings buttons from negotiation/detail headers.

Tests:
```text
cd frontend && npm run test
cd frontend && npm run typecheck
```

Exit:
- Header avatar/name is the single MyPage entry.
- Role-specific settings pages are redirects only.
- Commit: `refactor: unify mypage settings`.

## Phase 5: Role Dashboards

Scope:
- Build Brand and Creator dashboards from API ViewModels.
- Keep Dashboard summary-only semantics.
- Creator dashboard: manager card, availability, action required, active sponsorships, settlement, recent activity.
- Brand dashboard: manager card, proposal CTA, action required, promotions, active negotiations, escrow summary, recent activity.

Tests:
```text
cd backend && ../.venv/bin/python -m pytest tests/test_api_dashboards.py tests/test_api_resource_routes.py
cd frontend && npm run test
cd frontend && npm run typecheck
```

Exit:
- Loading, empty, error states exist.
- Refresh reloads from API by user identity.
- Commit: `feat: build live role dashboards`.

## Phase 6: Promotion, Candidates, Negotiation Lists

Scope:
- Brand `협찬 제안하기` starts Promotion matching.
- Candidate list uses sanitized public DTOs.
- Add/list multiple negotiations, including rejected/expired.
- Creator offer list and sponsorship list use canonical IDs.

Tests:
```text
cd backend && ../.venv/bin/python -m pytest tests/test_api_promotions.py tests/test_api_resource_routes.py tests/test_matching.py
cd frontend && npm run test
cd frontend && npm run typecheck
```

Exit:
- Real IDs in routes.
- No global latest-object lookup.
- Commit: `feat: add promotion candidates and negotiation history`.

## Phase 7: Real A2A Negotiation Detail

Scope:
- Use `ManagerChat` conversation visual as Negotiation Detail, not Dashboard.
- Connect to Product API sanitized timeline and A2A messages.
- Ensure Brand Agent and Creator Agent cross HTTP boundary.
- Implement or adapt availability endpoint for Creator `협찬 받기`.
- Support OFFER, COUNTER, ACCEPT, REJECT, ESCALATE.

Tests:
```text
cd backend && ../.venv/bin/python -m pytest tests/test_a2a_negotiation.py tests/test_api_a2a_http_integration.py
cd frontend && npm run test
cd frontend && npm run typecheck
```

Exit:
- One-counter golden path works through actual HTTP A2A.
- Private policy is absent from counterparty DTOs.
- Commit: `feat: connect real A2A conversation`.

## Phase 8: Agreement, Escrow, Evidence, Settlement

Scope:
- Connect Agreement artifact and `termsHash`.
- Connect devnet escrow lock through Web3 Gateway.
- Connect Evidence URL submit and deterministic verification.
- Connect milestone release and receipts.
- Show confirmed devnet signatures and Explorer links only from receipts.

Tests:
```text
cd backend && ../.venv/bin/python -m pytest tests/test_api_escrow.py tests/test_settlement.py tests/test_policy_rules.py
cd web3/gateway && npm run test
```

Devnet smoke requires explicit approval.

Exit:
- No fake hash/signature/explorer.
- Idempotent lock and release.
- Commit: `feat: connect agreement escrow and settlement`.

## Phase 9: Mock Removal, E2E, Deploy

Scope:
- Remove production silent mock paths.
- Keep explicit local/demo mode only with visible banners.
- Add E2E happy path and security checks.
- Build all services.
- Deploy only after explicit approval.

Tests:
```text
cd frontend && npm run test && npm run typecheck && npm run build
cd backend && ../.venv/bin/python -m pytest
cd web3/gateway && npm run test && npm run build
```

Exit:
- Screenshots and smoke results documented.
- `docs/IMPLEMENTATION_STATUS.md` current.
- Deployment revision and URLs recorded if approved.
- Commit: `test: add e2e visual and security coverage` and deployment commit if needed.

## Current Progress
- [x] Current work preserved and backup branch created.
- [x] Documentation source-of-truth commit created before implementation.
- [x] New worktree created from `origin/feat/two-user-session`.
- [x] Documentation commit applied to `feat/knot-v2-product-flow`.
- [x] Branch/API audit written.
- [x] Phase 1 UI reference baseline captured; screenshot artifact remains pending because no headless browser is available.
- [x] Phase 2 Firebase Auth and role.
- [x] Phase 3 onboarding API connection.
- [x] Phase 4 `/mypage`.
- [x] Phase 5 dashboards.
- [x] Phase 6 promotion/candidates/lists.
- [x] Phase 7 A2A detail.
- [ ] Phase 8 Agreement/Escrow/Evidence/Settlement.
- [ ] Phase 9 cleanup/E2E/deploy.
