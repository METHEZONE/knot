# Test and QA Strategy

## 1. Required test layers

### Unit tests

- Promotion and Agreement schema validation
- canonical JSON and terms hash
- policy rules
- matching hard filters, scores and tie-breaks
- negotiation state machine
- milestone amount calculations
- URL and evidence rule mapping

### Contract tests

- Product API request/response models
- A2A v1 request headers, tenant, Message, Task and Artifact
- API-to-web3 internal payload
- Firestore repository serialization

### Integration tests

- Firestore emulator repositories and transactions
- ADK agent with model stub and structured outputs
- Creator A2A server end-to-end using test client
- web3 gateway with local Solana validator
- Anchor escrow tests
- Cloud Tasks handler idempotency

### End-to-end tests

- seeded Promotion -> matching -> A2A counter -> agreement
- agreement -> devnet escrow lock
- evidence -> verification -> release
- policy-blocked over-budget offer
- duplicate lock/release request

## 2. Required commands

Exact commands may change with implementation. Before demo freeze, the repository must provide one top-level command for each:

```text
make lint
make test
make test-integration
make build
make seed
make demo-smoke
```

or equivalent task runner scripts. Current equivalent scripts are:

```text
.venv/bin/python -m ruff check backend scripts/seed_demo.py scripts/firestore_smoke.py scripts/reset_demo.py scripts/api_smoke.py
.venv/bin/python -m mypy backend/apps backend/libs
.venv/bin/python -m pytest backend/tests
.venv/bin/python scripts/firestore_smoke.py --target memory
.venv/bin/python scripts/api_smoke.py
```

Firestore-backed checks use:

```text
GOOGLE_CLOUD_PROJECT=<gcp-project-id> .venv/bin/python scripts/firestore_smoke.py --target firestore
GOOGLE_CLOUD_PROJECT=<gcp-project-id> .venv/bin/python scripts/api_smoke.py --base-url <api-url>
```

## 3. Golden negotiation cases

| Case | Expected result |
|---|---|
| offer below creator minimum | counter with higher base |
| blocked industry | completed rejection Artifact |
| acceptable terms | accept and Agreement Artifact |
| Brand budget overflow | policy block before send/accept |
| unsupported rights preset | counter or escalation |
| round 6 | automatic rejection/terminal state |
| duplicate messageId | same result, no new round |

## 4. Payment cases

- duplicate lock returns existing receipt or idempotency conflict, never a second transfer
- release before lock fails
- wrong mint/program/creator fails
- duplicate milestone release fails safely
- release amount over remaining balance fails on gateway and program
- RPC timeout is retryable without duplicate transfer

## 5. UI acceptance

- loading, empty, error and terminal states are visible
- Agent Society Map updates selected/active agents
- Promotion Timeline orders events deterministically
- blocked actions show rule and field
- transaction signature opens correct devnet explorer
- responsive layout works for demo laptop viewport

## 6. Release gate

No demo deployment when:

- any critical test fails
- Firestore schema and API docs disagree
- devnet signer is missing/overfunded unexpectedly
- secrets appear in Git diff or logs
- live demo cannot be reset and reseeded by script
