# Architecture Decisions and Open Questions

## Accepted decisions

### ADR-001 — GCP-native off-chain stack

All frontend, backend, agent, data, CI/CD, secrets and observability workloads use Google Cloud. Solana and pay.sh are external protocol/payment dependencies required by the product.

### ADR-002 — Monorepo with three primary code areas

`frontend`, `backend`, and `web3` are top-level code areas. `infra`, `docs` and `scripts` support them.

### ADR-003 — Four Cloud Run services

- web
- API + Brand Agent
- Creator Agent A2A server
- private web3 gateway

This demonstrates real A2A communication while keeping operational boundaries clear.

### ADR-004 — Firestore as primary database

The v1 domain is document/event heavy, needs fast iteration and serverless integration. Strong cross-entity relational analytics is deferred.

### ADR-005 — Creator matching belongs to Brand Agent

Hard filters and scoring are deterministic. Gemini explains, but does not choose outside the ranked eligible set.

### ADR-006 — A2A v1.0 HTTP+JSON

Use official Message, Task, TaskState, Artifact, version header and tenant routing. Do not invent transport endpoints.

### ADR-007 — Payment signing isolated from agents

Agents and Gemini cannot access signing material. A private gateway revalidates intent and signs a narrowly defined transaction.

### ADR-008 — Promotion terminology

Use Promotion as the brand initiative. Avoid `campaign` and `dealBrief` in new code and documents.

### ADR-009 — Onboarding deferred

Profiles, policies, AgentCards and wallet references are seeded for v1.

## Open questions requiring explicit decision before implementation changes

- Exact devnet USDC-compatible mint and faucet process
- Whether first milestone releases at agreement or all funds wait for content verification
- Exact pay.sh sandbox resource identifier available during demo
- Whether evidence is fetched live or uploaded as a snapshot when social platforms block servers
- Firebase Auth demo account provisioning method

Record the answer here and update affected schemas/tests before coding.
