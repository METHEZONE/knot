# Phase 15 - Onboarding Dashboard Handoff and Counter A2A Visibility

## Goal

Fix the post-onboarding dashboard transition and make newly-created brand promotions produce a visible A2A counteroffer path when the initial offer is below the creator policy floor.

## Scope

- Refresh authenticated profile state after final brand and creator onboarding writes.
- Preserve the two-user-session visual flow and dashboard/detail split.
- Use the saved Promotion `initialOffer` as the first A2A offer amount.
- Keep local A2A task state alive across the counter/accept exchange.
- Add a backend regression test for OFFER -> COUNTER -> ACCEPT -> ACCEPT.

## Non-goals

- No main branch changes.
- No production deployment.
- No wallet funding, on-chain transaction, IAM, or secret changes.
- No mock-success fallback.

## Implementation Notes

- Brand and creator onboarding now call `refresh()` before replacing the route with `/brand` or `/creator`.
- Brand promotion creation lowers the default first offer to 40% of max per creator, rounded to 50 USDC, so policy negotiation is visible in the demo path.
- Product API reads persisted `initialOffer` from the promotion document and passes it into `build_initial_terms`.
- Local A2A mode now retains an in-memory task store per negotiation context so a countered task can receive the brand accept message.

## Verification

- `cd frontend && npm run typecheck`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `.venv/bin/python -m pytest backend/tests/test_api_promotions.py::test_start_negotiation_persists_messages_events_and_agreement backend/tests/test_api_promotions.py::test_start_negotiation_uses_saved_initial_offer_for_counter_flow backend/tests/test_api_a2a_http_integration.py backend/tests/test_api_escrow.py backend/tests/test_escrow_devnet.py -q`

## Status

- [x] Onboarding dashboard handoff fixed.
- [x] Saved initial offer wired into real A2A offer terms.
- [x] Local A2A counter continuation fixed.
- [x] Regression test added.
- [x] Phase checks passed.
