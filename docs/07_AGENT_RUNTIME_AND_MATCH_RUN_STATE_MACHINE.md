# Agent Runtime and Match Run State Machine

## 1. Runtime model

KNOT does not create one dedicated model server per user. A logical Agent is composed of:

```text
shared runtime
+ user-confirmed Profile
+ private Policy snapshot
+ Authority snapshot
+ memory/history
+ tools
+ wallet/settlement configuration
```

The runtime is stateless between requests. Canonical state is persisted in Firestore. Long-running behavior is implemented as a durable workflow, not as a browser process.

## 2. Logical components

| Component | Responsibility |
|---|---|
| Product API | Authenticated user APIs and safe ViewModels |
| Match Run Orchestrator | Durable state machine for discovery through Agreement |
| Brand Agent Runtime | Query construction, ranking decisions, negotiation strategy |
| Creator A2A Server | AgentCard, A2A Message/Task operations and routing |
| Creator Agent Runtime | Creator policy context, Gemini proposal, deterministic decision |
| Policy Engine | Eligibility, budget, rights, schedule, authority and payment gates |
| Discovery Repository | Indexed filters and semantic Top K retrieval |
| Reservation Service | Creator capacity lease and conflict prevention |
| Agreement Service | Exactly-once canonical Agreement and terms hash |
| Web3 Gateway | Authorized, allowlisted, idempotent Solana operations |
| Event Projector | Canonical events to role-safe UI timeline |

These may be modules in existing services. Do not split working services only for diagram purity.

## 3. Durable execution

Preferred order:

1. Reuse the repository’s verified durable worker mechanism.
2. If none exists, introduce an `AgentRunDispatcher` interface.
3. Implement it with a managed Google Cloud queue suitable for authenticated Cloud Run worker calls.
4. Do not hold a user HTTP request open for the entire negotiation.

Start behavior:

```text
POST start Match Run
→ transaction creates or returns idempotent run
→ enqueue/dispatch operation
→ return 202 with runId
→ worker claims run lease
→ persist events after each state transition
```

## 4. Brand Agent state

Agent lifecycle and a particular run are separate.

```text
Agent.status
CREATED | ACTIVE | DISABLED
```

Brand Agent is `ACTIVE` while it may be used. It is not toggled on/off for each run.

## 5. Creator Agent state

### Publication

```text
DRAFT
PUBLISHED
PAUSED
SUSPENDED
```

### Offer acceptance

```text
acceptingOffers: boolean
```

### Runtime availability

```text
AVAILABLE
RESERVED
NEGOTIATING
AT_CAPACITY
UNAVAILABLE
```

A Creator Agent can be `PUBLISHED` while temporarily `AT_CAPACITY`.

## 6. Match Run state machine

```text
READY
→ QUEUED
→ DISCOVERING
→ RANKING
→ VERIFYING? 
→ SELECTING
→ NEGOTIATING
→ AGREED
→ ESCROW_PREPARING
→ ESCROW_SUBMITTED
→ ESCROW_CONFIRMED
→ COMPLETED
```

Alternative terminals:

```text
EXHAUSTED
CANCELED
FAILED
```

### State definitions

| State | Meaning |
|---|---|
| `READY` | Created, not yet dispatched |
| `QUEUED` | Durable worker dispatch accepted |
| `DISCOVERING` | Indexed candidates being retrieved |
| `RANKING` | Deterministic scoring/sorting |
| `VERIFYING` | Optional paid or detailed top-candidate checks |
| `SELECTING` | Fresh eligibility and reservation attempt |
| `NEGOTIATING` | One candidate A2A Task active |
| `AGREED` | Agreement created exactly once |
| `ESCROW_PREPARING` | Authority, balance and operation data checked |
| `ESCROW_SUBMITTED` | Transaction submitted; signature known |
| `ESCROW_CONFIRMED` | Confirmation/finality policy satisfied |
| `COMPLETED` | Target funded Agreement completed |
| `EXHAUSTED` | Maximum candidates attempted without Agreement |
| `CANCELED` | Canceled before immutable funded result |
| `FAILED` | Fatal infrastructure or invariant failure |

## 7. Candidate attempt state

```text
RETRIEVED
ELIGIBLE
RANKED
VERIFICATION_PENDING
VERIFIED
RESERVATION_PENDING
RESERVED
NEGOTIATING
AGREED
REJECTED
EXPIRED
SKIPPED
FAILED
```

Each candidate document stores transition timestamps and reason codes.

## 8. Negotiation state

KNOT domain state:

```text
CREATED
OFFERED
COUNTERED
AGREED
REJECTED
EXPIRED
CANCELED
FAILED
```

A2A Task state is stored separately. Do not conflate product state with protocol state.

## 9. Reservation lease

### Acquisition

Atomic checks:

- Agent is published and accepting offers;
- active negotiation count below capacity;
- active collaboration count below capacity;
- no unexpired conflicting lease;
- profile/policy version still eligible.

Lease:

```json
{
  "creatorAgentId": "creator-agent-001",
  "reservationId": "reservation-001",
  "matchRunId": "run-001",
  "negotiationId": "negotiation-001",
  "status": "ACTIVE",
  "expiresAt": "timestamp",
  "createdAt": "timestamp"
}
```

MVP lease TTL: five minutes, extended while verified progress occurs.

### Release/convert

- rejection/expiry/fatal candidate error → release;
- Agreement before escrow → maintain protected hold;
- escrow confirmed → convert to active collaboration capacity;
- escrow permanently failed/canceled → release according to Agreement cancellation rules.

## 10. Policy snapshots

At candidate negotiation start, persist:

```text
brandPolicySnapshot
creatorPolicySnapshot
brandAuthoritySnapshot
creatorProfileVersion
promotionVersion
```

User changes apply to future negotiations, not the in-progress Task.

Snapshots are private server documents. Public responses include only safe projections and policy outcome categories.

## 11. Idempotency

Required keys:

| Operation | Idempotency identity |
|---|---|
| Start Match Run | Brand + Promotion + client idempotency key |
| Worker claim | runId + lease generation |
| A2A Message | messageId |
| Agreement create | negotiationId + final Artifact digest |
| Escrow lock | agreementId + operation type |
| Evidence submit | agreementId + normalized URL + client key |
| Settlement release | escrowId + milestone ID |

Duplicate requests return the existing canonical result or a 409 only when payloads conflict.

## 12. Retry policy

### Retryable

- transient network timeout;
- 429/5xx downstream;
- Cloud Run startup delay;
- transaction confirmation timeout where signature exists;
- Firestore contention.

### Non-retryable

- invalid state transition;
- ownership violation;
- terms hash mismatch;
- private policy rejection;
- invalid URL/security violation;
- insufficient authority;
- unsupported A2A version;
- malformed payload.

Retries use bounded exponential backoff and persist attempt count. Do not blindly resubmit an on-chain operation when a signature may already exist.

## 13. Cancellation

User cancellation is accepted only when safe:

- before Agreement: cancel worker, release reservation;
- after Agreement but before escrow: follow Agreement cancellation policy;
- after escrow confirmed: cannot silently cancel; move to explicit cancellation/refund flow outside normal MVP happy path.

## 14. Event model

Every meaningful transition writes an immutable event:

```json
{
  "eventId": "evt-001",
  "aggregateType": "MATCH_RUN",
  "aggregateId": "run-001",
  "sequence": 7,
  "eventType": "NEGOTIATION_COUNTER_RECEIVED",
  "actorType": "CREATOR_AGENT",
  "publicPayload": {},
  "privatePayloadRef": "...",
  "correlationId": "corr-001",
  "createdAt": "timestamp"
}
```

The UI timeline uses ordered `publicPayload` projections. Private payloads are not fetched and hidden client-side; they remain server-only.

## 15. Recovery

Reconciler responsibilities:

- queued runs with no worker lease;
- expired reservations;
- A2A Task and Negotiation status mismatch;
- Agreement exists but Match Run not advanced;
- on-chain receipt confirmed but Firestore operation not updated;
- settlement signature exists but Dashboard projection stale.

Recovery is idempotent and audited.
