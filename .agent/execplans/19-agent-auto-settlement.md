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

- `bash -n scripts/local/dev_stack.sh` passed after forcing local demo A2A back to HTTP when `.env.local` contains `KNOT_CREATOR_A2A_MODE=local`.
- `python -m ruff check backend/apps/api/routes.py backend/tests/test_api_promotions.py` passed.
- `python -m pytest backend/tests/test_api_promotions.py backend/tests/test_api_a2a_http_integration.py backend/tests/test_api_escrow.py -q` passed with 44 tests.
- `npm --prefix frontend run lint` passed.
- `npm --prefix frontend run typecheck` passed when run after the production build completed.
- `npm --prefix frontend run build` passed.
- `bash -n scripts/deploy_cloud_run_demo.sh` passed after wiring Web3 Gateway deployment into the release script.
- `python -m pytest backend/tests/test_api_escrow.py -q` passed.
- `python -m pytest backend/tests/test_api_promotions.py backend/tests/test_api_a2a_http_integration.py backend/tests/test_api_escrow.py -q` passed.
- `npm run typecheck` passed in `frontend`.
- `npm run lint` passed in `frontend`.
- `npm run build` passed in `frontend`.
- `npm test` passed in `web3/gateway` with 12 tests.
- `npm run build` passed in `web3/gateway`.
- `npm run lint` passed in `web3/gateway`.
- `python -m pytest backend/tests/test_api_escrow.py backend/tests/test_api_promotions.py backend/tests/test_api_a2a_http_integration.py backend/tests/test_api_dashboards.py -q` passed with 50 tests.
- `scripts/local/settlement_smoke.sh` passed against Solana localnet with Agent auto-lock and auto-release:
  - Agreement `agreement-0ab12d48-e76a-4175-afed-aa72d893e631`
  - Negotiation `negotiation-229dd677-e7ca-4d51-be2b-1a720c31d5c5`
  - Escrow `escrow-39f81b07-ba5b-468f-a934-431b69932e5a`
  - Escrow lock signature `37VZrWZV5YGz56Q2AAeuBC52z1fmADZBKVcN7CXPPALCW5mBZzNnwnnGMjxdcYqu31pzNaBkMdc3EUimREn48JcF`
  - Release signature `4hi1QBNKbVgSQoAwiSDeEjHTotVj2eLpeVyRJ8WLzb5yoyCKajQBwQQMf3PXxZ5UczrmMhVnZ51TWsCnczVEHfrB`
  - Creator wallet `BTUfxMqG5HZ3XLvfXwgPb514Cbhf2e5xMGYyXPNG8dtr` received 650 USDC localnet test tokens.
- Local Firebase Auth emulator demo accounts created:
  - Brand: `t1@knot.com` / `000000`
  - Creator: `c1@knot.com` / `000000`

## A2A Detail Follow-up

- Local `dev_stack.sh` now refuses to run the demo in in-process Creator Agent mode; if `.env.local` says `KNOT_CREATOR_A2A_MODE=local`, the script exports `KNOT_CREATOR_A2A_MODE=http`.
- Negotiation documents now persist public `brandSnapshot`, `creatorSnapshot`, and `promotionSnapshot` data so Brand and Creator detail pages show the actual counterparty profile and agreed work.
- Negotiation messages now persist `transport` and `a2aEndpoint`; the detail UI exposes those fields plus the stored A2A payload for each message.
- Local smoke after this fix used Product API -> Creator Agent HTTP A2A and Agent auto settlement:
  - Agreement `agreement-f6fefb03-cde8-4154-9482-44f88ec0a19f`
  - Negotiation `negotiation-1a78cf83-27e9-41c1-90f1-710a0012aa59`
  - Escrow `escrow-ef92462e-cbd1-4529-ba38-edb205b79116`
  - Escrow lock signature `BJb3coUxfi7xx1bVmvDTYLHnMCPALFaKToCjr5msEkr5SitKAzguwYDpRC5dfbXYsDpBbk7yaYNAs2SxLajMu5x`
  - Release signature `4wfyk12ZZjfT5x4chAGhsid22WCmxMe675RhpmPncRqHo7kx7Q3DgWiMuj1F2uFE7E4VL5raSsGcf2hp5GKGMH4G`
  - Message API confirmed `transport: HTTP_A2A` and `a2aEndpoint: http://127.0.0.1:8081/a2a/v1` on both stored messages.

## Deployment Script Fix

- `scripts/deploy_cloud_run_demo.sh` now deploys `knot-web3` instead of leaving the gateway out of the release path.
- Product API deployment now sets `KNOT_WEB3_MODE=gateway`, `WEB3_GATEWAY_BASE_URL`, `KNOT_AGENT_AUTO_SETTLEMENT=1`, and the same `KNOT_ESCROW_PROGRAM_ID` / `KNOT_USDC_MINT` values as the Web3 Gateway.
- The script now requires `PAYSH_RESOURCE_ID` instead of silently deploying `replace-me`.
- The shared demo target is now Solana testnet: `SOLANA_CLUSTER=testnet`, `SOLANA_RPC_URL=https://api.testnet.solana.com`, `KNOT_ESCROW_NETWORK=solanaTestnet`, and `KNOT_WEB3_SIGNING_MODE=testnet`.
- In live signing mode, Web3 Gateway deployment requires Secret Manager entries for `KNOT_BRAND_KEYPAIR_JSON`, `KNOT_CREATOR_KEYPAIR_JSON`, and `KNOT_AGENT_KEYPAIR_JSON`.
- Testnet deployment requires explicit `KNOT_ESCROW_PROGRAM_ID` and `KNOT_USDC_MINT`; the script no longer reuses devnet defaults.

## Deployment Blockers

- Current Cloud Run `knot-web3` is configured with `KNOT_WEB3_SIGNING_MODE=simulated`, so Product API correctly rejects the receipt.
- Secret Manager currently has only `knot-a2a-service-token`; no Web3 signer/pay.sh secrets are available.
- Testnet still needs a deployed escrow program, initialized config, funded signer wallets, and the selected testnet SPL mint before live Cloud Run lock/release can be claimed.
