# KNOT v1 Documentation Index

| Document | Purpose | Read when |
|---|---|---|
| `01_PRD_v1.md` | Product goal, user flow, success criteria | Every feature task |
| `02_SCOPE_GLOSSARY.md` | In/out scope and canonical terminology | Every task |
| `03_SYSTEM_ARCHITECTURE.md` | Service boundaries and E2E flow | Backend, infra, integration |
| `04_GCP_INFRASTRUCTURE.md` | Required GCP resources and IAM | Infra and deployment |
| `05_REPOSITORY_STRUCTURE.md` | Monorepo directories and ownership | Bootstrap and refactors |
| `06_DOMAIN_DATA_MODEL.md` | Firestore collections and domain invariants | Backend and frontend data work |
| `07_API_CONTRACTS.md` | Product API and error contracts | Frontend/backend integration |
| `08_AGENT_ADK_DESIGN.md` | ADK agents, tools, prompts, structured output | Agent work |
| `09_A2A_PROTOCOL_v1.md` | Official A2A binding and KNOT mapping | Negotiation and streaming |
| `10_POLICY_MATCHING.md` | Bounded autonomy and agent matching | Agent/policy implementation |
| `11_WEB3_PAYMENT_ESCROW.md` | Web3 gateway, escrow and pay.sh | Payment work |
| `12_SECURITY.md` | Auth, secrets, keys, abuse and data controls | Every security-sensitive task |
| `13_TEST_QA.md` | Test pyramid and acceptance tests | Every implementation task |
| `14_DEPLOYMENT_RUNBOOK.md` | Local, devnet and Cloud Run deployment | Infra/release |
| `15_OBSERVABILITY.md` | Logs, traces, metrics and audit events | Backend/ops |
| `16_WBS.md` | Work breakdown and delivery sequence | Planning and daily sync |
| `17_DEMO_ACCEPTANCE.md` | Demo script and submission gates | Integration and submission |
| `18_CODEX_WORKFLOW.md` | How to delegate safely to Codex | Every Codex session |
| `19_ARCHITECTURE_DECISIONS.md` | Accepted ADRs and open questions | Architecture changes |
| `20_IMPLEMENTATION_STATUS.md` | Living status and handoff memory | End of every task |
| `21_REFERENCES.md` | Official and internal source list | Verification and research |
| `22_FIRESTORE_RUNBOOK.md` | Firestore setup, seed, indexes, invariants and verification | DB/API persistence work |
| `23_EXPERIENCE_PRD_v2.md` | Experience layer: onboarding, agent hatching, expedition map, replay sharing, dual dashboards | Frontend and onboarding work |
| `24_PRODUCT_FLOW_AND_FEATURES.md` | Current implemented product flow, feature inventory, deployment baseline and remaining gaps | Product demo handoff and status review |

## Minimal context set per task

Always load `01`, `02`, and `03`. Add only task-specific documents to avoid stale duplicated context.
