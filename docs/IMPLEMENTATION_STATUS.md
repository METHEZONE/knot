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
- `anchor test`: build phase passed, devnet deploy phase failed because the configured upgrade authority has no credited SOL account.
- `anchor test --skip-deploy`: build phase passed, then Anchor.toml test script failed because `/opt/homebrew/opt/python@3.14/bin/python3.14` has no `pytest` module; the repository `.venv` pytest command below passed.
- `npm --prefix web3/gateway run build`: passed.
- `npm --prefix web3/gateway run lint`: passed.
- `npm --prefix web3/gateway test`: passed.
- `npm --prefix frontend run typecheck`: passed.
- `npm --prefix frontend run lint`: passed.
- `npm --prefix frontend run build`: passed.
- `./.venv/bin/pytest backend/tests/test_api_auth.py backend/tests/test_api_escrow.py -q`: 27 passed.
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

- No devnet program deployment or on-chain funding/release transaction was executed in this phase.
- Devnet smoke still requires funded deployment/settlement signer SOL and Brand Phantom devnet USDC/SOL.
