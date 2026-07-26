# Phase 3 — Resource Routes and Real Data

Read `AGENTS.md`, active ExecPlan, and docs 03, 05, 06, 07, 12, 13.

Goal: move from demo-step routes to Promotion and Agreement resource pages.

Implement:

- `/brand/promotions/new`
- `/brand/promotions/{promotionId}`
- `/brand/agreements/{agreementId}`
- `/creator/offers/{negotiationId}`
- `/creator/agreements/{agreementId}`
- temporary legacy redirects
- ownership and real IDs
- no successful mock fallback
- remove `glow-bar` dependency

Preserve existing visual components. Do not begin real A2A internals beyond page interfaces.
