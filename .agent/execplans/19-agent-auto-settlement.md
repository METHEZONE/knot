# 19 Agent Auto Settlement

## Scope

- Explain and fix the localhost escrow 409 path by distinguishing Web3 Gateway configuration failure from A2A negotiation failure.
- Add server-side Agent settlement automation behind `KNOT_AGENT_AUTO_SETTLEMENT`.
- Preserve deterministic authorization: Agent/Gemini may observe, but escrow lock and release remain policy- and gateway-gated.

## Plan

1. Add a backend setting for Agent settlement automation.
2. Enable that setting by default in the local dev stack.
3. On Agreement creation, let the Brand Agent attempt escrow lock with an idempotency key.
4. On passed evidence verification, let the Brand Agent attempt milestone release with an idempotency key.
5. Return automation results without fabricating success when gateway or policy checks fail.
6. Adjust the detail UI so it does not duplicate a release already completed by the Agent.
7. Add focused tests for automatic lock and automatic release.

## Verification

- `python -m pytest backend/tests/test_api_escrow.py -q` passed.
- `python -m pytest backend/tests/test_api_promotions.py backend/tests/test_api_a2a_http_integration.py backend/tests/test_api_escrow.py -q` passed.
- `npm run typecheck` passed in `frontend`.
- `npm run lint` passed in `frontend`.
- `npm run build` passed in `frontend`.
