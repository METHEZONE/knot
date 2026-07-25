# Observability and Audit Design

## 1. Correlation identifiers

Every request and event should carry where applicable:

```text
requestId
traceId
promotionId
matchRunId
negotiationId
contextId
taskId
messageId
agreementId
escrowId
settlementId
```

## 2. Structured log fields

```json
{
  "severity": "INFO",
  "service": "knot-api",
  "eventType": "POLICY_DECISION",
  "requestId": "uuid",
  "promotionId": "uuid",
  "action": "ESCROW_LOCK",
  "allowed": false,
  "ruleVersion": "brand-policy-v1",
  "violationCodes": ["MAX_PER_CREATOR_EXCEEDED"],
  "durationMs": 12
}
```

Do not log full tokens, private keys, raw prompts, full user profiles or signed transaction bytes.

## 3. Audit events

Append-only `auditEvents` records for:

- Promotion created/activated
- match run started/completed and selected creator
- A2A task/message state changes
- policy allow/block/escalate
- Agreement created and hash
- pay.sh paid call and receipt
- escrow intent, submission and confirmation
- evidence verification
- milestone release
- manual cancellation/escalation resolution

Promotion timeline events are separate product data stored under
`promotions/{promotionId}/events/{eventId}`. They are optimized for the frontend
Promotion Timeline. `auditEvents/{eventId}` is a global append-only operational
and security trail and should not be used as the primary UI timeline source.

The current Product API mirrors major Promotion-flow events into both stores:

- Promotion created/activated
- match run completed and selected candidate
- negotiation started/canceled
- Agreement created
- evidence submitted/verified

Read APIs:

```text
GET /api/v1/promotions/{promotionId}/timeline
GET /api/v1/audit-events?promotionId={promotionId}&limit=100
```

## 4. Metrics

- matching duration and candidate count
- Gemini call latency/error/repair rate
- A2A task duration, rounds and terminal result
- policy block count by rule
- Cloud Tasks retry count
- Solana simulation/submission/confirmation latency
- transaction failure and idempotency conflict count
- end-to-end demo duration

## 5. Alerts for demo environment

- Cloud Run 5xx spike
- web3 gateway failed transaction
- task dead-letter/retry exhaustion
- Vertex AI error rate
- secret access anomaly if available

## 6. Frontend timeline source

UI timeline is generated from persisted domain/audit events, not parsed from application logs. Logs are operational; timeline events are product data.
