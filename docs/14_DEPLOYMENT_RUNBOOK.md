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

## 5. Smoke test

The smoke script checks:

- `/version` for every service
- authenticated API request
- Firestore read/write
- Vertex AI structured response
- A2A AgentCard and message request
- web3 gateway simulation
- frontend URL

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
