# ExecPlan 27 - Demo Negotiation Tiki-Taka And Promotion Copy

## Scope

Make the final demo show a real negotiation exchange instead of immediate
acceptance, and polish the Brand promotion creation copy so category, content
angle, prohibited claims, and content usage rights feel usable to non-technical
users.

## Source Documents Read

- `docs/00_DOCUMENT_INDEX.md`
- `docs/24_FINAL_DEMO_SCENARIO_AND_SEED.md`
- `docs/IMPLEMENTATION_STATUS.md`
- Existing A2A negotiation tests and route implementation.

## Constraints

- Do not fabricate negotiation messages.
- Keep the longer negotiation path on the real A2A/policy route by making the
  demo initial offer lower than the creator minimum while still within Brand
  max budget.
- Do not reseed Firestore, deploy, fund wallets, change secrets, or create
  on-chain transactions without explicit approval.

## Implementation Steps

1. [x] Confirm the backend already supports real counteroffer A2A flows.
2. [x] Change final demo seed defaults to `2 USDC` contract amount with
   `1 USDC` initial offer.
3. [x] Update final demo runbook to describe
   `OFFER 1 → COUNTER 2 → ACCEPT → ACCEPT`.
4. [x] Make promotion category a fixed user-facing select.
5. [x] Replace abstract mood tags with practical content angle tags.
6. [x] Improve prohibited-claims placeholder and usage-right labels.
7. [x] Increase negotiation message font size and render message text in
   sentence-like lines.
8. [x] Run targeted backend tests, frontend typecheck/lint/tests, frontend
   build, and memory seed dry-run.
9. [x] Deploy Web and reseed Firestore after approval.
10. [x] Verify deployed Agent run and identify stale Creator Agent policy cache
    as the reason the first deployed verification still accepted `1 USDC`.
11. [x] Fix Creator Agent policy context refresh for embedded A2A metadata and
    Firestore resolver contexts.

## Verification

- `npm --prefix frontend run typecheck`: passed.
- `npm --prefix frontend run lint`: passed.
- `npm --prefix frontend run test`: 21 passed.
- `npm --prefix frontend run build`: passed.
- `./.venv/bin/pytest backend/tests/test_final_demo_seed.py backend/tests/test_api_promotions.py::test_start_negotiation_uses_saved_initial_offer_for_counter_flow -q`:
  2 passed.
- `PYTHONPATH=backend ./.venv/bin/python scripts/seed_xexymix_final_demo.py --target memory --reset-demo`:
  passed, generated 155 documents and contract amount `2 devnet USDC`.
- `ALLOW_DEVNET_DEMO_SEED=true PYTHONPATH=backend ./.venv/bin/python scripts/seed_xexymix_final_demo.py --target firestore --project knot-dev-503505 --reset-demo --confirm=SEED_KNOT_XEXYMIX_FINAL_DEMO`:
  passed, generated 155 documents and 30 creator discovery profiles.
- Web deployed from `ee512e2` to Cloud Run revision `knot-web-00021-8cq`.
- Initial deployed verification found the remaining issue:
  `OFFER 1 → ACCEPT 1`, caused by stale Creator Agent policy cache.
- `./.venv/bin/pytest backend/tests/test_a2a_negotiation.py backend/tests/test_api_a2a_http_integration.py backend/tests/test_api_promotions.py::test_start_negotiation_uses_saved_initial_offer_for_counter_flow -q`:
  17 passed after the cache refresh fix.

## Pending

- Deploy the Creator Agent cache refresh fix.
- Reseed Firestore again if a clean final demo state is needed after
  verification runs.
- Re-run deployed Agent-run verification and confirm
  `OFFER 1 → COUNTER 2 → ACCEPT → ACCEPT`.
