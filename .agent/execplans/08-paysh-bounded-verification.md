# Phase 8 ExecPlan — Bounded pay.sh Verification

## Goal

Let the Brand Agent optionally purchase one bounded candidate-verification signal through pay.sh/x402 without confusing it with creator compensation escrow and without hiding failure.

## Source Documents

- `docs/00_DOCUMENT_INDEX.md`
- `docs/06_MATCHING_DISCOVERY_AND_RANKING.md`
- `docs/12_PAYSH_X402_PAID_VERIFICATION.md`
- `docs/17_WBS_AND_IMPLEMENTATION_PLAN.md`
- `docs/KNOT_PRODUCT_MASTER_SPEC_FINAL.md`

## Scope

- Audit the existing pay.sh integration.
- Add settings for allowlist, configured quote amount, per-call cap, per-run cap, daily cap, and failure policy.
- Validate allowlist and quote/caps before invoking pay.sh.
- Reuse a deterministic pay.sh operation ID so duplicate idempotent Match Run starts do not double pay.
- Persist pay.sh decisions to `paymentOperations`.
- Persist settled/failed pay.sh attempts to `transactionReceipts` with `paymentType: PAYSH_X402`.
- Keep pay.sh spend separate from escrow and never fabricate a blockchain signature.

## Implementation Notes

- The current MVP verifies only the selected creator path, not Top 3.
- `DISABLED` and `SKIPPED` outcomes do not create a receipt; they create an operation record for explicit audit.
- `SETTLED` and `FAILED` pay.sh attempts create a receipt labeled `network: pay.sh:{mode}`.
- The matching result still uses confirmed internal/free signals when pay.sh is unavailable or blocked by policy.

## Verification

- `../.venv/bin/python -m pytest tests/test_api_promotions.py tests/test_api_escrow.py` from `backend`
- `../.venv/bin/python -m pytest` from `backend`
- `../.venv/bin/python -m ruff check .` from `backend`
- `../.venv/bin/python -m mypy` from `backend`
- `../.venv/bin/python -m pytest tests/test_paysh_sandbox.py` from `backend` skipped because sandbox prerequisites were unavailable
- `npm run typecheck` from `frontend`
- `npm run lint` from `frontend`
- `npm test` from `frontend`
- `npm run build` from `frontend`

## Result

Implemented and verified. No live pay.sh purchase was executed in this phase.
