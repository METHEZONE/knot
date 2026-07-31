# Data Model, Firestore and Indexes

## 1. Principles

- Firestore stores canonical application state and audit events.
- Searchable projections are separate from full profiles and private policies.
- Frontend does not assemble canonical state from arbitrary collections; Product API returns authorized ViewModels.
- New schema is additive and versioned.
- Existing collection/field names are audited before migration.

## 2. Collection overview

```text
users
brands
creatorProfiles
productProfiles
socialSnapshots
agents
agentPolicies
agentAuthorities
agentRegistry
creatorDiscoveryProfiles
promotions
matchRuns
  candidates
  events
reservations
negotiations
  messages
  decisions
a2aTasks
  events
  artifacts
agreements
escrows
  operations
evidence
verificationResults
settlements
agentActivities
paymentReceipts
onboardingSessions
```

Existing repository collections must be mapped before introducing duplicates.

## 3. User

```json
{
  "userId": "firebase-uid",
  "role": "BRAND",
  "status": "ACTIVE",
  "onboardingStatus": "COMPLETED",
  "profileRef": "brands/brand-001",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

Role and ownership are server-authoritative.

## 4. Agent

```json
{
  "agentId": "creator-agent-001",
  "ownerId": "creator-001",
  "agentType": "CREATOR",
  "status": "ACTIVE",
  "publicationStatus": "PUBLISHED",
  "acceptingOffers": true,
  "availability": "AVAILABLE",
  "activeNegotiations": 0,
  "maxConcurrentNegotiations": 1,
  "activeCollaborations": 0,
  "maxActiveCollaborations": 1,
  "profileRef": "creatorProfiles/creator-001",
  "policyRef": "agentPolicies/creator-agent-001",
  "authorityRef": "agentAuthorities/creator-agent-001",
  "agentVersion": "1.0.0",
  "promptVersion": "creator-negotiator-v1",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

If existing code has `status`, `availability`, and `acceptingOffers`, preserve them and add only missing dimensions.

## 5. Creator Profile

```json
{
  "creatorId": "creator-001",
  "ownerUserId": "uid-creator",
  "sourceUrl": "https://instagram.com/example",
  "displayName": "Example",
  "handle": "@example",
  "categoryKeys": ["beauty", "lifestyle"],
  "formatKeys": ["REEL", "FEED"],
  "moodIds": ["clean_minimal", "authentic_review"],
  "audienceTags": ["skincare", "20s_30s"],
  "languageKeys": ["ko"],
  "countryCode": "KR",
  "summary": "...",
  "confirmedFields": ["displayName", "categoryKeys", "formatKeys", "moodIds"],
  "unknownFields": ["averageViews"],
  "analysisRef": "socialSnapshots/snapshot-001",
  "taxonomyVersion": 1,
  "profileVersion": 3,
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

Do not store fabricated social metrics.

## 6. Product Profile

```json
{
  "productProfileId": "product-profile-001",
  "brandId": "brand-001",
  "sourceUrl": "https://example.com/product",
  "productName": "Daily SPF Moisturizer",
  "categoryKeys": ["beauty", "skincare"],
  "desiredMoodIds": ["clean_minimal", "natural_wellness"],
  "audienceTags": ["daily_skincare", "20s_30s"],
  "summary": "...",
  "confirmedFields": ["productName", "categoryKeys", "desiredMoodIds"],
  "analysisRef": "...",
  "taxonomyVersion": 1,
  "profileVersion": 2,
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

## 7. Private Agent Policy

```json
{
  "agentId": "creator-agent-001",
  "policyType": "CREATOR_NEGOTIATION",
  "version": 4,
  "currency": "USDC",
  "targetBaseUsdc": 300,
  "minimumBaseUsdc": 250,
  "minimumLeadDays": 7,
  "allowedFormats": ["REEL", "FEED"],
  "allowedUsageRights": ["ORGANIC_ONLY"],
  "blockedCategories": ["gambling", "adult"],
  "maximumRevisions": 1,
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

Brand policy:

```json
{
  "agentId": "brand-agent-001",
  "policyType": "BRAND_PROMOTION",
  "version": 3,
  "promotionId": "promotion-001",
  "targetAmountUsdc": 250,
  "maxAmountUsdc": 350,
  "maxNegotiationRounds": 3,
  "verificationSpendCapUsdc": 0.5,
  "allowedUsageRights": ["ORGANIC_ONLY"],
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

These documents are never returned to the counterparty.

## 8. Agent Authority

```json
{
  "agentId": "brand-agent-001",
  "mode": "LIMITED_AUTONOMY",
  "version": 2,
  "capabilities": {
    "startMatchRun": true,
    "sendOffer": true,
    "sendCounter": true,
    "acceptAgreement": true,
    "purchaseVerificationApi": true,
    "lockEscrow": true,
    "releaseSettlement": true
  },
  "spendLimits": {
    "perMatchRunEscrowUsdc": 350,
    "perMatchRunVerificationUsdc": 0.5,
    "dailyTotalUsdc": 500
  },
  "walletRef": "wallets/brand-agent-wallet-001",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

The implementation must reflect actual wallet architecture. Never claim autonomous signing when the system still needs an interactive wallet prompt.

## 9. Creator Discovery Profile

```json
{
  "creatorId": "creator-001",
  "creatorAgentId": "creator-agent-001",
  "agentStatus": "PUBLISHED",
  "acceptingOffers": true,
  "availability": "AVAILABLE",
  "capacityAvailable": true,
  "categoryKeys": ["beauty", "lifestyle"],
  "primaryCategoryKey": "beauty",
  "formatKeys": ["REEL", "FEED"],
  "primaryFormatKey": "REEL",
  "moodIds": ["clean_minimal", "authentic_review"],
  "audienceTags": ["skincare", "20s_30s"],
  "languageKeys": ["ko"],
  "countryCode": "KR",
  "publicRateBand": "250_400",
  "nextAvailableAt": "timestamp",
  "verifiedDealsCount": 8,
  "completionRate": 0.96,
  "onTimeRate": 0.92,
  "cancellationRate": 0.02,
  "profileEmbedding": "vector",
  "profileVersion": 3,
  "taxonomyVersion": 1,
  "embeddingVersion": 2,
  "indexVersion": 4,
  "updatedAt": "timestamp"
}
```

It is a denormalized projection. Update it on confirmed profile/publish/availability/reputation events.

## 10. Promotion

```json
{
  "promotionId": "promotion-001",
  "brandId": "brand-001",
  "brandAgentId": "brand-agent-001",
  "productProfileId": "product-profile-001",
  "status": "READY",
  "requiredFormat": "REEL",
  "targetAmountUsdc": 250,
  "maxAmountUsdc": 350,
  "deadline": "timestamp",
  "usageRights": "ORGANIC_ONLY",
  "verificationSpendCapUsdc": 0.5,
  "targetAgreementCount": 1,
  "maxCandidatesPerRun": 3,
  "maxRoundsPerNegotiation": 3,
  "version": 2,
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

Private financial fields are returned only to the Brand owner and internal services.

## 11. Match Run

```json
{
  "matchRunId": "run-001",
  "promotionId": "promotion-001",
  "brandId": "brand-001",
  "brandAgentId": "brand-agent-001",
  "status": "NEGOTIATING",
  "targetAgreementCount": 1,
  "maxCandidates": 3,
  "currentCandidateRank": 1,
  "currentNegotiationId": "negotiation-001",
  "agreementId": null,
  "querySnapshot": {},
  "policySnapshotRef": "...",
  "idempotencyKey": "...",
  "workerLease": {
    "owner": "worker-id",
    "generation": 2,
    "expiresAt": "timestamp"
  },
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

### Candidate subcollection

```json
{
  "creatorId": "creator-001",
  "creatorAgentId": "creator-agent-001",
  "rank": 1,
  "rawVectorDistance": 0.12,
  "score": 91.4,
  "scoreComponents": {
    "semanticMoodFit": 0.95,
    "categoryAudienceFit": 0.9,
    "formatFit": 1,
    "scheduleFit": 0.8,
    "coarseBudgetFit": 0.7,
    "reliabilityFit": 0.92
  },
  "profileVersion": 3,
  "indexVersion": 4,
  "verificationStatus": "NOT_REQUIRED",
  "reservationId": "reservation-001",
  "negotiationId": "negotiation-001",
  "outcome": "NEGOTIATING",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

## 12. Negotiation and A2A

Keep product and protocol records separate but linked.

```json
{
  "negotiationId": "negotiation-001",
  "matchRunId": "run-001",
  "promotionId": "promotion-001",
  "brandAgentId": "brand-agent-001",
  "creatorAgentId": "creator-agent-001",
  "contextId": "ctx-001",
  "taskId": "task-001",
  "status": "COUNTERED",
  "currentRound": 2,
  "maxRounds": 3,
  "currentPublicTerms": {},
  "brandPolicySnapshotRef": "...",
  "creatorPolicySnapshotRef": "...",
  "reservationId": "reservation-001",
  "lastMessageId": "msg-002",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

Messages store A2A envelope fields and safe indexed fields. Raw payload access is internal and sanitized.

## 13. Agreement

```json
{
  "agreementId": "agreement-001",
  "negotiationId": "negotiation-001",
  "matchRunId": "run-001",
  "promotionId": "promotion-001",
  "brandId": "brand-001",
  "creatorId": "creator-001",
  "artifactId": "artifact-001",
  "terms": {
    "baseAmountUsdc": 300,
    "deliverables": [{"format": "REEL", "count": 1}],
    "usageRights": "ORGANIC_ONLY",
    "deadline": "timestamp"
  },
  "termsHash": "sha256:...",
  "status": "ESCROW_PENDING",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

Unique logical constraint: one Agreement per terminal agreed negotiation.

## 14. Escrow and operations

```json
{
  "escrowId": "escrow-001",
  "agreementId": "agreement-001",
  "network": "SOLANA_DEVNET",
  "asset": "USDC",
  "lockedAmountUsdc": 300,
  "releasedAmountUsdc": 0,
  "status": "CONFIRMED",
  "lockOperationId": "op-lock-001",
  "releaseOperationId": null,
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

Operation:

```json
{
  "operationId": "op-lock-001",
  "operationType": "ESCROW_LOCK",
  "idempotencyKey": "agreement-001:ESCROW_LOCK",
  "status": "CONFIRMED",
  "signature": "...",
  "explorerUrl": "...",
  "submittedAt": "timestamp",
  "confirmedAt": "timestamp",
  "errorCode": null
}
```

## 15. Evidence and settlement

```json
{
  "evidenceId": "evidence-001",
  "agreementId": "agreement-001",
  "creatorId": "creator-001",
  "sourceType": "CONTENT_URL",
  "normalizedUrl": "https://instagram.com/reel/...",
  "status": "VERIFYING",
  "submittedAt": "timestamp"
}
```

```json
{
  "settlementId": "settlement-001",
  "escrowId": "escrow-001",
  "agreementId": "agreement-001",
  "amountUsdc": 300,
  "status": "CONFIRMED",
  "operationId": "op-release-001",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

## 16. Index update pipeline

Trigger conditions:

- creator confirms onboarding/profile;
- mood/formats/categories change;
- Agent publish/pause status changes;
- availability/capacity changes;
- verified collaboration completes;
- scheduled social refresh changes confirmed attributes.

Update steps:

```text
canonical Profile/Agent event
→ validate projection
→ generate embedding only when semantic fields changed
→ write discovery document with new versions
→ emit INDEX_UPDATED event
```

Availability-only updates do not regenerate embeddings.

## 17. Firestore indexes

Exact syntax depends on actual SDK/config, but the repository must include index configuration for supported queries.

Required query families:

1. Published and accepting by format/country/availability.
2. Active Match Run by Promotion and non-terminal status.
3. Negotiations by Brand/Creator owner and updated time.
4. Agreements by owner/status.
5. Events by aggregate ID and sequence.
6. Escrow/settlement by Agreement and status.
7. Vector index on `creatorDiscoveryProfiles.profileEmbedding`, with supported prefilter fields used by the chosen query.

Avoid large arrays that require incompatible compound filters. If Firestore query limits prevent a single query, use a bounded candidate pool strategy or separate index partitions—not a collection scan.

## 18. Migration

Codex must produce a mapping table:

| Existing collection/field | Canonical target | Action | Backward compatibility |
|---|---|---|---|

Rules:

- do not delete old fields during initial migration;
- add canonical fields and adapters;
- dual-read old/new where necessary;
- backfill with idempotent script;
- switch writes after verification;
- remove legacy only after route/API/test references are proven absent.
