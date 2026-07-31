# API Compatibility Matrix

> Phase 3 matrix. Existing public routes are preserved; final routes are added as aliases/adapters first.

## Principles

- Do not delete or rename working endpoints during the first refactor.
- New canonical operations must be additive.
- Existing frontend code should move through `frontend/src/product/apiClient.ts` and future ViewModel adapters.
- Current legacy behavior is documented even when it conflicts with final durable semantics.

## Product API Endpoints

| Current endpoint | Current behavior | Canonical target | Phase 1 action | Compatibility risk |
|---|---|---|---|---|
| `GET /healthz` | Service health | same | Preserve | Low |
| `GET /readyz` | Service readiness | same | Preserve | Low |
| `GET /version` | Build/schema metadata | same | Preserve | Low |
| `GET /api/v1` | API root envelope | same | Preserve | Low |
| `GET /api/v1/me` | Firebase UID bootstrap and role context | `GET /api/v1/me` | Preserve | Low |
| `POST /api/v1/me/role` | Select one role, idempotent | same | Preserve | Low |
| `POST /api/v1/me/brand-profile` | Authenticated Brand profile onboarding | Final Brand onboarding completion adapter | Preserve | Medium: not card-deck stateful yet |
| `POST /api/v1/me/creator-profile` | Authenticated Creator profile/policy onboarding | Final Creator onboarding completion adapter | Preserve | Medium: publication dimensions missing |
| `GET /api/v1/onboarding` | Authenticated onboarding resume state | Final onboarding resume | Added in Phase 2 | Low |
| `PATCH /api/v1/onboarding` | Save authenticated onboarding card state | Final card state persistence | Added in Phase 2 | Low |
| `POST /api/v1/analyses/product` | Authenticated product URL analysis job | Product analysis job start | Added in Phase 2 | Medium: deterministic limited analysis until secure fetch/Gemini extraction |
| `POST /api/v1/analyses/creator-profile` | Authenticated creator profile URL analysis job | Creator analysis job start | Added in Phase 2 | Medium: deterministic limited analysis until secure fetch/Gemini extraction |
| `GET /api/v1/analyses/{analysis_id}` | Owner-scoped analysis read | Analysis job read | Added in Phase 2 | Low |
| `POST /api/v1/analyses/{analysis_id}:confirm` | Owner-scoped analysis confirmation | Analysis confirmation | Added in Phase 2 | Low |
| `POST /api/v1/onboarding/brand/analyze-source` | Brand source analysis compatibility shape | Existing frontend `analyzeBrandSource` adapter | Added in Phase 2 | Medium |
| `POST /api/v1/logout/revoke` | Revoke Firebase refresh tokens | same | Preserve | Low |
| `GET /api/v1/brand/dashboard` | Brand dashboard projection | Final BrandDashboardView | Preserve | Medium: not full Agent Control Room yet |
| `GET /api/v1/creator/dashboard` | Creator dashboard projection | Final CreatorDashboardView | Preserve | Medium: accepting-offers state incomplete |
| `GET /api/v1/creator/agent` | Authenticated Creator Agent control state and discovery projection | Creator Agent control view | Added in Phase 3 | Low |
| `POST /api/v1/creator/agent:publish` | Owner-scoped publish and discovery projection write | Creator publishes Agent for matching | Added in Phase 3 | Medium: matching does not consume projection until Phase 4 |
| `POST /api/v1/creator/agent:pause` | Owner-scoped pause and discovery projection write | Creator pauses Agent matching | Added in Phase 3 | Low |
| `POST /api/v1/creator/agent:resume` | Owner-scoped resume via publish behavior | Creator resumes Agent matching | Added in Phase 3 | Low |
| `GET /api/v1/brand/promotions` | Owner-scoped Brand promotions | Final promotions list | Preserve | Low |
| `POST /api/v1/brand/promotions` | Owner-scoped promotion creation | Final Promotion create | Preserve | Medium: final product profile fields pending |
| `GET /api/v1/brand/promotions/{promotion_id}` | Owner-scoped detail/activity | Final Promotion detail | Preserve | Low |
| `DELETE /api/v1/brand/promotions/{promotion_id}` | Soft delete if no Agreement | Archive/end Promotion | Preserve | Low |
| `GET /api/v1/brand/promotions/{promotion_id}/activity` | Promotion events | Match Run/Promotion timeline projection | Preserve | Low |
| `GET /api/v1/brand/agreements` | Owner-scoped Brand agreements | Final Agreement list | Preserve | Low |
| `GET /api/v1/brand/agreements/{agreement_id}` | Owner-scoped detail + escrow | Final Agreement detail | Preserve | Low |
| `GET /api/v1/creator/offers` | Creator negotiations/offers | Final Creator negotiations list | Preserve | Low |
| `GET /api/v1/creator/offers/{negotiation_id}` | Creator offer detail | Final Negotiation detail | Preserve | Low |
| `GET /api/v1/creator/agreements` | Creator agreements | Final Creator Agreement list | Preserve | Low |
| `GET /api/v1/creator/agreements/{agreement_id}` | Creator agreement detail | Final Agreement detail | Preserve | Low |
| `POST /api/v1/users:bootstrap` | Legacy unauthenticated demo bootstrap | Dev/demo compatibility only | Preserve, migrate later | High if exposed as production auth |
| `GET /api/v1/users/{user_id}` | Legacy user read | Admin/user-safe read | Preserve, restrict later | High if exposed in production |
| `POST /api/v1/brands:onboard` | Legacy Brand onboarding | Compatibility adapter | Preserve | Medium |
| `POST /api/v1/creators:onboard` | Legacy Creator onboarding | Compatibility adapter | Preserve | Medium |
| `POST /api/v1/creators/{creator_id}/criteria` | Creator criteria update | Agent policy update | Preserve | Medium: no owner auth on legacy route |
| `POST /api/v1/promotions` | Legacy Promotion create | Promotion create | Preserve | Medium: unauthenticated legacy route |
| `GET /api/v1/promotions` | Legacy list all | Promotion list | Preserve | Medium: not owner-scoped |
| `GET /api/v1/promotions/{promotion_id}` | Legacy get | Promotion get | Preserve | Low |
| `POST /api/v1/promotions/{promotion_id}:activate` | DRAFT to ACTIVE | Promotion ready/active transition | Preserve | Low |
| `POST /api/v1/promotions/{promotion_id}/matches:run` | Synchronous in-memory matching, writes `COMPLETED` | Start Match Run | Preserve | High: final durable semantics pending |
| `POST /api/v1/promotions/{promotion_id}/match-runs` | New alias to existing matching behavior | Start Match Run | Added in Phase 1 | High: returns current synchronous result |
| `GET /api/v1/match-runs/{match_run_id}` | Get raw Match Run | MatchRun detail | Preserve | Low |
| `GET /api/v1/match-runs/{match_run_id}/timeline` | Promotion event projection by run | MatchRun timeline | Added in Phase 1 | Medium: event model not final sequence yet |
| `GET /api/v1/match-runs/{match_run_id}/events` | Alias of timeline | MatchRun events | Added in Phase 1 | Medium |
| `GET /api/v1/match-runs/{match_run_id}/candidates` | Candidate snapshots | Candidate snapshots | Preserve | Medium: score schema final mismatch |
| `POST /api/v1/match-runs/{match_run_id}/candidates/{creator_agent_id}:select` | Manual candidate selection | Not final user behavior | Preserve only for compatibility/dev | High |
| `POST /api/v1/match-runs/{match_run_id}:start-negotiation` | Starts A2A negotiation after selected candidate | Durable sequential candidate negotiation | Preserve | High: split from run orchestration |
| `GET /api/v1/negotiations/{negotiation_id}` | Raw negotiation | Negotiation detail | Preserve | Low |
| `GET /api/v1/negotiations/{negotiation_id}/messages` | Persisted messages | Negotiation messages | Preserve | Low |
| `GET /api/v1/negotiations/{negotiation_id}/events` | Decision events | Negotiation timeline/events | Preserve | Low |
| `GET /api/v1/negotiations/{negotiation_id}/agreement` | Agreement by negotiation | same | Preserve | Low |
| `POST /api/v1/negotiations/{negotiation_id}:cancel` | Cancel non-terminal negotiation | same | Preserve | Low |
| `GET /api/v1/agreements/{agreement_id}` | Agreement read | same | Preserve | Low |
| `GET /api/v1/agreements/{agreement_id}/escrow` | Escrow + settlements | same | Preserve | Low |
| `POST /api/v1/agreements/{agreement_id}/evidence` | Evidence submit | same | Preserve | Medium: URL security hardening pending |
| `GET /api/v1/evidence/{evidence_id}` | Evidence read | same | Preserve | Low |
| `POST /api/v1/evidence/{evidence_id}:verify` | Evidence verification | Evidence verification | Preserve | Medium: final Gemini observation/gate pending |
| `POST /api/v1/agreements/{agreement_id}/escrow:lock` | Backend calls Web3 Gateway | Escrow lock | Preserve | Medium: final authority audit pending |
| `GET /api/v1/escrows/{escrow_id}` | Escrow read | same | Preserve | Low |
| `POST /api/v1/escrows/{escrow_id}/milestones/{milestone_id}:release` | Settlement release | Final one 100% release | Preserve | Medium: final milestone shape pending |
| `GET /api/v1/transaction-receipts/{receipt_id}` | Receipt read | Technical Proof receipt | Preserve | Low |

## Dev Admin Endpoints

All `/api/v1/dev-admin/*` routes require dev-admin auth checks in current code. They are preserved for seeded demo/admin workflows and must not become normal user APIs.

## Creator A2A Endpoints

| Endpoint | Current behavior | Canonical target | Phase 1 action |
|---|---|---|---|
| `GET /a2a/v1/.well-known/agent-card.json` | Creator AgentCard | AgentCard discovery | Preserve |
| `POST /a2a/v1/message:send` | Validate A2A headers/service token, process message | A2A message send | Preserve |
| `POST /a2a/v1/message:stream` | Alias of send | A2A stream | Preserve |
| `GET /a2a/v1/tasks` | List in-memory tasks | Admin/debug task list | Preserve |
| `GET /a2a/v1/tasks/{task_id}` | Read task | Task read | Preserve |
| `POST /a2a/v1/tasks/{task_id}:subscribe` | Alias of get | Task subscribe | Preserve |
| `POST /a2a/v1/tasks/{task_id}:cancel` | Cancel task | Task cancel | Preserve |

## Web3 Gateway Endpoints

| Endpoint | Current behavior | Canonical target | Phase 1 action |
|---|---|---|---|
| `GET /healthz` | Gateway health | same | Preserve |
| `GET /readyz` | Gateway readiness | same | Preserve |
| `GET /version` | Gateway build metadata | same | Preserve |
| `POST /internal/v1/escrows:lock` | Domain escrow lock operation | Escrow lock | Preserve |
| `POST /internal/v1/escrows/{escrowId}/milestones/{milestoneId}:release` | Canonical release route | Settlement release | Preserve |
| `POST /internal/v1/escrows/:escrowId/milestones/:milestoneId/release` | Compatibility release route | Settlement release alias | Preserve |

## Field Compatibility Notes

| Existing field/value | Final target | Phase 1 action |
|---|---|---|
| `UsageRights` values `organicOnly`, `paidBoost30d`, `fullLicense90d` | `ORGANIC_ONLY`, `PAID_BOOST_30D`, `FULL_LICENSE_90D` | Added conversion helpers; no data rewrite |
| Creator `active` | `publicationStatus`, `acceptingOffers`, `availability`, capacity fields | New Creator Agent writes include final dimensions; legacy reads preserved |
| Agent `status`/`active` | `status`, `publicationStatus`, `acceptingOffers`, `availability` | New Creator Agent writes include final publication dimensions; legacy fields preserved |
| Exact Creator minimum/blocked policy | Public discovery projection | Phase 3 projection exposes only `publicRateBand` and public filters |
| Match Run `COMPLETED` after ranking | `QUEUED` through durable state machine | Preserve until Phase 5 |
| Candidate `overallScore`/`componentScores` | final score components | Preserve; ranking refactor later |
| Agreement milestones 30/70 in tests/legacy | one 100% `POST_VERIFIED` milestone | Migrate in Agreement/settlement phase |

## Contract Tests Added in Phase 1

- Canonical status enum availability and usage-right legacy/canonical conversion.
- `POST /api/v1/promotions/{promotion_id}/match-runs` alias preserves existing matching behavior.
- `GET /api/v1/match-runs/{match_run_id}/timeline` and `/events` return equivalent projections.

## Contract Tests Added in Phase 3

- Creator Agent publish/pause/resume maintains owner-scoped control state.
- `creatorDiscoveryProfiles` projection excludes private minimum and blocked-policy fields.
- Mismatched authenticated Creator/Agent ownership returns `403`.
