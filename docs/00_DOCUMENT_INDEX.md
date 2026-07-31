# KNOT Final Documentation Index

## Source-of-truth order

1. `KNOT_PRODUCT_MASTER_SPEC_FINAL.md`
2. `02_TEAM_MATCHING_DECISION.md`
3. The specialized document for the task being implemented
4. Existing API/OpenAPI/Firestore/Anchor contracts verified in the repository
5. Archived or older KNOT documents only as historical reference

When this bundle conflicts with an older KNOT v1/v2 document, this bundle wins for product behavior. When a protocol field conflicts with the installed official SDK/specification, the verified installed protocol contract wins and the documentation must be updated.

## Product anchor

> KNOT fills the missing layer for human-service transactions in agentic commerce.

## Documents

| File | Purpose |
|---|---|
| `01_PRODUCT_NARRATIVE_AND_PRD.md` | Product story, users, scope, success criteria |
| `02_TEAM_MATCHING_DECISION.md` | Team-ready matching decisions and unresolved validation items |
| `03_USER_FLOWS_AND_INFORMATION_ARCHITECTURE.md` | Brand/Creator flows, routes, navigation, resource model |
| `04_CARD_DECK_ONBOARDING_UX.md` | Existing-design-preserving onboarding cards and data mapping |
| `05_DASHBOARD_AND_LIVE_AGENT_RUN_UX.md` | Agent Control Room, live run, replay and technical proof |
| `06_MATCHING_DISCOVERY_AND_RANKING.md` | Eligibility, retrieval, scoring, paid verification, selection |
| `07_AGENT_RUNTIME_AND_MATCH_RUN_STATE_MACHINE.md` | Async runtime, state machines, leases, retries, idempotency |
| `08_DATA_MODEL_FIRESTORE_AND_INDEXES.md` | Canonical collections, projections, indexes and migration |
| `09_A2A_NEGOTIATION_PROTOCOL.md` | A2A boundary, Message/Task/Artifact and KNOT mapping |
| `10_API_CONTRACTS_AND_BACKWARD_COMPATIBILITY.md` | Additive APIs, DTOs, errors, legacy compatibility |
| `11_GEMINI_ANALYSIS_AND_POLICY_ENGINE.md` | URL analysis, structured output, mood model, policy boundary |
| `12_PAYSH_X402_PAID_VERIFICATION.md` | Agent-paid API verification and receipt rules |
| `13_AGREEMENT_ESCROW_EVIDENCE_SETTLEMENT.md` | Agreement, terms hash, devnet escrow and release |
| `14_SECURITY_PRIVACY_AUTHORITY_AND_CONCURRENCY.md` | Privacy, SSRF, agent authority, service auth and locks |
| `15_GCP_ARCHITECTURE_DEPLOYMENT_OBSERVABILITY.md` | Cloud Run/Firestore architecture and operations |
| `16_TEST_ACCEPTANCE_AND_DEMO.md` | Test matrix, acceptance criteria and 3-minute demo |
| `17_WBS_AND_IMPLEMENTATION_PLAN.md` | Safe phased implementation plan and commit boundaries |
| `18_UI_COPY_AND_STATE_DICTIONARY.md` | Korean copy, labels, empty/error states |
| `19_REPOSITORY_MIGRATION_CONFLICT_AVOIDANCE.md` | Audit, worktree, adapters, migration and rollback |
| `20_CODEX_MASTER_PROMPT.md` | Complete Codex implementation prompt |
| `21_IMPLEMENTATION_STATUS.md` | Evidence-based status template |
| `22_REFERENCES.md` | Source documents and official references |

## Required generated implementation artifacts

Codex must create or update the following inside the repository while executing:

```text
docs/INTEGRATION_AUDIT.md
docs/API_COMPATIBILITY_MATRIX.md
docs/FIRESTORE_MIGRATION_PLAN.md
docs/IMPLEMENTATION_STATUS.md
PLANS.md
```

## Non-negotiable language

User UI:
- 매니저
- 협찬 프로젝트
- 협상
- 계약
- 에스크로
- 정산

Code/DB:
- Agent
- Promotion
- MatchRun
- MatchCandidate
- Negotiation
- Agreement
- Escrow
- Evidence
- Settlement

Do not introduce `campaign` or `dealBrief` in new canonical code. Legacy fields may be read through compatibility adapters until migrated.
