# KNOT Execution Plans

Use an execution plan for work that touches multiple services, changes architecture or schemas, or is expected to take more than one focused session.

## Plan template

### Goal

State the user-visible result in one paragraph.

### Scope

List the exact files/services that may change and what is explicitly excluded.

### Current state

Record the relevant implementation and known gaps. Do not assume a feature exists without inspecting code.

### Milestones

- [ ] M1 — smallest independently verifiable outcome
- [ ] M2 — integration outcome
- [ ] M3 — tests and documentation

### Contracts

Record API, Firestore, A2A, event, or on-chain schema changes before coding.

### Validation

Provide exact commands and expected observable results.

### Decisions and surprises

Append decisions, failed approaches, and reasons while working.

### Completion record

Summarize changed files, test results, deployment state, and remaining follow-ups.

---

## Active v1 milestone plan

- [x] Repository bootstrap
- [ ] GCP project configuration
- [x] Firestore-independent domain model and backend fixtures
- [x] Deterministic policy engine and matching pipeline
- [x] Brand Agent and Creator Agent A2A negotiation baseline
- [ ] Agreement hashing and Solana devnet escrow lock
- [ ] Evidence verification and milestone release
- [ ] Frontend Agent Society Map and Promotion Timeline
- [ ] Cloud Run deployment, logging, and end-to-end demo
