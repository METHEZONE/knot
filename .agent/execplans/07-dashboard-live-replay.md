# Phase 7 ExecPlan — Dashboard Live/Replay UX

## Goal

Project persisted Agent work into the existing KNOT dashboard/control-room UI without client-generated business state.

## Source Documents

- `docs/00_DOCUMENT_INDEX.md`
- `docs/05_DASHBOARD_AND_LIVE_AGENT_RUN_UX.md`
- `docs/17_WBS_AND_IMPLEMENTATION_PLAN.md`
- `docs/KNOT_PRODUCT_MASTER_SPEC_FINAL.md`

## Scope

- Preserve the existing dashboard visual language from the current frontend.
- Add typed Product API reads for Match Run and Negotiation event streams.
- Add Brand run control using the Product API `runAgentForPromotion` path.
- Add Creator Agent accepting-offers control through owner-scoped Product API routes.
- Render candidate snapshots, canonical run replay, and sanitized Technical Proof from persisted API data.

## Implementation Notes

- No Firestore browser writes were added.
- No timer advances business state.
- Replay uses stored Match Run events and stored candidate snapshots.
- Technical Proof exposes only sanitized IDs/statuses/data-source labels, not prompts, private policy, credentials, or raw protocol payloads.
- Demo fixture mode remains explicit through the mock data source.

## Verification

- `npm run typecheck` from `frontend`
- `npm run lint` from `frontend`
- `npm test` from `frontend`
- `npm run build` from `frontend`

## Result

Implemented and verified in Phase 7. Backend code was not changed in this phase; the frontend consumes existing Product API endpoints added and hardened in earlier phases.
