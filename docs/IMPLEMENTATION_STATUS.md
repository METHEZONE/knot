# Implementation Status

Updated: 2026-08-02

## Payment Rails Refactor

### Changed

- Separated pay.sh/x402 from Creator compensation escrow.
- Added `agentPaymentEvents` Firestore collection for Agent operational payment events.
- Agreement creation now starts compensation lifecycle at `FUNDING_REQUIRED`.
- Added Brand Phantom-funded escrow APIs:
  - `POST /api/v1/agreements/{agreementId}/escrow/prepare`
  - `POST /api/v1/agreements/{agreementId}/escrow/confirm`
- Added `POST /api/v1/me/wallet` for storing only public Phantom wallet addresses.
- Added Web3 Gateway prepare/confirm endpoints for Brand-signed funding transactions.
- Added Agreement-scoped Anchor escrow instructions:
  - `initialize_escrow`
  - `fund_escrow`
  - `verify_milestone`
  - `release_milestone`
  - `refund_remaining`
- Existing server-keypair `/escrow:lock` path remains for legacy/local fixture compatibility.
- Phantom wallet handling now waits for the injected provider, stores only valid Solana
  public keys, and restores the saved wallet from `/api/v1/me` on Agreement detail pages.
- Creator onboarding no longer writes a fake settlement wallet. Existing invalid wallet
  values are hidden from current-user ViewModels and rejected before Web3 Gateway calls.
- Firebase login now links a completed seeded account by verified email when Firebase UID
  differs from the seeded user document, preventing `t1@knot.com` / `c1@knot.com` from
  being treated as new signup-required users.
- Devnet demo seed now updates an existing Firebase Auth account by email when the
  requested seeded UID is unavailable, keeping `000000` as the demo password.
- Agreement detail UI was restored to the intended structure: counterparty profile,
  Agent result, and wallet/settlement cards in one row; milestones below; full A2A
  message log with payload details at the bottom.
- Escrow prepare/legacy lock now derive a stable base58-safe Agreement escrow id,
  so repeated prepare calls with the same `Idempotency-Key` no longer conflict because
  of regenerated escrow ids and gateway calls no longer receive hyphenated escrow ids.
- Brand Agreement detail now separates Phantom connection from escrow funding: the
  first click only connects/saves the wallet, and funding prepare runs after a wallet
  is already connected.
- Web3 Gateway funding policy failures now surface as `FUNDING_PREPARE_FAILED` /
  `FUNDING_CONFIRM_FAILED` conflicts instead of generic 502 Bad Gateway responses.
- Web3 Gateway AIP-136 custom-method routes now use exact regex routes, preventing
  `/escrows:prepare-funding` from being captured by the legacy `/escrows:lock` handler.
- Root landing page was restored to the existing `/knot/index.html` iframe landing
  instead of the temporary React `LandingScreen`.
- Milestone release now has a Phantom-signed prepare/confirm path:
  `/milestones/{milestoneId}/release/prepare` returns an unsigned Solana devnet
  release transaction, and `/release/confirm` validates the confirmed signature,
  settlement signer, vault delta, and Creator USDC ATA delta before writing settlement state.
- Local memory API can load an explicit `KNOT_EXTRA_MEMORY_SEED_FILE` for dev-only
  recovery of confirmed on-chain escrow records after a process restart. This is
  opt-in and does not create a successful mock fallback.
- Cloud Run demo deploy script now builds/deploys `knot-web3` and wires `knot-api`
  to `KNOT_WEB3_MODE=gateway`, the web3 gateway URL, the canonical devnet escrow
  program, devnet USDC mint, and the current demo settlement authority.

### Current Money Flow

- pay.sh: Brand Agent operational API verification spend only.
- Creator compensation: Brand Phantom USDC ATA funds Agreement vault ATA.
- Milestone release: verified milestone releases from Agreement vault ATA to Creator Phantom USDC ATA.

### Required Runtime Configuration

- `KNOT_WEB3_MODE=gateway`
- `KNOT_ESCROW_PROGRAM_ID=9LjQL46RB4WigamSUmuEehVWF9BLz145Wv4cBxgF4Npn`
- `KNOT_USDC_MINT=4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`
- `KNOT_SETTLEMENT_AUTHORITY=<settlement public key>`
- Gateway signing:
  - `KNOT_SETTLEMENT_KEYPAIR_JSON` or `KNOT_SETTLEMENT_KEYPAIR_PATH`
- Frontend:
  - `NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com`

### Verification

- `anchor build`: passed with existing Anchor cfg warnings.
- `scripts/deploy_devnet.sh`: deployed canonical escrow program
  `9LjQL46RB4WigamSUmuEehVWF9BLz145Wv4cBxgF4Npn` to devnet.
  - Deploy signature: `2NuhkFTeehyJpH588zSwvCpQ5s8AeComoTYdsUJUtrUbyqLVsY5Z7iqezDwjfzj5aMLm6dcDVw1LmNQzAGC3meb5`
  - ProgramData: `9ynq6BPG4uLdZ2xpVRn7yzono8oim6kpzpBdpyQt7qzS`
  - Upgrade authority / deploy payer: `GX1qtkjR89HXqagZ6x53BfFt4HVnSqWEw9QYxVBKgv6B`
  - Deploy payer remaining balance: `0.22430384 SOL`
- `anchor test`: build phase passed, devnet deploy phase failed because the configured upgrade authority has no credited SOL account.
- `anchor test --skip-deploy`: build phase passed, then Anchor.toml test script failed because `/opt/homebrew/opt/python@3.14/bin/python3.14` has no `pytest` module; the repository `.venv` pytest command below passed.
- `npm --prefix web3/gateway run build`: passed.
- `npm --prefix web3/gateway run lint`: passed.
- `npm --prefix web3/gateway test`: passed.
- `cd web3/gateway && npm test`: passed outside sandbox after local listen was blocked inside sandbox.
- `cd web3/gateway && npm run build`: passed after Phantom-signed release prepare/confirm changes.
- `env PYTHONPATH=backend ./.venv/bin/pytest backend/tests/test_api_escrow.py`: 21 passed.
- `cd frontend && npm run lint`: passed.
- `cd frontend && npm run build`: passed.
- `cd frontend && npm ci`: passed after synchronizing `frontend/package-lock.json`
  with `frontend/package.json`.
- `bash -n scripts/deploy_cloud_run_demo.sh`: passed.
- Local `POST /api/v1/agreements/agreement-bf47634b-9bbb-4a9d-99ee-b7a3d37b39a1/escrow/prepare`
  returned 200 with a prepared Phantom funding transaction after the gateway route fix.
- Local funded escrow recovery verified:
  - Escrow: `esc9vRLZ1xgG2x2Asr6RSytXFpmuGhZN6TL`
  - Funding tx: `5fAGfp1pY1NPNaxSJLUHWj5bP6TgFxXTKa1FZq12CSaC4hZBzgfJygLDHvnCV9uLXryANXxLcvo4395t12DLTApR`
  - Vault: `7Dk2VUaaxxLvBeo1ZQMvbMEyeuoqdeuPbpunwpsDMfet`
  - Release prepare returned `PREPARED` for settlement authority
    `63T8p6c4p1fFC7HmYDEqNtyheqMxnYKmiGqTafpzh8zJ`.
- Creator Phantom fee funding:
  - `0.02 SOL` sent to `63T8p6c4p1fFC7HmYDEqNtyheqMxnYKmiGqTafpzh8zJ`
  - Funding tx: `4WmqxoC1bEHxSoRA9r1S9x81eZ2yrNULJYjR5nJAzkQozsX8pUgv4Dnm1rNqB5DNM272czZW56Ny364UDXqoLzMb`
  - Creator SOL balance verified: `0.02 SOL`.
- `npm --prefix frontend run typecheck`: passed.
- `npm --prefix frontend run lint`: passed.
- `npm --prefix frontend run build`: passed.
- `./.venv/bin/pytest backend/tests/test_api_auth.py backend/tests/test_api_escrow.py -q`: 29 passed.
- `./.venv/bin/pytest backend/tests -q`: 126 passed, 5 skipped.
- `./.venv/bin/python -m py_compile scripts/seed_devnet_phantom_demo.py`: passed.
- Firestore/Firebase devnet demo seed executed for `t1@knot.com` and `c1@knot.com`.
- Real Firebase password sign-in checked against local Firestore-backed API:
  - `t1@knot.com / 000000`: `BRAND`, `COMPLETED`, `/brand`.
  - `c1@knot.com / 000000`: `CREATOR`, `COMPLETED`, `/creator`.
- `./.venv/bin/pytest backend/tests/test_api_a2a_http_integration.py::test_product_api_runs_real_http_a2a_counter_accept_golden_path -q` outside sandbox: passed.
- Local current-branch stack health checked:
  - Product API `http://127.0.0.1:18090/readyz`: ready.
  - Creator Agent `http://127.0.0.1:18091/readyz`: ready.
  - Web3 Gateway `http://127.0.0.1:18082/readyz`: ready.
  - Frontend `http://localhost:3000/login`: 200.

### Not Yet Verified On Devnet

- Browser-side creator Phantom signature for the prepared milestone release transaction
  still needs to be clicked in the local UI. The backend/gateway prepare path is ready,
  and the creator fee payer now has SOL.
- Future production/devnet agreements should use a dedicated backend settlement signer
  as `settlementAuthority`; the recovered local escrow keeps the already-initialized
  creator wallet as settlement authority because that value is immutable on-chain.
- Cloud Run deployment of `knot-creator-agent`, `knot-web3`, and `knot-api` completed
  with image tag `97a4e76`; the first `knot-web` build failed on stale package-lock
  metadata and Linux optional peer resolution. Frontend Docker install now uses
  `npm ci --legacy-peer-deps` while preserving lockfile-based installs.

## 2026-08-03 Real Onboarding And Richer A2A Negotiation

### Changed

- Brand and Creator onboarding no longer call frontend deterministic fixture helpers
  (`extractProduct`, `lookupInstagram`) for product/profile analysis.
- Brand product onboarding now calls `/api/v1/analyses/product`, shows unknown fields as
  user-confirmable values, and confirms the analysis before creating the Brand profile.
- Creator connect onboarding now calls `/api/v1/analyses/creator-profile`, avoids
  fabricated follower/view metrics, confirms the analysis, creates the Creator profile,
  and publishes the Creator Agent so matching can discover it.
- A2A negotiation payloads now include a role-safe `display` projection with public
  message text, term summary, and public policy summary.
- When a Creator counteroffer is within Brand policy, Brand Agent can send one bridge
  counteroffer before final acceptance, producing a multi-turn A2A transcript instead
  of a single counter/accept jump.

### Verification

- `/Users/yewonchoi/Desktop/knot/.venv/bin/pytest backend/tests/test_a2a_negotiation.py backend/tests/test_api_promotions.py -q`:
  40 passed, 1 skipped.
- `cd frontend && npm run typecheck`: passed.

## 2026-08-03 Brand Signup Simplification And Promotion Real Inputs

### Changed

- Brand signup now creates only the minimal Brand profile and routes directly to
  `/brand`; product, mood, budget, and deliverable setup no longer run during
  Brand signup.
- Incomplete Brand accounts now resume at `/brand/onboarding`, which stores only
  Brand profile metadata; `/brand/product` and `/brand/mood` redirect to
  `/brand/promotions/new`.
- Brand Promotion creation now calls `/api/v1/analyses/product` instead of the
  frontend fixture `extractProduct`.
- Removed the fixed demo product URL, fixed work brief, fixed mood tags, and fixed
  budget/deliverable defaults from the active Promotion wizard. The user must
  confirm product/category/work/mood/deliverable/budget inputs before negotiation
  can start.

### Verification

- `cd frontend && npm run typecheck`: passed.
- `cd frontend && npm run lint`: passed.
- `cd frontend && npm run build`: passed.
- `/Users/yewonchoi/Desktop/knot/.venv/bin/pytest backend/tests/test_api_auth.py backend/tests/test_api_promotions.py -q`:
  37 passed, 1 skipped.
