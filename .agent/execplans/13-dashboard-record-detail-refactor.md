# Phase 13 ExecPlan - Dashboard Records and Negotiation Detail

## Goal

Separate dashboard summaries from negotiation detail views.

Brand dashboard must show:

- 정산: aggregate escrow and contract totals.
- Agent 관리: entry point to create a new promotion.
- Agent 기록: previous promotion/negotiation records, with detail links.

Creator dashboard must show:

- 정산: aggregate payout/escrow summary.
- Agent 관리: accepting-offers control.
- Agent 기록: received offers and results, with detail links.

Negotiation detail pages must show the actual persisted A2A messages in chat form, plus agreement terms, milestones, escrow state, and creator evidence URL submission when escrow is funded.

## Source Documents

- `docs/00_DOCUMENT_INDEX.md`
- `docs/00_UI_REFERENCE_TWO_USER_SESSION.md`
- `docs/05_DASHBOARD_AND_LIVE_AGENT_RUN_UX.md`
- User clarification on 2026-07-31.

## Scope

- Move actual A2A message rendering out of dashboard sections.
- Use `/brand/promotions/new` as the new promotion setup wizard:
  - URL input
  - mood extraction
  - mood/budget review
  - start negotiation
  - redirect to `/brand/negotiations/{negotiationId}`
- Replace `/brand/negotiations/{negotiationId}` and `/creator/offers/{negotiationId}` with a shared negotiation detail surface.
- Add creator evidence URL submission from negotiation detail when the agreement has funded escrow.
- Fix signup completion redirect to the current reference onboarding entry routes.

## Out of Scope

- No main branch changes.
- No production deployment.
- No secret, IAM, wallet funding, or automatic on-chain transaction execution.
- No browser-side Firestore business writes.

## Verification

- `cd frontend && npm run typecheck`
- `cd frontend && npm run lint`
- `cd frontend && npm test`
- `cd frontend && npm run build`
- Local HTTP smoke:
  - `/brand/promotions/new`
  - `/signup/brand`
  - `/brand`
  - Product API `/readyz`

## Result

Implemented. Dashboard sections now summarize and link out; full A2A messages live only on negotiation detail pages.
