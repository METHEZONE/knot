# Firestore Migration Plan

> Phase 1 mapping only. No migration or backfill was executed.

## Current Collections

Current collection constants live in `backend/libs/repositories/firestore_paths.py`.

| Current collection | Current use |
|---|---|
| `users` | Authenticated and legacy users |
| `brands` | Brand profiles |
| `creatorProfiles` | Creator profiles |
| `analysisJobs` | Product/Creator URL analysis job records added in Phase 2 |
| `agents` | Brand/Creator agent identity |
| `agentPolicies` | Creator policy, some Brand/Creator policy-shaped data |
| `promotions` | Promotion source documents |
| `promotions/{id}/events` | Promotion event timeline |
| `matchRuns` | Match Run documents |
| `matchRuns/{id}/candidates` | Candidate snapshots |
| `negotiations` | Product negotiation records |
| `negotiations/{id}/messages` | A2A message projections |
| `negotiations/{id}/decisions` | Policy/decision events |
| `a2aTasks` | A2A task projection |
| `a2aTasks/{id}/events` | A2A task events |
| `a2aTasks/{id}/artifacts` | A2A artifacts |
| `agreements` | Agreements |
| `agreements/{id}/milestones` | Agreement milestones |
| `evidence` | Evidence submissions |
| `escrows` | Escrow aggregate records |
| `settlements` | Settlement records |
| `paymentOperations` | Payment operation records |
| `transactionReceipts` | Web3 transaction receipts |
| `auditEvents` | Audit events |
| `idempotencyRecords` | Idempotency claims |
| `onboardingSessions` | Authenticated card onboarding resume/draft state added in Phase 2 |
| `adminJobs` | Dev/admin jobs |
| `deletionJobs` | Dev/admin deletion jobs |

## Canonical Collection Additions

Phase 1 adds constants/path helpers only for:

- `productProfiles`
- `agentAuthorities`
- `agentRegistry`
- `creatorDiscoveryProfiles`
- `verificationResults`
- `agentActivities`
- `analysisJobs`
- `onboardingSessions`

No documents are written to these collections in Phase 1.

## Mapping Table

| Existing collection/field | Canonical target | Action | Backward compatibility |
|---|---|---|---|
| `brands` | `brands` | Preserve | Same collection |
| `creatorProfiles` | `creatorProfiles` | Preserve and add final fields later | Dual-read old `categories`, `supportedDeliverableFormats`, `rateCard` |
| `promotions.productName` and URL/profile draft fields | `productProfiles` + `promotions.productProfileId` | Add in onboarding phase | Keep existing promotion fields until all routes use profile ref |
| `agents.active` | `agents.status`, `publicationStatus`, `acceptingOffers`, `availability` | Add missing fields in publication phase | Derive final projection from legacy `active` when fields missing |
| `agentPolicies.creator.minBaseUsdc` | `agentPolicies.minimumBaseUsdc` or versioned private policy | Add adapter | Never expose to Brand DTOs |
| Missing card resume state | `onboardingSessions/{uid}` | Added in Phase 2 for new analysis flow | Existing direct profile endpoints still complete onboarding |
| Missing analysis job state | `analysisJobs/{analysisId}` | Added in Phase 2 | Stores digest and structured draft, not raw fetched content |
| Missing Brand authority data | `agentAuthorities/{brandAgentId}` | Add in onboarding/escrow phase | Existing wallet fields remain readable |
| Missing Creator authority data | `agentAuthorities/{creatorAgentId}` | Add in onboarding/settlement phase | Existing `walletAddress` remains readable |
| Missing AgentCard registry projection | `agentRegistry/{agentId}` | Add in publication/A2A phase | Existing `agents.a2aEndpoint` remains readable |
| `creatorProfiles` used directly for matching | `creatorDiscoveryProfiles` | Add projection + backfill | Matching service dual-reads until index verified |
| `matchRuns` flat run state | `matchRuns` final state machine fields | Add fields; do not rewrite old runs | Legacy completed runs remain readable |
| `matchRuns/{id}/candidates` | same | Add final score component fields/version snapshots | Existing fields remain readable |
| `promotions/{id}/events` | `matchRuns/{id}/events` and/or canonical event projection | Add run event collection later | Phase 1 run timeline aliases project existing promotion events |
| `negotiations` | `negotiations` | Preserve | Add policy snapshot refs and final status fields later |
| `a2aTasks` with in-memory Creator default | `a2aTasks` durable storage | Implement persistent Creator task store later | Existing Product API projection remains readable |
| `agreements` | `agreements` | Preserve | Add final one-milestone hash schema later |
| `agreements/{id}/milestones` 30/70 legacy | one `POST_VERIFIED` 100% milestone | Migrate only in Agreement phase | Preserve old milestones for existing records |
| `evidence` | `evidence` + `verificationResults` | Add verification result collection later | Existing evidence status remains readable |
| `escrows`, `settlements`, `transactionReceipts` | same plus operation subrecords where needed | Preserve | Do not alter confirmed receipts |

## Backfill Strategy

Future backfill scripts must be idempotent and dry-run by default.

1. Read existing `creatorProfiles`, `agents`, and `agentPolicies`.
2. Validate owner, publication, capacity, and public profile fields.
3. Write `creatorDiscoveryProfiles/{creatorId}` without exact minimum, blocked categories, private notes, raw Gemini output, or wallet secrets.
4. Write `agentRegistry/{agentId}` from existing `agents` AgentCard fields.
5. Write `agentAuthorities/{agentId}` only from verified wallet/authority setup.
6. Record counts and skipped reason codes, not private values.

## Index Requirements

No Firestore index file was found in Phase 1. Future phases must add configuration for:

- Published/accepting creator discovery by format, country/language, availability, capacity.
- Active Match Run by Promotion and non-terminal status.
- Negotiations by Brand/Creator owner and updated time.
- Agreements by owner/status.
- Event sequence by aggregate ID.
- Escrow/settlement by Agreement/status.
- Vector index for `creatorDiscoveryProfiles.profileEmbedding` or the selected vector backend.

## Migration Safety

- Do not delete legacy fields in the hackathon refactor.
- New writes should populate canonical fields and any required legacy compatibility fields.
- Frontend reads should go through Product API ViewModels.
- Browser code must not write canonical business data directly to Firestore.
- Any destructive data work requires explicit approval.
