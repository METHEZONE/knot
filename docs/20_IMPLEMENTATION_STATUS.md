# KNOT v1 Implementation Status

Update this file at the end of every task.

## Current milestone

`M4 complete + escrow lock/release API + devnet deploy — on-chain milestone settlement verified`

## Service status

| Area | Status | Last verified | Notes |
|---|---|---|---|
| frontend | deferred | 2026-07-25 | Folder kept empty by request; Society Map + Timeline still to build |
| knot-api | Escrow lock/release API added | 2026-07-25 | Full flow Promotion→match→negotiate→agreement→evidence→escrow lock/release wired to the repository boundary; escrow receipts are SIMULATED pending on-chain signing |
| creator A2A service | M2 negotiation baseline | 2026-07-24 | A2A send/stream/tasks/cancel endpoints backed by in-memory task store |
| web3 gateway | Lock validation (SIMULATED) | 2026-07-25 | Validates lock requests, idempotent simulated receipts; config defaults point at the deployed program id and devnet USDC mint |
| Anchor program | Deployed to devnet | 2026-07-25 | `Aj63B5hLtvJdNQiAi61rMrgfW3pt8Lak3GQB59B6jysj`; on-chain milestone settlement verified — agent releases USDC within cap with no human |
| Terraform/GCP | Firestore Native configured | 2026-07-24 | `knot-dev-gcp` has Firestore API enabled and `(default)` Native database in `us-central1`; infra files not committed yet |
| end-to-end demo | settlement leg proven on devnet | 2026-07-25 | on-chain escrow settlement verified; full app→chain wiring, pay.sh flow, frontend and Cloud Run remain |

## Contract versions

```text
Product API: v1
A2A: 1.0
Negotiation payload: knot.negotiation.v1
Agreement payload: knot.term-sheet.v1
Matching weights: matching-v1
Brand policy: brand-policy-v1
Creator policy: creator-policy-v1
Evidence policy: verification-v1
Escrow program: Aj63B5hLtvJdNQiAi61rMrgfW3pt8Lak3GQB59B6jysj (Solana devnet)
Devnet USDC-SPL mint: 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
```

## Latest validation

```text
python -m ruff check backend: passed.
python -m mypy backend/apps backend/libs: passed, 38 source files.
python -m pytest backend/tests: 59 passed, 4 skipped (firestore-emulator + devnet gated; pay.sh sandbox smoke runs when the `pay` CLI is present).
cd web3/gateway && npm run lint / npm test / npm run build: passed, 5 tests.
anchor build: passed; target/idl/knot_escrow.json generated.
anchor deploy (devnet): deployed program Aj63…; program account rent-exempt ~2.035 SOL (recoverable via `solana program close`).
KNOT_RUN_DEVNET=1 pytest backend/tests/test_escrow_devnet.py: 1 passed — real on-chain milestone settlement (agent released 0.7 USDC to the creator within cap; Reputation.total_settled updated).
```

## Decisions made during implementation

- Imported the v1 source-of-truth documentation into `docs/`.
- Kept external prompt files out of the repository per current working instruction.
- Renamed `config/env.example` to root `.env.example`.
- Treated `frontend`, `backend`, and `web3` as the three primary code areas; `infra` and `scripts` will be added only when needed.
- Added commit rules to `AGENTS.md`, including domain-prefixed commit messages and mandatory user approval before committing.
- Added typed domain models, deterministic Brand/Creator/Evidence policy functions, `matching-v1` scoring, A2A v1 models, an in-memory A2A task store with idempotency, and deterministic `termsHash`.
- Added the Firestore-compatible `DocumentStore`, in-memory + adapter implementations, path helpers, serialization, demo seed, and gated emulator integration tests.
- Added Product API routes for Promotion, match run, negotiation, agreement, evidence, and the Promotion timeline; kept Gemini out of every authorization boundary (deterministic placeholders).
- Enabled Firestore Native in `knot-dev-gcp` and verified real seed/readback.
- **Merged `be` and `hyo/blockchain-setup` into `integrate/be-blockchain`** (PR #1). Unified `backend/pyproject.toml`; disabled the anchorpy pytest plugin (`-p no:pytest_anchorpy`) that imports the removed `pytest_xprocess`; fixed lint/type issues surfaced by the merge.
- **Added escrow lock/release API** (`/agreements/{id}/escrow:lock`, `/escrows/{id}`, `/escrows/{id}/milestones/{mid}:release`, `/transaction-receipts/{id}`) with `libs/payments/settlement.py` (fee 0 → lock == payable fixed amount), termsHash re-check, autoEscrow/autoRelease gates, evidence-passed precondition, PaymentOperation + IdempotencyRecord + audit, and idempotent replay. Receipts are SIMULATED as a seam for real signing. 14 new tests.
- **Installed the Solana/Anchor toolchain and deployed the program to devnet.** The original `Hv74…` program keypair was gitignored/unavailable, so `anchor keys sync` adopted the built keypair id `Aj63…`; propagated it across `declare_id`, `Anchor.toml`, `pdas.py`, backend `Settings`, gateway config, and `.env.example`.
- **anchorpy 0.21 cannot parse anchor 1.x's new IDL format**, so `test_escrow_devnet.py` builds instructions with solders directly instead of `knot.escrow.client.load_program`. It reuses the singleton config's treasury/mint so it is repeatable.

## Known blockers / open items

- Escrow API receipts are SIMULATED — real Solana signing, RPC submission, Secret Manager access, and transaction persistence still to wire to the deployed program.
- Terraform, Artifact Registry, Cloud Run services, Cloud Build and runtime service accounts are not configured yet.
- pay.sh flow-1 (agent-paid API verification) is not yet wired into the Brand Agent matching flow.
- Frontend (Agent Society Map, Promotion Timeline) not started.
- `knot.escrow.client` (anchorpy) is broken against anchor 1.x IDL until anchorpy supports the new format or the client is ported to solders.

## Next task

Wire the escrow API's SIMULATED receipts to the deployed devnet program (real signing path — decide Python-direct vs TS gateway), then connect pay.sh flow-1, then Cloud Run deploy and the frontend.
