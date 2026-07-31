# Phase 14 ExecPlan - Signup, A2A, and Web3 Verification

## Goal

Fix the remaining signup redirect issue and verify the actual operating scope of A2A and Web3/escrow APIs.

## Scope

- Refresh AuthProvider context after signup role selection.
- Send incomplete Brand/Creator users directly to the current reference onboarding entries.
- Smoke-test a fresh Firebase signup and Product API role selection without printing tokens.
- Run HTTP A2A integration tests.
- Run Product API escrow tests and Web3 gateway tests.

## Findings

- Signup race: `selectMyRole` succeeded, but global auth context could still be stale when the next route's `AuthGate` mounted.
- A2A: real HTTP boundary is implemented and verified by a test that starts a separate Creator Agent uvicorn server. The local Product API must be launched with `KNOT_CREATOR_A2A_MODE=http` to use that boundary at runtime.
- Escrow/Web3: Product API escrow state transitions and gateway lock/release API tests pass. Real Solana localnet/devnet execution is gated by `KNOT_RUN_LOCALNET=1` or `KNOT_RUN_DEVNET=1`; it was not executed in this phase.

## Verification

- `cd frontend && npm run typecheck`
- `cd frontend && npm run lint`
- `cd frontend && npm test`
- `cd frontend && npm run build`
- Fresh Firebase signup smoke: role became `BRAND`, onboarding status `PROFILE_REQUIRED`, expected next `/brand/product`.
- `.venv/bin/python -m pytest backend/tests/test_api_a2a_http_integration.py backend/tests/test_api_escrow.py backend/tests/test_escrow_devnet.py -q`
- `cd web3/gateway && npm test`
- `cd web3/gateway && npm run build`
