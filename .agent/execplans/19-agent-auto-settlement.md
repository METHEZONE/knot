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
- `scripts/local/settlement_smoke.sh` passed against Solana localnet with Agent auto-lock and auto-release:
  - Agreement `agreement-ea5fbf12-508c-4c01-b30a-2185168287cb`
  - Escrow lock signature `5t3Fhmqq97xnxzWRX3nJdxTJz2fzRwKsxvscqUrjGU5RWQvuMHfveHN4Qx7yLvLoi8rV7Jewv3pvQ1e7cib9XvQu`
  - Release signature `5tD6e7BHjV5XS8gujtkbzZL556DXXDJvXm4PpTcRhdoQE2GfRH4uu4T9aUejGcy6GCjLbmwgCKo9fVWMhBsL19No`
  - Creator wallet `L2UGwRSz7eXA9w1YoBmmAdYhz4VN5Z6bia6TfYzEBm4` received 650 USDC localnet test tokens.

## Deployment Blockers

- Current Cloud Run `knot-web3` is configured with `KNOT_WEB3_SIGNING_MODE=simulated`, so Product API correctly rejects the receipt.
- Secret Manager currently has only `knot-a2a-service-token`; no Web3 signer/pay.sh secrets are available.
- Existing shared devnet escrow config uses mint `7HrvvAexhUwi8LriqvxNqFJTe13ffDH56wiWbFhueK3p` with mint authority `7yihfmYe4JtjcY3fLsE1Ez2Wm6aTMf4TN3U8xqyz5ebe`, but that keypair is not present locally or in Secret Manager.
- A fresh devnet deploy attempt is blocked by public devnet airdrop rate limits for the generated payer `GX1qtkjR89HXqagZ6x53BfFt4HVnSqWEw9QYxVBKgv6B`.
