# KNOT v1 Implementation Status

Update this file at the end of every task.

## Current milestone

`M4 complete + escrow lock/release API + devnet deploy — on-chain milestone settlement verified; frontend scaffolded`

## Service status

| Area | Status | Last verified | Notes |
|---|---|---|---|
| frontend | Scaffolded (v1 audit screens) | 2026-07-25 | Next 16 + TS + Tailwind 4; typed client for all 19 routes; demo fixture provider; brand/creator dashboards, Promotion wizard, negotiation theater, public replay, Agent Society Map, in-app notifications; build/tsc/lint green, 9 routes smoke-tested. Experience spec: docs/23_EXPERIENCE_PRD_v2.md. FE handoff: docs/HANDOFF_FE.md |
| knot-api | Escrow lock/release API added | 2026-07-25 | Full flow Promotion→match→negotiate→agreement→evidence→escrow lock/release wired to the repository boundary; escrow receipts are SIMULATED pending on-chain signing |
| creator A2A service | M2 negotiation baseline | 2026-07-24 | A2A send/stream/tasks/cancel endpoints backed by in-memory task store |
| web3 gateway | Lock validation (SIMULATED) | 2026-07-25 | Validates lock requests, idempotent simulated receipts; config defaults point at the deployed program id and devnet USDC mint |
| Anchor program | Deployed to devnet | 2026-07-25 | `Aj63B5hLtvJdNQiAi61rMrgfW3pt8Lak3GQB59B6jysj`; on-chain milestone settlement verified — agent releases USDC within cap with no human. Duplicate no-op `web3/program` stub removed; only `programs/knot-escrow` remains |
| Terraform/GCP | project switch pending | 2026-07-25 | Target project is `knot-dev-503505`; Firestore/API/IAM/Cloud Run must be re-checked/created in this project (earlier `knot-dev-gcp` verification is obsolete) |
| end-to-end demo | settlement leg proven on devnet | 2026-07-25 | on-chain escrow settlement verified; full app→chain wiring, pay.sh flow, frontend↔live API and Cloud Run remain |

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
cd frontend && build/tsc/lint: green (per FE handoff); 9 routes smoke-tested.
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
- **Merged `be` and `hyo/blockchain-setup` into `main`** through `integrate/be-blockchain` (PR #1). Unified `backend/pyproject.toml`; disabled the anchorpy pytest plugin (`-p no:pytest_anchorpy`) that imports the removed `pytest_xprocess`; fixed lint/type issues surfaced by the merge.
- **Added escrow lock/release API** (`/agreements/{id}/escrow:lock`, `/escrows/{id}`, `/escrows/{id}/milestones/{mid}:release`, `/transaction-receipts/{id}`) with `libs/payments/settlement.py` (fee 0 → lock == payable fixed amount), termsHash re-check, autoEscrow/autoRelease gates, evidence-passed precondition, PaymentOperation + IdempotencyRecord + audit, and idempotent replay. Receipts are SIMULATED as a seam for real signing. 14 new tests.
- Refactored the escrow routes (shared idempotency/receipt/operation helpers; reuse of `canonical_json`/`sha256_prefixed`; release reads the stored milestone split) with no behavior change.
- **Installed the Solana/Anchor toolchain and deployed the program to devnet.** The original `Hv74…` program keypair was gitignored/unavailable, so `anchor keys sync` adopted the built keypair id `Aj63…`; propagated it across `declare_id`, `Anchor.toml`, `pdas.py`, backend `Settings`, gateway config, and `.env.example`.
- **anchorpy 0.21 cannot parse anchor 1.x's new IDL format**, so `test_escrow_devnet.py` builds instructions with solders directly instead of `knot.escrow.client.load_program`. It reuses the singleton config's treasury/mint so it is repeatable.
- Removed the duplicate no-op Anchor workspace `web3/program`; the only retained Anchor workspace is `programs/knot-escrow`.
- Switched the GCP target project to `knot-dev-503505`; earlier Firestore live verification in the previous dev project is obsolete and must be re-run there.
- Normalized docs so Product/API/Firestore/frontend terminology is Promotion; current Anchor `campaign` names are documented as legacy on-chain API names only.
- Added `docs/23_EXPERIENCE_PRD_v2.md` (onboarding/hatching/expedition/replay/dashboards experience layer, tiered against the 8/3 gates) and scaffolded `frontend/` per AGENTS.md stack rules; user-visible copy audited for canonical "Promotion" terminology; SIMULATED receipts render without fabricated explorer links.

## Known blockers / open items

- Escrow API receipts are SIMULATED — real Solana signing, RPC submission, Secret Manager access, and transaction persistence still to wire to the deployed program.
- GCP project switch to `knot-dev-503505` is not verified yet; rerun gcloud auth, ADC quota project, API enablement, Firestore Native check/create, IAM/service accounts and seed/smoke.
- Terraform, Artifact Registry, Cloud Run services, Cloud Build and runtime service accounts are not configured yet in `knot-dev-503505`.
- pay.sh flow-1 (agent-paid API verification) is not yet wired into the Brand Agent matching flow; sandbox resource not selected.
- Frontend is scaffolded against demo fixtures; wiring to the live API and Cloud Run deploy remain.
- `knot.escrow.client` (anchorpy) is broken against anchor 1.x IDL until anchorpy supports the new format or the client is ported to solders.

## Next task

Bootstrap Firestore/IAM/Cloud Run in `knot-dev-503505`, then wire the escrow API's SIMULATED receipts to the deployed devnet program (real signing — decide Python-direct vs TS gateway) and the frontend to the live API, then connect pay.sh flow-1.
