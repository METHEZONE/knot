# KNOT v1 Work Breakdown Structure

**Submission deadline:** 2026-08-03 23:59 KST  
**Finalist announcement:** 2026-08-07  
**Demo Day:** 2026-08-21

## 1. Tracks

- FE/UX: frontend, Agent Workflow, Promotion Timeline, demo polish
- Backend/Agents: domain, Firestore, policy, matching, ADK, A2A, verification, GCP integration
- Web3/Payments: gateway, Anchor escrow, devnet, pay.sh/x402, receipts

## 2. Delivery schedule

| Date | Backend/Agents | Web3/Payments | FE/UX | Integration gate |
|---|---|---|---|---|
| 7/24 | freeze docs, schemas, service boundaries | escrow/gateway contract review | screen/data contract review | v1 scope signed off |
| 7/25 | repo bootstrap, Firestore model, seed fixtures | local validator, Anchor skeleton, gateway skeleton | Next.js shell, auth/demo account | all services run locally |
| 7/26 | policy engine and matching v1 | initialize/fund/release unit tests | Promotion form and dashboard shell | seed Promotion visible |
| 7/27 | Brand ADK tools and structured outputs | devnet program deploy and receipt adapter | Match results and Agent Workflow | deterministic match run |
| 7/28 | Creator A2A service and multi-turn state | private Cloud Run gateway, Secret Manager | live A2A timeline | counter and Artifact E2E |
| 7/29 | agreement hashing, orchestration | escrow lock integration | Agreement/payment state UI | first devnet lock |
| 7/30 | evidence analysis and policy gate | milestone release integration | evidence and release UI | full E2E happy path |
| 7/31 | error/idempotency tests, logging | duplicate/retry tests | empty/error/loading polish | test suite green |
| 8/1 | Cloud Run CI/CD and smoke run | devnet balance/program checks | responsive/demo polish | candidate release |
| 8/2 | bug freeze, reset/seed, evidence capture | transaction rehearsal | video flow and screenshots | final recorded demo |
| 8/3 | README, architecture, submission support | transaction proof export | 3-minute video/PPT support | submit before 23:59 |

## 3. Milestones

### M0 — Repository and cloud baseline

- monorepo and toolchains
- Cloud Build/Artifact Registry/Cloud Run skeletons
- Firestore and demo seed
- `/healthz`, `/readyz`, `/version`

### M1 — Matching and bounded autonomy

- Promotion schema
- creator fixtures
- pure policy engine
- deterministic matching and explanation
- visible policy block

### M2 — A2A negotiation

- Creator AgentCard
- A2A send/get/stream or subscribe
- Brand Agent client
- max five rounds
- Agreement Artifact

### M3 — Autonomous payment

- canonical hash
- private gateway
- devnet escrow lock
- receipt/timeline
- pay.sh sandbox paid verification

### M4 — Delivery and settlement

- evidence URL
- structured observations and policy decision
- milestone release
- duplicate/retry safety

### M5 — Submission quality

- live URL
- reproducible README
- 3-minute demo
- logs, transaction signatures and architecture visual

## 4. Critical path

```text
schema/policy -> A2A agreement -> agreement hash -> escrow lock -> evidence -> release -> demo video
```

UI can proceed in parallel using committed API fixtures, but fixture shapes must match documented contracts.
