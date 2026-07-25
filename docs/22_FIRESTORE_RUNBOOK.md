# Firestore Runbook

## 1. Purpose

Firestore Native mode is the source of truth for KNOT v1 operational state:

- seeded demo brand, creators, agents and policies
- Promotion lifecycle
- deterministic match results
- negotiation state, messages and decisions
- final Agreement terms and hash
- evidence, escrow, settlement and receipt records when those flows are wired
- append-only audit events and idempotency keys

The browser must not write privileged business collections directly. Product API,
Creator Agent and web3 gateway services own writes through repository code and
service IAM.

## 2. Current Implementation

Backend persistence currently uses a repository boundary:

```text
backend/libs/repositories/firestore_paths.py
backend/libs/repositories/serialization.py
backend/libs/repositories/store.py
backend/libs/repositories/firestore_adapter.py
backend/libs/repositories/seed.py
```

The Product API can run in two modes:

```text
KNOT_REPOSITORY_BACKEND=memory
KNOT_REPOSITORY_BACKEND=firestore
```

`memory` is the default local mode. It loads deterministic demo fixtures on app
startup and is used by unit/contract tests.

`firestore` uses `google-cloud-firestore` through `FirestoreDocumentStore`. It
expects application default credentials and a configured GCP project.

## 3. Collections

Canonical collection paths are defined in `docs/06_DOMAIN_DATA_MODEL.md` and
implemented by `FirestorePaths`.

```text
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
settlements/{settlementId}
paymentOperations/{operationId}
transactionReceipts/{receiptId}
auditEvents/{eventId}
idempotencyRecords/{key}
```

All JSON and Firestore field names use `camelCase`. Python code may use snake
case internally only through Pydantic aliases.

## 4. ERD

```mermaid
erDiagram
    BRAND ||--o{ PROMOTION : owns
    BRAND ||--o| AGENT : represented_by
    CREATOR_PROFILE ||--o| AGENT : represented_by
    AGENT ||--o| AGENT_POLICY : governed_by

    PROMOTION ||--o{ PROMOTION_EVENT : records
    PROMOTION ||--o{ MATCH_RUN : has
    MATCH_RUN ||--o{ MATCH_CANDIDATE : ranks
    MATCH_CANDIDATE }o--|| CREATOR_PROFILE : candidate_creator

    PROMOTION ||--o{ NEGOTIATION : contains
    MATCH_CANDIDATE ||--o| NEGOTIATION : starts
    NEGOTIATION }o--|| AGENT : client_brand_agent
    NEGOTIATION }o--|| AGENT : server_creator_agent

    NEGOTIATION ||--o{ NEGOTIATION_MESSAGE : contains
    NEGOTIATION ||--o{ NEGOTIATION_DECISION : records
    NEGOTIATION ||--|| A2A_TASK : maps_to

    A2A_TASK ||--o{ A2A_EVENT : records
    A2A_TASK ||--o{ A2A_ARTIFACT : produces

    NEGOTIATION ||--o| AGREEMENT : produces
    A2A_ARTIFACT ||--o| AGREEMENT : materializes

    AGREEMENT ||--o{ MILESTONE : defines
    MILESTONE ||--o{ EVIDENCE : verifies

    AGREEMENT ||--o| ESCROW : funded_by
    ESCROW ||--o{ SETTLEMENT : releases
    MILESTONE ||--o| SETTLEMENT : triggers

    ESCROW ||--o{ PAYMENT_OPERATION : executes
    SETTLEMENT o|--o{ PAYMENT_OPERATION : payout_attempts
    PAYMENT_OPERATION ||--o| TRANSACTION_RECEIPT : results_in
    PAYMENT_OPERATION ||--|| IDEMPOTENCY_RECORD : guarded_by
```

This is a logical ERD. Firestore stores document ID references and immutable
snapshots; it does not enforce foreign keys.

Entity key fields:

```text
BRAND.brandId
CREATOR_PROFILE.creatorId, creatorAgentId
AGENT.agentId
AGENT_POLICY.agentId, policyVersion
PROMOTION.promotionId, brandId, brandAgentId
MATCH_RUN.matchRunId, promotionId, selectedCreatorId, selectedCreatorAgentId
MATCH_CANDIDATE.creatorId, creatorAgentId, eligible, score, rank, negotiationId
NEGOTIATION.negotiationId, matchRunId, matchCandidateId, promotionId, contextId, taskId, status, currentRound
NEGOTIATION_MESSAGE.messageId, contextId, taskId, role, sequence
NEGOTIATION_DECISION.decisionId, messageId, type, policyDecision
AGREEMENT.agreementId, negotiationId, taskId, artifactId, termsHash, status
MILESTONE.milestoneId, agreementId, trigger, releasePct, status
EVIDENCE.evidenceId, agreementId, milestoneId, status, policyDecision
ESCROW.escrowId, agreementId, termsHash, status
SETTLEMENT.settlementId, escrowId, milestoneId, status
PAYMENT_OPERATION.operationId, operationType, idempotencyKey, status
TRANSACTION_RECEIPT.receiptId, paymentOperationId, signature, status
AUDIT_EVENT.eventId, type, createdAt
IDEMPOTENCY_RECORD.key, payloadHash, ownerPath
```

## 5. Seed Data

Committed demo fixtures live in `backend/fixtures/`:

```text
brands.json
agents.json
creators.json
agent_policies.json
promotions.json
matching_golden.json
```

The seed command is idempotent for known document IDs:

```text
.venv/bin/python scripts/seed_demo.py --target memory
.venv/bin/python scripts/seed_demo.py --target firestore --project <gcp-project-id>
```

Current memory seed output should load 12 documents:

```text
brands/brand-001
agents/brand-agent-001
agents/creator-agent-001
agents/creator-agent-002
agents/creator-agent-003
creatorProfiles/creator-001
creatorProfiles/creator-002
creatorProfiles/creator-003
agentPolicies/creator-agent-001
agentPolicies/creator-agent-002
agentPolicies/creator-agent-003
promotions/promotion-001
```

Do not manually edit Firestore during the recorded demo. Fix fixture or seed
code, then reseed.

## 6. Local Firestore Emulator

Firestore emulator integration is not wired yet. When added, use this shape:

```text
gcloud emulators firestore start --host-port=127.0.0.1:8085
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8085
export KNOT_REPOSITORY_BACKEND=firestore
export GOOGLE_CLOUD_PROJECT=knot-agentic-dev
.venv/bin/python scripts/seed_demo.py --target firestore --project knot-agentic-dev
.venv/bin/python scripts/firestore_smoke.py --target firestore --project knot-agentic-dev
```

If the Google Cloud CLI is not installed, install it before using the emulator.
Java is also required by the emulator runtime.

Emulator tests verify repository behavior that cannot be fully proven by the
in-memory store:

- create-if-absent semantics for append-only audit events
- idempotency record replay and conflict behavior
- Product API Promotion -> match -> negotiation -> Agreement -> Evidence flow
- negotiation round increments in transactions
- escrow and settlement write ordering once payment endpoints are connected

Current integration tests are gated by `FIRESTORE_EMULATOR_HOST`:

```text
env FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 GOOGLE_CLOUD_PROJECT=knot-agentic-dev \
  .venv/bin/python -m pytest backend/tests/integration/test_firestore_emulator.py
```

## 7. GCP Firestore Setup

Create Firestore in Native mode once per project. The expected hackathon project
and region are documented in `docs/04_GCP_INFRASTRUCTURE.md`, but the actual
project ID must be configured rather than hardcoded.

Required runtime settings:

```text
KNOT_REPOSITORY_BACKEND=firestore
GOOGLE_CLOUD_PROJECT=<gcp-project-id>
```

`GCP_PROJECT_ID` is accepted as a local fallback, but Google client libraries use
`GOOGLE_CLOUD_PROJECT` by convention.

Local ADC setup:

```text
gcloud auth login
gcloud auth application-default login
gcloud auth application-default set-quota-project <gcp-project-id>
```

Firestore API and Native database bootstrap:

```text
gcloud services enable firestore.googleapis.com --project=<gcp-project-id>
gcloud firestore databases list --project=<gcp-project-id>
gcloud firestore databases create --database='(default)' --location=us-central1 --type=firestore-native --project=<gcp-project-id>
```

The database location and mode are one-time choices. For KNOT v1 demo work, use
Native mode and the region from `docs/04_GCP_INFRASTRUCTURE.md` unless the GCP
project owner has explicitly selected a different region.

Seed and smoke against real GCP Firestore:

```text
env GOOGLE_CLOUD_PROJECT=<gcp-project-id> GCP_PROJECT_ID=<gcp-project-id> KNOT_REPOSITORY_BACKEND=firestore \
  .venv/bin/python scripts/firestore_smoke.py --target firestore
```

Current verified project:

```text
projectId: knot-dev-gcp
database: projects/knot-dev-gcp/databases/(default)
type: FIRESTORE_NATIVE
location: us-central1
verifiedAt: 2026-07-24
```

Runtime service accounts:

- `knot-api-sa`: Firestore user
- `knot-creator-agent-sa`: Firestore user
- `knot-web3-sa`: limited Firestore access for agreement/payment validation
- `knot-web-sa`: no privileged Firestore admin or business direct-write access

Do not commit service account JSON files or downloaded credentials.

## 8. Indexes

No composite indexes are currently required by implemented queries. Existing
repository reads are direct document lookups or collection scans for the demo
dataset.

Before adding query filters or ordered list APIs, add index requirements here and
track the deployable index file in source. Likely future indexes:

```text
promotions: brandId ASC, status ASC, createdAt DESC
matchRuns: promotionId ASC, createdAt DESC
negotiations: promotionId ASC, createdAt DESC
evidence: agreementId ASC, milestoneId ASC, createdAt DESC
escrows: agreementId ASC
settlements: escrowId ASC, milestoneId ASC
paymentOperations: escrowId ASC, settlementId ASC, createdAt DESC
transactionReceipts: paymentOperationId ASC
auditEvents: promotionId ASC, createdAt DESC
```

## 9. Write Rules and Invariants

Repository/API code must preserve these invariants:

- terminal negotiations reject new messages
- `currentRound` increments once per accepted unique message
- policy snapshots are immutable after negotiation start
- Agreement `canonicalTermsJson` and `termsHash` are deterministic
- Promotion events are product timeline entries under a Promotion.
- Audit events are global append-only operational/security records.
- payment actions create PaymentOperation records
- each PaymentOperation is guarded by one IdempotencyRecord
- duplicate idempotency key with the same payload is a replay
- duplicate idempotency key with a different payload is a conflict
- escrow and settlement writes must be protected by transactions when wired

LLM output must not authorize writes that move money. Policy code and the web3
gateway must approve escrow lock and release.

## 10. Implemented API Persistence

Current Product API routes write or read these collections:

```text
POST /api/v1/promotions
GET  /api/v1/promotions
GET  /api/v1/promotions/{promotionId}
POST /api/v1/promotions/{promotionId}:activate
POST /api/v1/promotions/{promotionId}/matches:run
GET  /api/v1/promotions/{promotionId}/timeline
GET  /api/v1/match-runs/{matchRunId}
GET  /api/v1/match-runs/{matchRunId}/candidates
POST /api/v1/match-runs/{matchRunId}/candidates/{creatorAgentId}:select
POST /api/v1/match-runs/{matchRunId}:start-negotiation
GET  /api/v1/negotiations/{negotiationId}
GET  /api/v1/negotiations/{negotiationId}/messages
GET  /api/v1/negotiations/{negotiationId}/events
POST /api/v1/negotiations/{negotiationId}:cancel
GET  /api/v1/agreements/{agreementId}
POST /api/v1/agreements/{agreementId}/evidence
GET  /api/v1/evidence/{evidenceId}
POST /api/v1/evidence/{evidenceId}:verify
```

Evidence verification writes `status`, `observations`, `policyDecision`,
`verifiedAt` and `updatedAt` back to `evidence/{evidenceId}`, and appends
Promotion timeline events.

Payment mutation endpoints remain deferred until web3 signing work resumes.

## 11. Verification

Run these checks after DB/API changes:

```text
.venv/bin/python -m ruff check backend scripts/seed_demo.py scripts/firestore_smoke.py
.venv/bin/python -m mypy backend/apps backend/libs
.venv/bin/python -m pytest backend/tests
env FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 GOOGLE_CLOUD_PROJECT=knot-agentic-dev \
  .venv/bin/python -m pytest backend/tests/integration/test_firestore_emulator.py
.venv/bin/python scripts/seed_demo.py --target memory
.venv/bin/python scripts/firestore_smoke.py --target memory
env FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 GOOGLE_CLOUD_PROJECT=knot-agentic-dev \
  .venv/bin/python scripts/firestore_smoke.py --target firestore --project knot-agentic-dev
env GOOGLE_CLOUD_PROJECT=knot-dev-gcp GCP_PROJECT_ID=knot-dev-gcp KNOT_REPOSITORY_BACKEND=firestore \
  .venv/bin/python scripts/firestore_smoke.py --target firestore
git diff --check
```

Expected current test result without emulator env:

```text
39 passed, 3 skipped
```

Expected current emulator integration result with emulator env:

```text
3 passed
```

Known warning: FastAPI/Starlette TestClient currently emits one deprecation
warning related to `httpx`.
