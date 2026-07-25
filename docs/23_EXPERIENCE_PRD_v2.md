# KNOT Experience PRD v2 — Onboarding, Agent Hatching, Expedition & Dual Dashboards

**Product:** KNOT — Brand × Creator Agentic Promotion Platform
**Document version:** v2.1 (experience layer on top of `01_PRD_v1.md`)
**Owner:** 민성 (frontend/UX/PRD)
**Status:** Approved direction — build baseline for `frontend/`
**Updated:** 2026-07-25

> 2026-07-25 MVP reset: the current frontend implementation intentionally
> ignores this broader page map and keeps only the simple role flows in
> `PLANS.md` until the first end-to-end demo is stable.

## 0. Relationship to v1

`01_PRD_v1.md` remains the transaction backbone and every **hard demo gate in
`17_DEMO_ACCEPTANCE.md` is unchanged**. This document adds the human-facing
experience around that backbone and **amends the v1 scope exclusions** as
follows, and only as follows:

| v1 exclusion | v2 status |
|---|---|
| User onboarding, social account connection, profile extraction | **IN** (Tier A/B below) — demo can still run 100% on seeds |
| Production login/signup beyond demo accounts | **IN**: Firebase Auth Google + Solana wallet sign-in (demo accounts kept) |
| Push notification configuration | still OUT — in-app notification feed only |
| Automated revenue attribution | **partially IN**: first-party affiliate redirect + click counting only |
| Everything else excluded by `02_SCOPE_GLOSSARY.md` | still OUT |

Non-negotiables inherited: canonical terminology (Promotion, never campaign,
in ALL user-visible copy and code — the on-chain `initialize_campaign` name
stays internal), camelCase JSON, LLM never authorizes payments, frontend
holds no Solana keys, explorer URLs derived from cluster+signature only,
timeline reads `promotions/{id}/events` (never auditEvents).

## 1. Product idea in one line

Both sides hatch a personal agent-manager; the human's job shrinks to
watching their agent go on expeditions, stepping in only when asked — and the
negotiation scenes are good enough to screenshot.

## 2. Delivery tiers (deadline 8/3)

- **Tier A — in the 8/3 demo:** hatching onboarding (both sides), Promotion
  creation wizard, Agent Workflow execution log, negotiation
  theater + public replay link, dual dashboards with milestones/evidence,
  in-app notifications, seeded-data fallback for every step.
- **Tier B — build if green by 8/1:** affiliate redirector + click KPI,
  creator leaderboard (on-chain Reputation PDA), SNS re-diagnosis refresh.
- **Tier C — post-hackathon:** real-time multi-user tenancy, wallet custody
  UX beyond devnet demo keys, push notifications, TikTok/IG live scraping in
  cloud.

## 3. Auth & identity (FR-9)

- Sign-in methods: **Google (Firebase Auth)** and **Solana wallet**
  (sign-message verification; wallet-adapter). Email/password deferred to
  v2.1 (magic link).
- A signed-in user selects or is assigned a **role context**: `creator` or
  `brand` (one user may own both; context switcher in the top bar).
- Demo accounts remain first-class: `?demo=brand` / `?demo=creator` bypass
  sign-in and bind to seeded `brand-001` / `creator-001`, so all
  `17_DEMO_ACCEPTANCE.md` gates run without auth dependency.
- Backend: `users/{userId}` doc {uid, authProvider, roles[], brandId?,
  creatorId?, walletAddress?, createdAt}. knot-api gains a Firebase ID-token
  verification dependency for user routes (per docs/07 auth note); agent and
  internal routes unchanged.

## 4. Creator onboarding — "hatch your manager" (FR-10)

Game-tutorial pacing: one decision per screen, progress shown as an egg
warming up. Steps:

1. **Connect socials.** Creator enters handles for Instagram / YouTube /
   X / TikTok (any subset, YouTube via public Data API; others via the
   aside-browser collector — §11).
2. **Account diagnosis.** KNOT ingests recent posts/engagement and renders a
   **Creator Diagnosis Card**: audience size, engagement rate, dominant
   categories, content formats that work (top-3 posts embedded), posting
   cadence, tone keywords, and a **suggested rate band** (mapped to
   `rateCard.minBaseUsdc`/`maxBaseUsdc`). Gemini writes the narrative
   ("your reels outperform your feed 3:1 …"); all numbers come from the
   deterministic ingest, never the model.
3. **Confirm the rate card & rules.** Pre-filled from diagnosis; the creator
   adjusts min/max USDC, blocked industries, monthly capacity, lead-time,
   usage rights — these persist as `creatorProfiles/{id}` +
   `agentPolicies/{agentId}` (exact seeded shapes).
4. **Hatching ceremony.** The egg cracks; the manager-agent walks up to the
   door, knocks, steps in and bows/greets by name, then "signs" the policy
   contract on screen (the policy JSON scrolling behind a signature line —
   this is the autonomy mandate made visible). Personality flavor derives
   deterministically from the diagnosis (category → palette/accessory).
5. **Wallet.** Devnet wallet address attached (connected wallet, or a
   server-issued devnet keypair held in Secret Manager — custody interface
   per architecture.md §4 open item; frontend only ever sees the pubkey).

Completion lands on the Creator Dashboard with the agent idling at its desk.

## 5. Brand onboarding — same ceremony, business inputs (FR-11)

1. **Connect brand.** Website URL + optional social handles → ingest →
   **Brand Profile Card**: category, product lines, tone, existing creator
   collabs found, suggested target audience.
2. **First Promotion wizard.** Budget (`totalUsdc`, `maxPerCreatorUsdc`),
   preferred content formats (deliverables), posting window, usage-rights
   preset, required disclosures, prohibited claims, autonomy dials
   (`maxNegotiationRounds` ≤ 5, `autoEscrow`, `autoRelease`, auto-approve
   cap). Each autonomy dial has plain-language consequences ("your agent may
   move up to X USDC without asking").
3. **Hatching ceremony** — identical beat to the creator side; the brand's
   manager hatches, greets, and signs the mandate.

## 6. Agent Workflow execution log (FR-12)

MVP update: the map/world view is out of scope. The Promotion Control Center
uses a compact execution log powered ONLY by persisted events (poll
`GET /promotions/{id}/timeline` + negotiation messages; no invented state):

- **Dispatch.** Activating a Promotion creates an ordered workflow event list.
  Candidate creator agents appear in the Candidates view with their
  diagnosis-derived skins and deterministic ranking.
- **Matching.** Deterministic scores render as structured candidate cards;
  hard-filtered candidates show the filter reason (`hardFilterReasons[]`).
- **The paid check.** The one pay.sh sandbox verification call (docs/11 §8)
  is a visible beat: the agent stops at a toll booth labeled "verification
  API — paid by agent (x402)" and the receipt pops. This is the hackathon's
  core judging moment; give it screen time.
- **Negotiation.** The selected Brand Agent and Creator Agent stream the real
  `knot.negotiation.v1` messages (§7) in the negotiation theater.
- **Policy block moment.** The deliberately invalid term (demo gate) renders
  as a red stamp slamming "BLOCKED — {rule}: {field}" between the agents.
- **Escrow/settlement.** Locking = a vault door closing with the devnet
  signature on a hanging tag (explorer link); release = coins traveling from
  vault to the creator's house. SIMULATED receipts (signature null) render
  the same scene with a "simulated" watermark — the UI must never fabricate
  a signature.
- **Intervention.** The human is a spectator by default. Only
  `ESCALATE`/`TASK_STATE_INPUT_REQUIRED` raises an intervention card
  (approve / adjust / abort → `:resume` with the decision payload). This is
  FR-8's escalation UI, staged.

## 7. Negotiation theater & viral replay (FR-13)

- **Live scene:** each `negotiations/{id}/messages` doc becomes a chat
  bubble: OFFER/COUNTER/ACCEPT/REJECT badge, round counter (`round/maxRounds`),
  terms diff chips from `changedFields[]`, and the `rationale` string as the
  agent's spoken line. Because pricing is deterministic
  (counter = creator's `minBaseUsdc` floor; brand initial offer =
  `min(creator.min, promotion.maxPerCreator)`), the scene is honest: bubbles
  may be styled, numbers are the engine's.
- Optional Gemini pass rewrites `rationale` into character voice
  (display-only, cached per message, clearly layered so the raw rationale is
  one tap away — LLM text can never differ from decision data).
- **Public replay:** every finished negotiation gets
  `/replay/{negotiationId}` — a no-auth page that replays the bubbles with
  typing pacing, agent avatars, and the final term-sheet card with
  `termsHash`. **Amount masking on by default** for public links (owner can
  unmask); OG image auto-generated (both avatars + "AGREED in N rounds").
  Share buttons for X. This is the "내 에이전트가 이렇게 딜 치더라" artifact.
- Replay reads a public, denormalized `replays/{negotiationId}` doc written
  at negotiation end (never exposes policy snapshots or wallet data).

## 8. Dual dashboards, notifications, milestones (FR-14)

**Brand dashboard:** active Promotions with stage chips (matching →
negotiating → locked → live → released), per-Promotion spend vs budget
(fee = 0 per v1 invariant — never render a platform-fee line), creator
progress board (per agreement: milestone states, evidence status), KPI strip
(committed USDC, released USDC, agreements count, avg negotiation rounds,
affiliate clicks when Tier B lands).

**Creator dashboard:** deals inbox (agreements + states), earnings (released
vs pending escrow, from milestones math — display both `releasePct` and the
computed USDC using the base-units floor rule with remainder folded into the
LAST milestone, matching `settlement.py` exactly), task list ("submit reel by
8/10", "evidence needed") derived from agreement deliverables + milestone
triggers, evidence submission form (URL → `POST /agreements/{id}/evidence`),
diagnosis card + re-run button, affiliate links panel (Tier B).

**Notifications (in-app only):** bell feed fed by the same persisted events
(offer received, counter, agreed, escrow locked, evidence passed/failed,
milestone released, escalation waiting). Poll/SSE per docs/03 §4; no push.

## 9. Leaderboard — on-chain reputation as the game rank (FR-15, Tier B)

The Anchor program already maintains `Reputation` PDA per creator wallet
(`campaigns_completed`, `total_settled`). Leaderboard = read-only ranking by
on-chain `total_settled` (devnet), joined with creator display profiles.
This turns the settlement rail into the ranking system — on-chain data the
judges can verify. Ties break by `campaigns_completed`, then display name.
No off-chain score invention in v2.

## 10. Affiliate links (FR-16, Tier B)

- Redirector: `go.thezonebio.com/r/{code}` (or `knot.thezonebio.com/r/{code}`
  — same host as frontend if simpler) → 302 to the target product URL.
- `affiliateLinks/{code}`: {creatorId, agreementId?, targetUrl, createdAt};
  `affiliateClicks` counter (sharded counter or daily doc) → creator KPI +
  brand Promotion performance widget.
- v2 tracks clicks only. No revenue attribution claims in UI copy (v1
  exclusion still applies to attribution).

## 11. SNS ingestion pipeline (FR-17)

- **Collector:** an aside-browser (logged-in local browser) script per
  platform, run from the operator machine: profile stats + last N posts +
  engagement per post → normalized JSON → `creatorIngests/{creatorId}` in
  Firestore. YouTube uses the public Data API (no browser). The collector is
  demo-visible code but runs OUT of band — Cloud Run never scrapes.
- **Demo strategy (decided):** pre-cache real accounts before the demo;
  onboarding replays the cached ingest (labeled "captured {date}" per the
  17 §3 honesty rule). Live scraping exists as a local capability to show
  judges if asked.
- Platform order: Instagram → YouTube → X → TikTok.
- Diagnosis derivation (deterministic): engagement rate = interactions /
  followers; rate-band suggestion table keyed by follower tier × engagement
  quartile × category (documented constants, versioned `diagnosis-v1`);
  Gemini writes prose only.

## 12. New/changed API surface (contract deltas for docs/07)

All additive; existing routes untouched:

- `POST /users:bootstrap` (auth) → create/read user doc + role contexts
- `POST /creators:onboard` — profile + policy + wallet ref from onboarding
- `POST /creators/{creatorId}/ingests` / `GET …/diagnosis` — cached ingest in,
  diagnosis out (`diagnosis-v1`)
- `POST /brands:onboard` — brand profile from website/social ingest
- `GET /replays/{negotiationId}` (public, no auth, masked by default)
- `GET /leaderboard` (Tier B) — reads on-chain reputation via gateway
- `POST /affiliate-links` + `GET /r/{code}` redirect (Tier B; redirect served
  by frontend edge route)
- `GET /me/notifications` — derived event feed (or client-side merge of
  timeline events in v2.0 if backend time is short — frontend-only fallback)

Frontend builds against committed fixtures for all of these on day one
(16 §4 rule), so 예원's implementation can land behind the same shapes.

## 13. Frontend architecture

- `frontend/` Next.js + TypeScript (App Router), Cloud Run, per AGENTS.md.
- `frontend/features/` = onboarding, promotion, matching, negotiation,
  agreement, evidence, settlement, dashboard, replay, workflow (extends docs/05
  list with onboarding/dashboard/replay/workflow).
- Hatching scenes use DOM/SVG components. The Agent Workflow is card/list based
  for MVP; no canvas map layer or game engine.
- Data: poll timeline + negotiation messages at 1–2s during active scenes
  (SSE later if `/stream` lands); SIMULATED/null-signature states first-class.
- Reduced-motion: the workflow log and timeline remain plain static lists.

## 14. Risks & guardrails

1. **Scope vs 8/3:** every Tier-A feature has a seeded fallback; if hatching
   art slips, onboarding still works as plain forms (ceremony is a skin).
   The demo gates never depend on Tier B.
2. **Fee display:** UI assumes fee=0 everywhere (v1 invariant; on-chain
   config must be initialized with 0 bps per INTEGRATION_PLAN §4-C).
3. **Signature honesty:** SIMULATED receipts render as simulated; replay/OG
   never shows amounts unless owner unmasks; no fabricated explorer links.
4. **Terminology:** "Promotion" everywhere user-visible; expedition copy
   uses "dispatch/expedition" as flavor, not domain terms.
5. **Wallet custody:** frontend treats wallets as pubkeys only; issuance
   interface = 효창/예원 open item (architecture.md §4) — blocked marked in
   WBS if unresolved by 7/28.
6. **A2A truthfulness:** scenes render only persisted messages/events; if
   the in-process negotiation completes in one shot, the theater paces the
   SAME recorded rounds — it never invents extra rounds.

## 15. Success metrics (added to v1 §8)

| Metric | Target |
|---|---|
| Onboarding (either side) | < 3 min from sign-in to hatched agent, zero manual data entry beyond handles/URL + confirmations |
| Replay link | negotiation → public replay URL in one click, OG card renders on X |
| Spectator load | brand user watches match→agree→lock→release with ZERO required clicks after activation (interventions only on escalation) |
| Diagnosis honesty | every number on the diagnosis card traceable to ingest JSON |
