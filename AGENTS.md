# KNOT Repository Instructions

## Source of truth

Before changing code, read:

1. `docs/01_PRD_v1.md`
2. `docs/02_SCOPE_GLOSSARY.md`
3. `docs/03_SYSTEM_ARCHITECTURE.md`
4. The task-specific document listed in `docs/00_INDEX.md`

For multi-service, multi-day, or architecture-changing work, create or update an execution plan in `PLANS.md` before implementation.

## Non-negotiable constraints

- This is KNOT **v1**.
- Do not implement onboarding. Use seed data and demo accounts.
- Use `Promotion` / `promotionId`; do not introduce legacy initiative terms in new code.
- All off-chain runtime and deployment must use Google Cloud services.
- Frontend: Next.js + TypeScript, deployed to Cloud Run when frontend work starts. The `frontend/` directory may be intentionally empty before that milestone.
- Backend and agents: Python + FastAPI + Google ADK + Vertex AI Gemini, deployed to Cloud Run.
- A2A: official A2A Protocol v1.0, HTTP+JSON binding, official Python SDK where possible.
- Database: Firestore in Native mode.
- Web3 gateway: TypeScript service on private Cloud Run; Solana program: Anchor/Rust on devnet.
- Never expose a private key, seed phrase, service-account JSON, API token, or secret in source, logs, tests, fixtures, or documentation.
- LLM output cannot authorize payments. Deterministic policy checks and the web3 gateway must approve every lock or release.
- Do not make unrelated refactors or expand scope.

## Repository layout

- `frontend/`: reserved for the Next.js web application; currently empty until frontend work starts
- `backend/`: Product API, Brand Agent, Creator A2A server, shared Python libraries
- `web3/`: private transaction gateway and Anchor program
- `docs/`: product and engineering source of truth
- `infra/` and `scripts/`: add only when deployment, seed, reset, or smoke-test implementation starts
- External prompt files may be used during a task, but prompt originals are not tracked in this repository unless explicitly requested.

## Commit rules

- Do not run `git commit` or `git push` until the user explicitly approves it for the current change set.
- Before asking for commit approval, summarize the staged or intended files and the validation result.
- Commit messages must start with the domain touched: `frontend:`, `backend:`, `web3:`, `docs:`, `infra:`, or `chore:`.
- For cross-domain changes, use the main domain first and mention the secondary domain in the subject or body.
- Keep the subject imperative and specific, for example `backend: add policy decision models` or `docs: record M0 repository cleanup`.

## Required verification

Run the relevant checks before declaring completion:

- Frontend: typecheck, lint, unit tests, production build when frontend files exist
- Backend: Ruff, mypy/pyright if configured, pytest
- Web3 gateway: typecheck, lint, tests
- Anchor: format, build, tests against local validator
- Integration: Firestore emulator and local Solana validator where applicable
- Any API/schema change: update docs and contract tests

## Definition of done

A task is done only when:

- acceptance criteria are met,
- tests pass,
- no secrets are introduced,
- deployment/config changes are documented,
- `docs/20_IMPLEMENTATION_STATUS.md` is updated,
- remaining risks are stated explicitly.
