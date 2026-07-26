# Product API Contracts

All user endpoints require a verified Firebase ID token unless public.

## Identity

```text
GET  /api/v1/me
POST /api/v1/me/role
POST /api/v1/me/brand-profile
POST /api/v1/me/creator-profile
PATCH /api/v1/me/profile
PATCH /api/v1/me/agent-policy
POST /api/v1/logout/revoke
```

`GET /me` returns account, role, onboarding state, profile summary, and dashboard target. UID is derived from the token.

## Brand

```text
GET  /api/v1/brand/dashboard
GET  /api/v1/brand/promotions
POST /api/v1/brand/promotions
GET  /api/v1/brand/promotions/{promotionId}
PATCH /api/v1/brand/promotions/{promotionId}
POST /api/v1/brand/promotions/{promotionId}:activate
POST /api/v1/brand/promotions/{promotionId}/matches:run
GET  /api/v1/brand/promotions/{promotionId}/activity
GET  /api/v1/brand/agreements
GET  /api/v1/brand/agreements/{agreementId}
```

## Creator

```text
GET  /api/v1/creator/dashboard
GET  /api/v1/creator/offers
GET  /api/v1/creator/offers/{negotiationId}
POST /api/v1/creator/offers/{negotiationId}:approve
POST /api/v1/creator/offers/{negotiationId}:reject
GET  /api/v1/creator/agreements
GET  /api/v1/creator/agreements/{agreementId}
POST /api/v1/creator/agreements/{agreementId}/evidence
```

## Agent orchestration

```text
POST /api/v1/brand/promotions/{promotionId}/agent-runs
GET  /api/v1/agent-runs/{runId}
GET  /api/v1/negotiations/{negotiationId}/events
POST /api/v1/negotiations/{negotiationId}:cancel
```

Start response returns real `runId`, `matchRunId`, `traceId`, and persisted state.

## Escrow

```text
POST /api/v1/agreements/{agreementId}/escrow:lock
GET  /api/v1/agreements/{agreementId}/escrow
GET  /api/v1/transaction-receipts/{receiptId}
```

## Dev admin

Prefix: `/api/v1/dev-admin`

```text
GET  /overview
GET  /users
GET  /users/{uid}
POST /users/{uid}:disable
POST /users/{uid}:enable
POST /users/{uid}:delete
GET  /deletion-jobs/{jobId}
GET  /commerce
GET  /agents
GET  /escrows
GET  /audit
POST /demo:seed
POST /demo:reset
POST /operations/{operationId}:retry
```

Every admin action requires authorization and audit logging.

## Error envelope

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Safe message",
    "traceId": "trace-...",
    "retryable": false,
    "details": {}
  }
}
```

## Idempotency

Required for role selection, profile completion, Agent run, A2A messages, Agreement creation, escrow lock/release, user deletion, and demo seed/reset.
