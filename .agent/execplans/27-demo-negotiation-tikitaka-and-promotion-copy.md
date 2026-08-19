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

## Verification

- `npm --prefix frontend run typecheck`: passed.
- `npm --prefix frontend run lint`: passed.
- `npm --prefix frontend run test`: 21 passed.
- `npm --prefix frontend run build`: passed.
- `./.venv/bin/pytest backend/tests/test_final_demo_seed.py backend/tests/test_api_promotions.py::test_start_negotiation_uses_saved_initial_offer_for_counter_flow -q`:
  2 passed.
- `PYTHONPATH=backend ./.venv/bin/python scripts/seed_xexymix_final_demo.py --target memory --reset-demo`:
  passed, generated 155 documents and contract amount `2 devnet USDC`.

## Pending Approval

- Firestore reset/reseed is still pending explicit approval.
- Web deployment is still pending explicit approval.
