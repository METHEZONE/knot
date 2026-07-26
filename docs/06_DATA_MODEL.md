# Firestore Data Model

## Principles

- Firebase UID is the account key.
- Business documents use stable generated IDs.
- Server timestamps only.
- Browser does not perform business writes directly.
- Public projection and private policy are separated.
- Destructive admin work creates a job and audit event.
- State transitions are validated.

## Collections

```text
users/{uid}
brands/{brandId}
creatorProfiles/{creatorId}
agents/{agentId}
agentPolicies/{agentId}

promotions/{promotionId}
promotions/{promotionId}/events/{eventId}
matchRuns/{matchRunId}
matchRuns/{matchRunId}/candidates/{creatorId}
negotiations/{negotiationId}
negotiations/{negotiationId}/messages/{messageId}
negotiations/{negotiationId}/decisions/{decisionId}
a2aTasks/{taskId}
a2aTasks/{taskId}/events/{eventId}
a2aTasks/{taskId}/artifacts/{artifactId}
agreements/{agreementId}
agreements/{agreementId}/milestones/{milestoneId}
evidence/{evidenceId}
escrows/{escrowId}
transactionReceipts/{receiptId}
paymentOperations/{operationId}
auditEvents/{eventId}
idempotencyRecords/{key}
adminJobs/{jobId}
deletionJobs/{jobId}
```

## User

```json
{
  "uid": "firebase uid",
  "email": "verified email",
  "displayName": "string",
  "photoUrl": null,
  "role": "BRAND|CREATOR|null",
  "onboardingStatus": "ROLE_REQUIRED|PROFILE_REQUIRED|COMPLETED",
  "status": "ACTIVE|DISABLED|DELETION_PENDING|DELETED",
  "brandId": null,
  "creatorId": null,
  "agentId": null,
  "schemaVersion": 2,
  "createdAt": "timestamp",
  "updatedAt": "timestamp",
  "lastLoginAt": "timestamp"
}
```

## Brand Profile

```json
{
  "brandId": "string",
  "ownerUid": "firebase uid",
  "name": "string",
  "websiteUrl": "string",
  "categories": ["beauty", "custom:clean-skincare"],
  "targetAudience": "string",
  "description": null,
  "restrictedClaims": [],
  "status": "ACTIVE",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

## Creator Profile

```json
{
  "creatorId": "string",
  "ownerUid": "firebase uid",
  "displayName": "string",
  "socialLinks": [{"platform": "INSTAGRAM", "url": "https://..."}],
  "categories": ["beauty"],
  "publicRateBand": {"currency": "USDC", "minimum": 500, "maximum": 800},
  "walletAddress": null,
  "receivingOffers": true,
  "status": "ACTIVE",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

## Agent and Policy

`agents/{agentId}` stores public runtime identity and owner references.

`agentPolicies/{agentId}` stores private values and is never included in normal cross-party projections.

## Promotion

```json
{
  "promotionId": "string",
  "brandId": "string",
  "ownerUid": "firebase uid",
  "productName": "string",
  "title": "string",
  "categories": ["string"],
  "targetAudience": "string",
  "currency": "USDC",
  "totalBudget": 2000,
  "initialOffer": 500,
  "maximumPerCreator": 700,
  "autoAcceptCeiling": 650,
  "maximumRounds": 3,
  "deliverables": [{"type": "INSTAGRAM_REEL", "count": 1}],
  "usageRights": "PAID_BOOST_30D",
  "deadline": "timestamp",
  "prohibitedClaims": [],
  "status": "DRAFT",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

## Agreement

```json
{
  "agreementId": "string",
  "promotionId": "string",
  "negotiationId": "string",
  "contextId": "string",
  "taskId": "string",
  "brandId": "string",
  "creatorId": "string",
  "brandAgentId": "string",
  "creatorAgentId": "string",
  "currency": "USDC",
  "amount": 650,
  "deliverables": [],
  "usageRights": "ORGANIC_ONLY",
  "deadline": "timestamp",
  "termsHash": "sha256:hex",
  "status": "AWAITING_FUNDING",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

## Ownership queries

Brand dashboard filters by authenticated `brandId`. Creator dashboard filters by authenticated `creatorId`. Never query a global latest record and infer ownership.

## Deletion graph

User deletion creates a `deletionJob`.

Safe draft/demo records may be deleted. Confirmed escrow receipts, released payout records, and audit events are not silently deleted; they are retained with unnecessary personal projections minimized.
