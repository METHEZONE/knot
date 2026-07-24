# Product API Contracts v1

Base path: `/api/v1`  
Media type: `application/json`  
Authentication: Firebase ID token for user-facing routes; Cloud Run IAM/OIDC for private service routes.

## 1. Standard response metadata

```json
{
  "data": {},
  "meta": {
    "requestId": "uuid",
    "traceId": "hex",
    "timestamp": "RFC3339"
  }
}
```

## 2. Standard problem response

Use RFC 9457-style problem JSON.

```json
{
  "type": "https://knot.example/errors/policy-violation",
  "title": "Policy violation",
  "status": 409,
  "detail": "Requested amount exceeds maxPerCreatorUsdc.",
  "code": "POLICY_MAX_PER_CREATOR_EXCEEDED",
  "requestId": "uuid",
  "violations": [{"field": "terms.compensation.baseAmountUsdc", "rule": "maxPerCreatorUsdc"}]
}
```

## 3. Promotion endpoints

```text
POST   /promotions
GET    /promotions/{promotionId}
GET    /promotions
POST   /promotions/{promotionId}:activate
POST   /promotions/{promotionId}/matches:run
GET    /promotions/{promotionId}/timeline
```

`POST /promotions` creates a Promotion but does not start matching.

## 4. Matching endpoints

```text
GET    /match-runs/{matchRunId}
GET    /match-runs/{matchRunId}/candidates
POST   /match-runs/{matchRunId}/candidates/{creatorAgentId}:select
POST   /match-runs/{matchRunId}:start-negotiation
```

The normal demo path auto-selects the top eligible candidate, while manual selection remains available for debugging.

## 5. Negotiation endpoints

```text
GET    /negotiations/{negotiationId}
GET    /negotiations/{negotiationId}/messages
GET    /negotiations/{negotiationId}/events
GET    /negotiations/{negotiationId}/stream
POST   /negotiations/{negotiationId}:cancel
POST   /negotiations/{negotiationId}:resume
```

`resume` is only allowed for `ESCALATED` or input-required state and requires an explicit user decision payload.

## 6. Agreement and payment endpoints

```text
GET    /agreements/{agreementId}
POST   /agreements/{agreementId}/escrow:lock
GET    /escrows/{escrowId}
POST   /escrows/{escrowId}/milestones/{milestoneId}:release
GET    /transaction-receipts/{receiptId}
```

Every payment POST requires an `Idempotency-Key` header.

## 7. Evidence endpoints

```text
POST   /agreements/{agreementId}/evidence
GET    /evidence/{evidenceId}
POST   /evidence/{evidenceId}:verify
```

Evidence request:

```json
{
  "url": "https://social.example/post/123",
  "submittedByAgentId": "creator-agent-001"
}
```

Verification result:

```json
{
  "evidenceId": "uuid",
  "status": "PASSED",
  "observations": {
    "urlReachable": true,
    "brandMentioned": true,
    "disclosurePresent": true,
    "prohibitedClaimsFound": []
  },
  "policyDecision": {
    "allowed": true,
    "ruleVersion": "verification-v1"
  }
}
```

## 8. Health endpoints

Each Cloud Run service exposes:

```text
GET /healthz
GET /readyz
GET /version
```

`/version` returns service name, Git SHA, build time and schema version, but no secret or environment dump.

## 9. Error codes

```text
AUTH_INVALID_TOKEN
RESOURCE_NOT_FOUND
VALIDATION_ERROR
INVALID_STATE_TRANSITION
IDEMPOTENCY_CONFLICT
POLICY_VIOLATION
NEGOTIATION_TERMINAL
A2A_VERSION_NOT_SUPPORTED
A2A_TENANT_MISMATCH
A2A_TASK_CONTEXT_MISMATCH
VERTEX_AI_UNAVAILABLE
PAYSH_PAYMENT_FAILED
SOLANA_RPC_FAILED
SOLANA_TRANSACTION_REJECTED
ESCROW_ALREADY_LOCKED
MILESTONE_ALREADY_RELEASED
EVIDENCE_VERIFICATION_FAILED
```
