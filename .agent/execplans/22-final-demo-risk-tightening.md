# ExecPlan 22 - Final Demo Risk Tightening

## Scope

Reduce final judging/demo risks without changing the MVP product boundary:

- Make pay.sh/x402 verification visible in the Agent negotiation view from the stored MatchRun payment receipt.
- Add a server-side Brand run orchestration endpoint so the UI does not depend on a browser-side sequence for MatchRun plus A2A negotiation.
- Display Agreement money state from the escrow/settlement aggregate when that aggregate is more current than the Agreement projection.
- Update implementation status after verification.

## Source Documents Read

- `docs/00_DOCUMENT_INDEX.md`
- `docs/KNOT_PRODUCT_MASTER_SPEC_FINAL.md`
- `docs/05_DASHBOARD_AND_LIVE_AGENT_RUN_UX.md`
- `docs/09_A2A_NEGOTIATION_PROTOCOL.md`
- `docs/12_PAYSH_X402_PAID_VERIFICATION.md`
- `docs/13_AGREEMENT_ESCROW_EVIDENCE_SETTLEMENT.md`
- `docs/15_GCP_ARCHITECTURE_DEPLOYMENT_OBSERVABILITY.md`
- `docs/16_TEST_ACCEPTANCE_AND_DEMO.md`
- `docs/IMPLEMENTATION_STATUS.md`

## Implementation Steps

1. [x] Add backend helpers for a canonical promotion agent-run response.
2. [x] Add `POST /api/v1/brand/promotions/{promotion_id}/agent-run` that creates/reuses a MatchRun, then starts or reuses the persisted negotiation when a selected candidate exists.
3. [x] Project `matchRun.paidVerification` into `/negotiations/{id}/messages` as a neutral system message with visible amount, mode, receipt, and continuation.
4. [x] Render verification events as neutral cards in `NegotiationDetail`.
5. [x] Adjust promotion/agreement UI labels to prioritize escrow state when Agreement projection is stale.
6. [x] Add targeted backend/frontend tests.
7. [x] Update `docs/IMPLEMENTATION_STATUS.md`.
8. [x] Add pay.sh CLI fallback to `npx -y @solana/pay` and verify an actual sandbox call before deployment.

## Verification

- `./.venv/bin/python -m ruff check backend/apps/api/routes.py backend/tests/test_api_promotions.py`: passed.
- `./.venv/bin/pytest backend/tests/test_api_promotions.py backend/tests/test_paysh_sandbox.py backend/tests/test_api_a2a_http_integration.py -q`: 35 passed, 2 skipped.
- `npx -y @solana/pay --sandbox curl https://debugger.pay.sh/mpp/quote/AAPL`: passed.
- `./.venv/bin/pytest backend/tests/test_api_promotions.py::test_run_match_pays_a_real_paysh_sandbox_call -q -rs`: 1 passed.
- `./.venv/bin/pytest backend/tests -q`: 167 passed, 6 skipped.
- `npm --prefix frontend run typecheck`: passed.
- `npm --prefix frontend run lint`: passed.
- `npm --prefix frontend test -- --runInBand`: 21 passed.
- `npm --prefix frontend run build`: passed.

## Live Deployment Link Verification

- Deployed Web routes checked with `curl -L`: `/login`, Brand dashboard/promotions/promotion detail/negotiation detail/agreement detail, and Creator dashboard/offers/offer detail/agreements/settlements all returned 200.
- Deployed `/readyz` returned 200 for `knot-api`, `knot-web3`, and `knot-creator-agent`.
- Firebase sign-in succeeded for the Brand and Creator demo accounts.
- Authenticated deployed API smoke returned 200 for Brand and Creator dashboard/detail data, negotiation messages, and devnet Agreement escrow.
- Deployed Web proxy API smoke returned 200 for representative authenticated Brand/Creator API paths.
- Deployed API and Web proxy both returned 404 for `POST /api/v1/brand/promotions/{promotion_id}/agent-run`, so the server-side Agent run endpoint added in this phase is not live yet.
- Deployed XEXYMIX negotiation messages currently contain OFFER, COUNTER, and ACCEPT only; no pay.sh `VERIFICATION_EVENT` system message is live yet.
- Playwright CLI screenshot against the deployed login page was attempted but hung for over 60 seconds in this executor and was stopped.

## Non-goals

- No deployment.
- No IAM, Secret Manager, wallet funding, program deployment, or new on-chain transaction.
- No claim that pay.sh sandbox receipt is a Solana transaction.
