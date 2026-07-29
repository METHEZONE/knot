# Phase 8 Dashboard Agent Visualization

## Goal
Integrate the stable live dashboard, A2A negotiation, Agreement, Escrow, and settlement flow with the Agent-centered dashboard and conversation UX referenced from `origin/feat/two-user-session`.

## Current Behavior
- Stable dashboards are API-backed but read mostly as CRUD/resource summaries.
- Negotiation detail has the live A2A visualizer, but it does not present a customer-facing Brand Agent to Creator Agent conversation with Agreement, Escrow, milestone, and next-action context in one product surface.
- Onboarding exists through Product API profile creation and does not use the strongest Manager attachment copy from the reference branch.

## In Scope
- Document UX/API mapping before implementation.
- Add live view models for Manager, Agent activity, Agreement, Escrow, milestone, and next action.
- Keep existing role dashboards and restructure them with metrics, Manager, required actions, recent Agent activity, ongoing Promotion/Deal, and Escrow/Settlement summary.
- Add negotiation detail conversation visualization that consumes existing negotiation messages, Agreement, and Escrow APIs.
- Add final route aliases for `/creator/deals`, `/brand/promotions/[promotionId]/negotiations/[negotiationId]`, and agent settings URLs.
- Use Firebase browser session persistence for two-user tab testing.
- Add focused frontend tests.

## Out of Scope
- Backend schema changes.
- Firestore direct browser writes.
- New mock fallback behavior.
- Deployment, IAM, Secret Manager, wallet funding, Solana program deployment, or on-chain transactions.

## Milestones
- [x] Read required source docs and inspect stable/reference branches.
- [x] Create `docs/DASHBOARD_AGENT_UX_MAPPING.md`.
- [x] Add Agent experience view model and UI components.
- [x] Integrate Brand and Creator dashboards.
- [x] Integrate Creator offer and Brand negotiation detail screens.
- [x] Add final route aliases.
- [x] Add per-tab Firebase Auth persistence.
- [x] Run frontend lint, typecheck, tests, and build.
- [x] Review diff and write integration report.

## Tests
Planned:

```text
cd frontend && npm run typecheck
cd frontend && npm run lint
cd frontend && npm run test
cd frontend && npm run build
```

Screenshots are planned if a browser-capable E2E runner is available in this worktree without adding unrelated infrastructure.

## Rollback
Revert the Phase 8 commit. No external infrastructure action is performed.

## Progress
- [x] Stable base selected as `origin/main`.
- [x] UI source selected as `origin/feat/two-user-session`.
- [x] No full merge from the UI branch was performed.
- [x] Backend, escrow, settlement, and Cloud Run deployment code are unchanged.
- [x] Frontend typecheck, lint, tests, and build passed.
- [x] Integration report created at `docs/AGENT_VISUALIZATION_INTEGRATION_REPORT.md`.

## Completion Evidence

Commands:

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
- Screenshots: not generated; no configured browser E2E runner or protected-page test credentials are available in this worktree.
