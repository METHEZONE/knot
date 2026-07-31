# Phase 18 ExecPlan - Agentic Work Summary and Settlement Path

## Goal

Make each promotion/negotiation read like a real creator contract instead of a generic chat replay.

Brand users must be able to specify the actual work in the promotion setup flow with fast numeric controls. Brand and Creator dashboards must summarize who is connected, what work was agreed, and what escrow/settlement state belongs to each negotiation. Negotiation detail pages must show the same work conditions beside the real A2A conversation and milestone release path.

## Source Documents

- `docs/00_DOCUMENT_INDEX.md`
- `docs/KNOT_PRODUCT_MASTER_SPEC_V2.md`
- `docs/05_DASHBOARD_AND_LIVE_AGENT_RUN_UX.md`
- User clarification on 2026-07-31.

## Scope

- Add deliverable count controls to the Brand promotion wizard.
- Persist and project public negotiation/agreement summary fields:
  - connected Creator display name
  - product/promotion name
  - agreed work items
  - deliverable summary
  - current agreed USDC amount
- Keep private brand/creator policy out of public projections.
- Show the agreed work in Brand Agent records, Creator received offers/results, and negotiation detail.
- Make Creator milestone copy explicit about which submitted URLs unlock escrow release.
- Keep Brand character green and Creator character pink across dashboard/profile surfaces.
- Enable new wizard-created promotions to enter the escrow/release path, while still requiring confirmed gateway receipts for success.

## Non-goals

- No mock fallback that pretends A2A, escrow, or settlement succeeded.
- No Solana mainnet work.
- No wallet funding, IAM, secret, deployment, or on-chain transaction execution without approval.
- No rewrite of the two-user-session visual language.

## Verification

- `cd frontend && npm run lint`
- `cd frontend && npm run typecheck`
- `cd frontend && npm run build`
- `.venv/bin/python -m pytest backend/tests/test_api_promotions.py::test_start_negotiation_uses_saved_initial_offer_for_counter_flow backend/tests/test_api_promotions.py::test_start_negotiation_persists_messages_events_and_agreement backend/tests/test_api_a2a_http_integration.py backend/tests/test_api_escrow.py backend/tests/test_escrow_devnet.py -q`

## Status

- [x] Brand promotion wizard collects work brief and deliverable counts.
- [x] A2A negotiation documents store public creator/product/work summaries.
- [x] Agreement documents store public creator/product/work summaries.
- [x] Dashboard record rows show the agreed work where available.
- [x] Negotiation detail shows connected Creator, agreed work, milestones, and escrow release requirements.
- [x] Frontend and backend checks passed.
