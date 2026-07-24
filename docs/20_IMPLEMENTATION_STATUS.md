# KNOT v1 Implementation Status

Update this file at the end of every Codex task.

## Current milestone

`M4 — Evidence verification API baseline with Firestore persistence`

## Service status

| Area | Status | Last verified | Notes |
|---|---|---|---|
| frontend | deferred | 2026-07-24 | Folder kept empty by request |
| knot-api | Evidence API baseline | 2026-07-24 | Promotion, match run, negotiation, agreement and evidence APIs wired to repository boundary |
| creator A2A service | M2 negotiation baseline | 2026-07-24 | A2A send/stream/tasks/cancel endpoints backed by in-memory task store |
| web3 gateway | M3 lock validation skeleton | 2026-07-24 | Validates escrow lock requests and returns idempotent simulated receipts |
| Anchor program | skeleton initialized | 2026-07-24 | Minimal Anchor workspace |
| Terraform/GCP | not started | - | No infra files committed yet |
| end-to-end demo | not started | - | |

## Contract versions

```text
Product API: v1
A2A: 1.0
Negotiation payload: knot.negotiation.v1
Agreement payload: knot.term-sheet.v1
Matching weights: matching-v1
Brand policy: brand-policy-v1
Creator policy: creator-policy-v1
Evidence policy: verification-v1
Escrow program: unset
```

## Latest validation

```text
.venv/bin/python -m ruff check backend scripts/seed_demo.py scripts/firestore_smoke.py: passed.
.venv/bin/python -m pytest backend/tests: passed, 39 tests, with one FastAPI/Starlette deprecation warning from TestClient.
.venv/bin/python -m mypy backend/apps backend/libs: passed.
.venv/bin/python scripts/seed_demo.py --target memory: passed, loaded 12 demo documents.
.venv/bin/python scripts/firestore_smoke.py --target memory: passed.
cd web3/gateway && npm install: passed, with local Node v20.13.0 engine warning from a transitive ESLint package.
cd web3/gateway && npm run lint: passed.
cd web3/gateway && npm test: passed, 5 tests.
cd web3/gateway && npm run build: passed.
cd web3/gateway && npm audit --audit-level=moderate: passed, 0 vulnerabilities.
```

## Decisions made during implementation

- Imported the v1 source-of-truth documentation into `docs/`.
- Kept external prompt files out of the repository per current working instruction.
- Renamed `config/env.example` to root `.env.example`.
- Treated `frontend`, `backend`, and `web3` as the three primary code areas; `infra` and `scripts` will be added only when needed.
- Removed unused `@solana/web3.js` from the M0 gateway skeleton; add it back when real Solana RPC/signing code starts.
- Added commit rules to `AGENTS.md`, including domain-prefixed commit messages and mandatory user approval before committing.
- Added typed Promotion, CreatorProfile, AgentPolicy, AgreementTerms, compensation, deliverable, milestone, and policy decision models.
- Added pure Brand and Creator policy functions with deterministic violation codes.
- Added deterministic creator matching with hard filters, weighted score `matching-v1`, rank assignment, and stable tie-break.
- Expanded creator fixtures and added `matching_golden.json` for backend golden tests.
- Added A2A v1 request, message, part, task, status, artifact, and negotiation payload models.
- Added in-memory A2A task store with `messageId` idempotency, task/context consistency, terminal task rejection, task listing, lookup, subscribe, and cancel support.
- Extended Creator Agent service from placeholder response to deterministic creator-policy negotiation decisions.
- Added Brand Agent pure orchestration helpers for top creator selection, initial terms construction, and A2A offer request construction.
- Added deterministic `termsHash` helper for accepted A2A artifacts; deeper agreement/payment hashing remains part of the next payment milestone.
- Added Firestore collection path helpers matching `docs/06_DOMAIN_DATA_MODEL.md`.
- Added backend repository serialization helpers that preserve camelCase Firestore/API field names.
- Added an abstract `DocumentStore`, in-memory repository implementation for tests, and a duck-typed Firestore client adapter boundary.
- Added deterministic demo seed fixtures for brand, agents, creator profiles, agent policies and the sample Promotion.
- Added `google-cloud-firestore` as a backend runtime dependency and `scripts/seed_demo.py` with memory and Firestore targets.
- Added repository tests for path contracts, model serialization, idempotency keys, append-only audit events, copy isolation and idempotent demo seed loading.
- Added Product API routes for Promotion create/list/get/activate, match run execution, match run lookup, candidate listing, candidate selection and Promotion timeline.
- Added API tests verifying seeded Promotion reads, Promotion creation/activation events, deterministic match persistence and ineligible candidate selection blocking.
- Added Product API start-negotiation, negotiation get/messages/events and agreement get routes backed by repository documents.
- Added deterministic agreement persistence with canonical terms JSON and terms hash copied from the validated creator decision.
- Added `docs/22_FIRESTORE_RUNBOOK.md` to document Firestore modes, collections, seed data, emulator/GCP setup, indexes, invariants and verification.
- Added an ERD to the Firestore runbook and a `scripts/firestore_smoke.py` readback command for memory or Firestore targets.
- Aligned the logical Firestore ERD with v1 relationship semantics: optional Brand/Creator-to-Agent representation, MatchCandidate-to-CreatorProfile references, MatchCandidate-to-Negotiation tracking, A2AArtifact-to-Agreement materialization, Agreement Milestone documents, PaymentOperation as the payment execution unit, IdempotencyRecord guarding PaymentOperation, and separated PromotionEvent from AuditEvent.
- Updated backend Firestore path helpers and API persistence so MatchCandidate documents use `creatorId`, Agreements persist `artifactId`, milestones are written under Agreements, Evidence references milestones, and idempotency records use `idempotencyRecords/{key}`.
- Added deterministic `verification-v1` evidence policy checks for URL reachability, brand mention, required disclosure and prohibited claims.
- Added Product API routes for evidence submission, evidence lookup and evidence verification backed by `evidence/{evidenceId}` documents and Promotion timeline events.
- Added API and policy tests covering evidence success, persisted verification failure, creator-agent submitter validation and blocked observation rules.
- Added web3 gateway lock validation service requiring `Idempotency-Key`, agreement/escrow IDs, terms hash, amount, mint, program ID, network, and wallet references.
- Added allowlist checks for mint and program ID, positive amount validation, and idempotent replay for duplicate lock requests.
- Kept lock execution as `SIMULATED`; real Solana signing, RPC submission, Secret Manager access, and transaction persistence remain future work.

## Known blockers

- GCP project ID not configured.
- Firestore Native database has not been created in GCP.
- Local Google Cloud CLI is not installed, so Firestore emulator execution is not available on this machine yet.
- Firestore emulator integration tests are not wired yet.
- Firestore composite indexes are documented as future needs, but no index file is required by current implemented queries.
- Devnet program ID and mint not configured.
- pay.sh sandbox resource not selected.

## Next task

Add Firestore emulator integration tests, then wire API evidence observations to Gemini/pay.sh adapters when those service settings are available.
