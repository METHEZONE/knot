# Demo Persona Seed Import

## Goal

Build demo Brand and Creator persona seed data that follows the current KNOT
Firestore schema and actually works through Discovery, Matching, A2A
negotiation, Agreement, and the existing Escrow path.

## Source Documents

- `docs/00_DOCUMENT_INDEX.md`
- `docs/KNOT_PRODUCT_MASTER_SPEC_FINAL.md`
- `docs/02_TEAM_MATCHING_DECISION.md`
- `docs/06_MATCHING_DISCOVERY_AND_RANKING.md`
- `docs/08_DATA_MODEL_FIRESTORE_AND_INDEXES.md`
- `docs/09_A2A_NEGOTIATION_PROTOCOL.md`
- `docs/13_AGREEMENT_ESCROW_EVIDENCE_SETTLEMENT.md`
- `docs/15_GCP_ARCHITECTURE_DEPLOYMENT_OBSERVABILITY.md`

## Current Schema Findings

- Canonical collections are defined in
  `backend/libs/repositories/firestore_paths.py`.
- Creator matching uses:
  - `creatorProfiles/{creatorId}` as full profile source.
  - `creatorDiscoveryProfiles/{creatorId}` as query projection.
  - `agents/{agentId}` for publication and capacity.
  - `agentPolicies/{agentId}` for private creator policy.
  - `agentRegistry/{agentId}` for A2A discovery.
- Firestore Discovery hard filters:
  - `agentStatus == PUBLISHED`
  - `acceptingOffers == true`
  - `availability == AVAILABLE`
  - `capacityAvailable == true`
  - `countryCode == KR`
  - `categoryKeys array_contains promotion primary category`
  - `nextAvailableAt <= promotion.postingWindow.start`
  - `formatKeys` contains requested format after query.
- `CreatorProfile` is intentionally narrow. Public social raw data and AI
  analysis should be preserved in `socialSnapshots` and additive raw document
  fields, not forced into a new replacement model.
- Creator policy currently supports deterministic variation through
  `minBaseUsdc`, `blockedIndustries`, `maxDeliverablesPerMonth`,
  `minDaysToPost`, `allowedUsageRights`, revision and exclusivity limits.

## Implementation Steps

1. Add provider interfaces for YouTube and Instagram profile collection.
2. Implement YouTube Data API v3 adapter with minimal quota usage:
   channel resolve, channel statistics, recent uploads, video statistics.
3. Implement Instagram provider abstraction:
   Apify/Meta interfaces when credentials exist, fixture fallback otherwise.
4. Add normalization that maps social snapshots into existing KNOT documents:
   creator profile, discovery projection, agent, agent policy, registry entry,
   brand profile, brand agent, demo promotions, and social snapshots.
5. Add demo seed script with `--dry-run`, `--refresh-social`,
   `--only-brands`, `--only-creators`, `--reset`.
6. Add verification script/tests for:
   brand count, creator count, category coverage, discovery, matching score,
   A2A negotiation and agreement creation.
7. Add `docs/DEMO_PERSONA_SEED.md` documenting sources, separation of public
   and synthetic data, execution, refresh, collection mapping, and demo flow.
8. Only after explicit approval, run the seed against Firestore and verify on
   Cloud Run.

## Instagram Apify Extension

- Add `libs.social.instagram.InstagramProfileProvider`.
- Use Apify `run-sync-get-dataset-items` with bearer auth when `APIFY_TOKEN` is
  configured.
- Keep Instagram analysis limited and explicit when no token exists.
- Connect Creator onboarding so the user chooses exactly one platform:
  Instagram or YouTube.
- Preserve YouTube Data API flow.
- Add user-provided Instagram demo brands `@thehackathonkr` and `@bzcf` while
  keeping total demo brands at 10.

## Safety Rules

- Do not hard-code tokens or API keys.
- Do not infer official social accounts when not verified.
- Mark unresolved accounts as `UNRESOLVED`.
- Public observed data must carry source metadata.
- Synthetic negotiation policy must be marked with `SYNTHETIC_DEMO`.
- Do not expose private policy in UI or counterparty A2A payloads.
- Do not reset or write production Firestore without explicit approval.

## Validation

- Local tests for normalization and discovery.
- Local API A2A negotiation smoke.
- Dry-run report listing all intended Firestore document paths.
- Firestore write verification after approval.
- Cloud Run URL verification after deployment approval.
