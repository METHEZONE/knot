# Phase 11 ExecPlan — Final QA and Deployment Lock

## Goal

Run the final local verification matrix and document deployment/on-chain blockers without touching `main` or performing approval-gated operations.

## Source Documents

- `docs/00_DOCUMENT_INDEX.md`
- `docs/14_SECURITY_PRIVACY_AUTHORITY_AND_CONCURRENCY.md`
- `docs/15_GCP_ARCHITECTURE_DEPLOYMENT_OBSERVABILITY.md`
- `docs/16_TEST_ACCEPTANCE_AND_DEMO.md`
- `docs/17_WBS_AND_IMPLEMENTATION_PLAN.md`
- `docs/KNOT_PRODUCT_MASTER_SPEC_FINAL.md`

## Scope

- Re-run backend lint/type/full tests.
- Re-run frontend type/lint/unit/build checks.
- Re-run Web3 Gateway build/unit/lint checks.
- Run a local tracked-file secret pattern scan.
- Record that Cloud Run deployment, IAM/Secret changes, wallet funding, and live devnet lock/release smoke remain blocked on explicit approval.
- Preserve unrelated local README and prompt-file changes.

## Implementation Notes

- No deployment was executed.
- No Cloud IAM, Secret Manager, wallet funding, program deployment, or on-chain transaction was executed.
- No final two-window live E2E was claimed because live deployment and devnet signatures are approval-gated.

## Verification

- `../.venv/bin/python -m pytest` from `backend`
- `../.venv/bin/python -m ruff check .` from `backend`
- `../.venv/bin/python -m mypy` from `backend`
- `npm run typecheck` from `frontend`
- `npm run lint` from `frontend`
- `npm test` from `frontend`
- `npm run build` from `frontend`
- `npm run build` from `web3/gateway`
- `npm test` from `web3/gateway`
- `npm run lint` from `web3/gateway`
- `git grep -n -I -E "(AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35}|BEGIN (RSA|OPENSSH|PRIVATE) KEY|PRIVATE_KEY=|MNEMONIC|SEED_PHRASE|firebase-adminsdk|SERVICE_ACCOUNT)" -- . ':!frontend/.next' ':!node_modules'`

## Result

2026-08-20 KST follow-up QA:

- Local backend full test suite passed: `165 passed, 7 skipped`.
- Frontend typecheck, lint, unit tests, and production build passed.
- Web3 Gateway build and lint passed. `npm --prefix web3/gateway test` still cannot fully run inside this sandbox because one route test opens a local `127.0.0.1` listener and fails with `listen EPERM`; this is an environment limitation.
- Cloud Run services were listed as `RoutesReady=True`: `knot-web`, `knot-api`, `knot-web3`, `knot-creator-agent`.
- Live web routes for the demo pages returned 200.
- Firebase password sign-in for `t1@knot.com / 000000` and `c1@knot.com / 000000` succeeded.
- Live web proxy API smoke passed for `/api/v1/me`, role dashboards, promotions, agreements, Creator agent state, negotiation messages, and match candidates.
- Firestore contains the required devnet/XEXYMIX demo users, agents, policies, discovery profile, promotions, match runs, candidates, negotiations, messages, agreements, milestones, escrows, evidence, and settlements.
- Solana devnet confirmed the completed demo lock/release signatures as `finalized` with `err=None`.

Open release risks:

- Browser-click E2E with Phantom was not fully automated because Playwright/Puppeteer is not installed and Chrome headless did not complete inside the sandbox.
- `promotion-xexymix-devnet` has A2A and Agreement data, but its promotion timeline is empty; use `agreement-devnet-1usdc` for the final proof sequence if showing funding/evidence/release timeline.
- Demo data currently mixes program IDs: completed escrow evidence uses `9LjQL46RB4WigamSUmuEehVWF9BLz145Wv4cBxgF4Npn`, while current code/deploy defaults prepare new escrows with `Aj63B5hLtvJdNQiAi61rMrgfW3pt8Lak3GQB59B6jysj`. Both programs exist on devnet, but the demo script and documentation should present one canonical program ID.
