# KNOT v1 Implementation Status

Update this file at the end of every Codex task.

## Current milestone

`M2 — A2A negotiation baseline implemented`

## Service status

| Area | Status | Last verified | Notes |
|---|---|---|---|
| frontend | deferred | 2026-07-24 | Folder kept empty by request |
| knot-api | M2 agent orchestration baseline | 2026-07-24 | Pure Brand Agent selection, initial terms, and A2A offer request helpers |
| creator A2A service | M2 negotiation baseline | 2026-07-24 | A2A send/stream/tasks/cancel endpoints backed by in-memory task store |
| web3 gateway | skeleton initialized | 2026-07-24 | TypeScript Express health/version and lock stub |
| Anchor program | skeleton initialized | 2026-07-24 | Minimal Anchor workspace |
| Terraform/GCP | not started | - | No infra files committed yet |
| end-to-end demo | not started | - | |

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
Escrow program: unset
```

## Latest validation

```text
.venv/bin/python -m ruff check backend: passed.
.venv/bin/python -m pytest backend/tests: passed, 22 tests, with one FastAPI/Starlette deprecation warning from TestClient.
.venv/bin/python -m mypy backend/apps backend/libs: passed.
web3 gateway lint/test/build were not rerun in this M2 backend-only task.
```

## Decisions made during implementation

- Imported the v1 source-of-truth documentation into `docs/`.
- Kept external prompt files out of the repository per current working instruction.
- Renamed `config/env.example` to root `.env.example`.
- Treated `frontend`, `backend`, and `web3` as the three primary code areas; `infra` and `scripts` will be added only when needed.
- Removed unused `@solana/web3.js` from the M0 gateway skeleton; add it back when real Solana RPC/signing code starts.
- Added commit rules to `AGENTS.md`, including domain-prefixed commit messages and mandatory user approval before committing.
- Added typed Promotion, CreatorProfile, AgentPolicy, AgreementTerms, compensation, deliverable, milestone, and policy decision models.
- Added pure Brand and Creator policy functions with deterministic violation codes.
- Added deterministic creator matching with hard filters, weighted score `matching-v1`, rank assignment, and stable tie-break.
- Expanded creator fixtures and added `matching_golden.json` for backend golden tests.
- Added A2A v1 request, message, part, task, status, artifact, and negotiation payload models.
- Added in-memory A2A task store with `messageId` idempotency, task/context consistency, terminal task rejection, task listing, lookup, subscribe, and cancel support.
- Extended Creator Agent service from placeholder response to deterministic creator-policy negotiation decisions.
- Added Brand Agent pure orchestration helpers for top creator selection, initial terms construction, and A2A offer request construction.
- Added deterministic `termsHash` helper for accepted A2A artifacts; deeper agreement/payment hashing remains part of the next payment milestone.

## Known blockers

- GCP project ID not configured.
- Devnet program ID and mint not configured.
- pay.sh sandbox resource not selected.

## Next task

Implement M3 agreement hashing integration and Solana devnet escrow lock skeleton without real signer secrets.
