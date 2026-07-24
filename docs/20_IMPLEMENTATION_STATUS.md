# KNOT v1 Implementation Status

Update this file at the end of every Codex task.

## Current milestone

`M0 — Repository skeleton initialized`

## Service status

| Area | Status | Last verified | Notes |
|---|---|---|---|
| frontend | deferred | 2026-07-24 | Folder kept empty by request |
| knot-api | skeleton initialized | 2026-07-24 | FastAPI health/version and `/api/v1` root |
| creator A2A service | skeleton initialized | 2026-07-24 | FastAPI health/version and AgentCard route |
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
Read and copied selected files from `/Users/yewonchoi/Desktop/docs` into the repository.
Verified prompt originals, `MANIFEST.json`, and OS temporary files were not copied.
Checked tracked candidates for obvious secret material; only placeholders and security guidance were found.
Initialized backend and web3 skeleton files.
Removed frontend implementation files; `frontend/` is intentionally empty.
Removed root Makefile, root npm workspace, placeholder infra files, and placeholder scripts.
Backend ruff: passed.
Backend pytest: passed, with one FastAPI/Starlette deprecation warning from TestClient.
Backend mypy: passed.
Web3 gateway npm install: passed, with an engine warning because the active local Node was v20.13.0 while one transitive ESLint package requests v20.19.0, v22.13.0, or newer.
Web3 gateway lint: passed.
Web3 gateway test: passed.
Web3 gateway build: passed.
Web3 gateway npm audit --audit-level=moderate: passed, 0 vulnerabilities.
.venv/bin/python -m mypy backend/apps backend/libs: passed.
make seed: command exists and reports M0 seed placeholder with 3 creator fixtures.
make demo-smoke: command exists and reports M0 smoke-test placeholder.
npm audit --audit-level=moderate: reports 3 high vulnerabilities from Next's transitive postcss/sharp dependencies; latest stable Next is already pinned and npm's suggested force fix downgrades Next.
```

## Decisions made during implementation

- Imported the v1 source-of-truth documentation into `docs/`.
- Kept external prompt files out of the repository per current working instruction.
- Renamed `config/env.example` to root `.env.example`.
- Treated `frontend`, `backend`, and `web3` as the three primary code areas; `infra` and `scripts` will be added only when needed.
- Removed unused `@solana/web3.js` from the M0 gateway skeleton; add it back when real Solana RPC/signing code starts.
- Added commit rules to `AGENTS.md`, including domain-prefixed commit messages and mandatory user approval before committing.

## Known blockers

- GCP project ID not configured.
- Devnet program ID and mint not configured.
- pay.sh sandbox resource not selected.

## Next task

Install dependencies, verify toolchains, then implement M1 domain models, policy functions, and deterministic matching.
