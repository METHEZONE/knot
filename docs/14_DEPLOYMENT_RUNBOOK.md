# Deployment and Demo Runbook

## 1. Environments

```text
local: Firestore emulator + local Solana validator + model stubs/pay.sh sandbox
dev: GCP Cloud Run + Firestore + Vertex AI + Solana devnet
mainnet/prod: out of v1 scope
```

## 2. Bootstrap order

1. Create/select one GCP project and set billing/budget alert.
2. Enable required APIs.
3. Create Artifact Registry.
4. Create service accounts and IAM bindings.
5. Create Firestore Native database.
6. Create Secret Manager entries with placeholders.
7. Deploy the Solana program to devnet and record program ID.
8. Deploy `knot-web3` privately.
9. Deploy `knot-creator-agent` privately.
10. Deploy `knot-api` with service invocation permissions.
11. Deploy `knot-web` publicly.
12. Run seed and smoke scripts.

Current helper scripts:

```text
PROJECT_ID=<gcp-project-id> REGION=us-central1 ./scripts/bootstrap_gcp.sh
GOOGLE_CLOUD_PROJECT=<gcp-project-id> .venv/bin/python scripts/reset_demo.py --target firestore
GOOGLE_CLOUD_PROJECT=<gcp-project-id> .venv/bin/python scripts/seed_demo.py --target firestore
GOOGLE_CLOUD_PROJECT=<gcp-project-id> .venv/bin/python scripts/firestore_smoke.py --target firestore
```

`bootstrap_gcp.sh` enables required APIs, creates the Artifact Registry
repository, creates service accounts, grants minimal Firestore/Vertex roles for
the backend agents, and creates Firestore Native `(default)` when absent. It does
not create or store any secrets.

Backend Cloud Run build/deploy skeleton:

```text
PROJECT_ID=<gcp-project-id> SERVICE=knot-api ./scripts/deploy_backend_cloudrun.sh
PROJECT_ID=<gcp-project-id> SERVICE=knot-creator-agent DOCKERFILE=backend/apps/creator_agent/Dockerfile ./scripts/deploy_backend_cloudrun.sh
```

The API service is public in the current integration skeleton so frontend
developers can connect before Firebase verification is implemented. Creator
Agent remains private by default.

## 3. Configuration

All services receive immutable deployment configuration through environment variables and Secret Manager mounts/references. See `.env.example`.

Never use one shared `.env` file in production.

## 4. Database seed/reset

`seed_demo.py` must be idempotent and create known IDs or print generated IDs. `reset_demo.py` deletes only documents with a demo namespace/label and must not delete unrelated data.

Seed output includes:

- demo login accounts or UID mapping
- Promotion ID
- creator agent IDs
- wallet public keys
- expected initial status

Current reset implementation deletes known v1 demo documents and subcollections
for seeded IDs and generated demo prefixes such as `promotion-`, `match-`,
`negotiation-`, `task-`, `agreement-`, `evidence-`, and `event-`. Use
`--dry-run` before destructive cloud resets.

## 5. Smoke test

The smoke script checks:

- `/version` for every service
- authenticated API request
- Firestore read/write
- Vertex AI structured response
- A2A AgentCard and message request
- web3 gateway simulation
- frontend URL

Current committed smoke coverage:

```text
.venv/bin/python scripts/api_smoke.py
.venv/bin/python scripts/api_smoke.py --base-url <api-url>
```

The live URL mode requires the target Firestore database to be seeded first.

## 6. Demo-day preparation

- deploy immutable Git SHA
- set backend minimum instances to 1 shortly before demo
- reset and reseed
- verify devnet balances and program
- pre-run one non-recorded transaction
- confirm pay.sh sandbox/resource availability
- record fallback video after successful run
- export transaction signatures and key screenshots

## 7. Rollback

Cloud Run rollback uses the last known good revision. Data migrations must be additive for v1. If an incompatible schema is unavoidable, provide a reversible migration script before deployment.
