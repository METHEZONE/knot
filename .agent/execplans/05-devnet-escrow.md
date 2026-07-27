# Phase 5 Devnet Escrow Lock And Release

## Goal
Connect Agreement funding and milestone release to the restricted Web3 Gateway boundary so Product API no longer treats simulated receipts as successful escrow execution.

## Current Behavior
- Agreement creation already stores canonical terms JSON and `termsHash`.
- Product API has lock, evidence, verify, release, receipt, PaymentOperation, audit, and idempotency records.
- Web3 Gateway can run in `simulated` or `devnet` signing mode.
- Product API still creates successful `SIMULATED` receipts when `KNOT_WEB3_MODE` is not `gateway` or when gateway signing is simulated.

## In Scope
- Require Web3 Gateway for escrow lock/release success.
- Require `CONFIRMED` gateway receipt with real signature and matching Agreement/Escrow/mint/program/network/termsHash fields.
- Persist failed PaymentOperation and TransactionReceipt records for gateway unavailable or non-confirmed receipt cases.
- Keep deterministic termsHash, amount, milestone split, evidence gate, and idempotency checks.
- Keep Creator evidence submission and deterministic verification.
- Update frontend copy so simulated receipt is not presented as a successful MVP path.
- Add focused backend and Web3 gateway tests.

## Out of Scope
- Mainnet, real-value transfer, wallet funding, IAM, Secret Manager changes, and program deployment.
- Running devnet smoke transactions unless safe local devnet credentials are already configured.
- Dev Admin.

## Files and Symbols
- `backend/apps/api/routes.py`: lock/release success criteria, failure persistence.
- `backend/tests/test_api_escrow.py`: confirmed gateway, idempotency, evidence, failure tests.
- `frontend/src/product/ProductScreens.tsx`: escrow action copy.
- `web3/gateway/tests/escrow-lock.test.ts`: gateway boundary behavior.
- `docs/IMPLEMENTATION_STATUS.md`, `docs/HANDOFF.md`.

## Data Migration
No migration.

Existing simulated receipt documents are not rewritten. New Product API lock/release calls require confirmed gateway receipts for success.

## Security Considerations
- Browser never receives signer secrets.
- Product API does not print, create, rotate, upload, or persist private keys.
- Devnet smoke is blocked unless existing safe configuration is already present.
- LLM/evidence observations do not authorize release; deterministic verification remains the release gate.

## Milestones
- [x] Read Phase 5 instructions and required docs.
- [x] Create Phase 5 ExecPlan.
- [x] Require confirmed Web3 Gateway receipts.
- [x] Persist failed escrow operation records honestly.
- [x] Update tests and UI copy.
- [x] Run phase tests.
- [x] Review diff.
- [x] Update status and handoff.

## Tests
Planned:

```text
cd backend && ../.venv/bin/python -m ruff check apps libs tests
cd backend && ../.venv/bin/python -m pytest tests/test_api_escrow.py tests/test_settlement.py tests/test_domain_models.py tests/test_api_promotions.py
cd web3/gateway && npm run build
cd web3/gateway && npm run lint
cd web3/gateway && npm run test
cd frontend && npm run typecheck
cd frontend && npm run lint
cd frontend && npm run test
cd frontend && npm run build
```

## Rollback
Revert the Phase 5 commit. No deployment, IAM, Secret Manager, wallet funding, program deployment, or on-chain transaction is performed.

## Progress
- [x] Phase 4 pushed as `a1d7f54`.
- [x] ExecPlan created.
- [x] Product API lock/release now requires `KNOT_WEB3_MODE=gateway`.
- [x] Product API validates gateway receipt status, signature, Agreement/Escrow IDs, amount, mint, program, network, and `termsHash`.
- [x] Product API records `FAILED` TransactionReceipt and PaymentOperation documents for unavailable gateway or invalid/non-confirmed receipts.
- [x] Successful lock/release tests use a mocked confirmed Web3 Gateway boundary.
- [x] Frontend escrow action copy no longer describes simulated receipt as a successful path.
- [x] Devnet smoke configuration was checked without printing secret values.

## Risks
- External Solana devnet smoke is BLOCKED because `KNOT_WEB3_SIGNING_MODE`, `KNOT_ESCROW_PROGRAM_ID`, `KNOT_USDC_MINT`, `SOLANA_RPC_URL`, `KNOT_BRAND_KEYPAIR_JSON`, `KNOT_CREATOR_KEYPAIR_JSON`, and `KNOT_AGENT_KEYPAIR_JSON` are not set in the current process.

## Completion Evidence
Implemented and verified.

Commands:

```text
cd backend && ../.venv/bin/python -m ruff check apps libs tests
cd backend && ../.venv/bin/python -m pytest tests/test_api_escrow.py tests/test_settlement.py tests/test_domain_models.py tests/test_api_promotions.py tests/test_api_resource_routes.py tests/test_health_apps.py
cd web3/gateway && npm run build
cd web3/gateway && npm run lint
cd web3/gateway && npm run test
cd frontend && npm run typecheck
cd frontend && npm run lint
cd frontend && npm run test
cd frontend && npm run build
python3 - <<'PY'
...
PY
```

Results:

- Backend Ruff: passed.
- Backend selected pytest: 39 passed, 1 Starlette/httpx deprecation warning.
- Web3 Gateway build: passed.
- Web3 Gateway lint: passed.
- Web3 Gateway tests: 9 passed, 1 Node `punycode` deprecation warning.
- Frontend typecheck: passed.
- Frontend lint: passed.
- Frontend tests: 12 passed.
- Frontend production build: passed.
- Devnet smoke: BLOCKED by missing safe external configuration; no transaction was sent.

Evidence:

- `tests/test_api_escrow.py` verifies confirmed gateway lock/release, duplicate lock/release idempotency, deterministic evidence gate, local mode rejection, and simulated gateway receipt failure persistence.
- `tests/test_settlement.py` verifies deterministic one-milestone and split amount calculations.
- Web3 gateway tests verify request schema, mint/program allowlist, idempotency replay, and local simulated-mode boundary behavior.
