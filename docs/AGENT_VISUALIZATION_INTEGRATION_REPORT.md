# Agent Visualization Integration Report

Last updated: 2026-07-30

## Branches

- Stable base: `origin/main` at `e58aa9b9b13b2776962bfe0f56a38d44acfd0940`.
- UI source branch: `origin/feat/two-user-session` at `263c9d3859c5979c51b418542e953637339e6583`.
- Work branch: `feat/dashboard-agent-visualization`.
- No full merge from `origin/feat/two-user-session` was performed.

## Reused UX

- Adopted the Manager-first dashboard language from the onboarding/chat prototype.
- Preserved key copy: `매니저 붙이기`, `두 개만 정하면 끝이에요`, and `에이전트끼리 대화`.
- Recreated the Agent conversation visual language in API-backed product components instead of importing the prototype mock board.

## New Adapter

- `frontend/src/product/agentExperience.ts` adds live view models for:
  - Manager profile summary
  - dashboard Agent activity preview
  - full negotiation activity timeline
  - Agreement and Escrow sidebar
  - one primary next action
- Inputs are existing Product API contracts: `ApiNegotiation`, `ApiNegotiationMessage`, `ApiAgreement`, `ApiEscrow`, `ApiSettlement`, dashboard activity, offers, and promotions.

## Dashboard Changes

- Brand dashboard now includes metrics, Manager card, required actions, active Promotion cards, recent Agent activity, and Escrow summary.
- Creator dashboard now includes Manager card, required actions, settlement summary, active sponsorships, and recent Agent activity.
- Dashboard previews and detail pages use the same activity mapper so state does not diverge through separate fixture data.

## Negotiation Detail Route

- Creator detail: `/creator/offers/[negotiationId]`.
- Brand detail: `/brand/negotiations/[negotiationId]`.
- Final Brand nested alias: `/brand/promotions/[promotionId]/negotiations/[negotiationId]`.
- The main detail view displays Brand Agent and Creator Agent messages, policy checks, Agreement activity, Escrow activity, and next action.

## Mapping

- A2A messages become `OFFER`, `COUNTER`, `ACCEPT`, `REJECT`, or `APPROVAL_REQUIRED` activity items.
- Negotiation status adds policy-check or approval-required state.
- Agreement adds Agreement ID, terms hash, deliverables, usage rights, deadline, and amount.
- Escrow adds network, funded amount, status, real signature when present, Explorer link when signature exists, and milestone progress.
- Private policy values from message rationale are redacted before rendering.

## Simulated vs Live

- Production data path remains live API mode by default.
- No production mock fallback was introduced.
- No fake transaction hash or fake escrow success was introduced.
- Explicit mock mode remains only in the existing `NEXT_PUBLIC_KNOT_DATA_MODE=mock` fixture path.

## Two-user Session

- Firebase email, signup, and Google sign-in set `browserSessionPersistence` before authentication.
- This supports Brand and Creator sessions in separate browser tabs/windows without using local persistent auth as the shared source.

## Screenshots

Not generated in this worktree. There is no configured browser E2E runner or test account environment available locally, and the protected dashboard/detail pages require Firebase/Product API auth to render the final state.

Requested screenshot targets remain:

- `artifacts/dashboard/creator-dashboard-agent-preview.png`
- `artifacts/dashboard/brand-dashboard-agent-preview.png`
- `artifacts/negotiation/agent-conversation-working.png`
- `artifacts/negotiation/agent-conversation-completed.png`
- `artifacts/negotiation/policy-check.png`
- `artifacts/negotiation/agreement-card.png`
- `artifacts/negotiation/escrow-card.png`
- `artifacts/negotiation/next-action.png`
- `artifacts/negotiation/two-user-tabs.png`

## Test Results

Frontend:

```text
cd frontend && npm run typecheck
cd frontend && npm run lint
cd frontend && npm run test
cd frontend && npm run build
```

Results:

- Typecheck: passed.
- Lint: passed.
- Tests: 21 passed.
- Production build: passed.

## Remaining Limitations

- Brand settlement list is still a compatibility alias to the existing settlement entry route.
- Live real-time refresh still follows the existing API behavior; this pass does not add a new SSE endpoint.
- Screenshots need configured E2E credentials and browser tooling.
