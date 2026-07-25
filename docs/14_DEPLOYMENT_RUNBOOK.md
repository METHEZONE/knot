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

Current dev project:

```text
PROJECT_ID=knot-dev-503505
REGION=us-central1
```

Project switch checklist:

```text
gcloud auth login
gcloud auth application-default login
gcloud config set project knot-dev-503505
gcloud auth application-default set-quota-project knot-dev-503505
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com aiplatform.googleapis.com firestore.googleapis.com secretmanager.googleapis.com cloudtasks.googleapis.com logging.googleapis.com monitoring.googleapis.com cloudtrace.googleapis.com iam.googleapis.com cloudresourcemanager.googleapis.com --project=knot-dev-503505
gcloud firestore databases list --project=knot-dev-503505
gcloud firestore databases create --database='(default)' --location=us-central1 --type=firestore-native --project=knot-dev-503505
```

Run the Firestore create command only if the list command shows no default
database. Firestore mode and location are one-time choices.

Required service accounts in `knot-dev-503505`:

```text
knot-web-sa@knot-dev-503505.iam.gserviceaccount.com
knot-api-sa@knot-dev-503505.iam.gserviceaccount.com
knot-creator-agent-sa@knot-dev-503505.iam.gserviceaccount.com
knot-web3-sa@knot-dev-503505.iam.gserviceaccount.com
knot-build-sa@knot-dev-503505.iam.gserviceaccount.com
```

Minimum IAM to recreate after the project switch:

- `knot-api-sa`: `roles/datastore.user`, `roles/aiplatform.user`, Cloud Tasks enqueuer, invoker for private Creator Agent and Web3 services.
- `knot-creator-agent-sa`: `roles/datastore.user`, `roles/aiplatform.user`, logging writer.
- `knot-web3-sa`: Firestore read/validation access, logging writer and Secret Manager access only for selected signer/pay.sh secrets.
- `knot-build-sa`: Artifact Registry writer, Cloud Run developer and service account user.

Firebase project settings must also point frontend env to `knot-dev-503505`:

```text
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=knot-dev-503505.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=knot-dev-503505
```

## 3. Configuration

All services receive immutable deployment configuration through environment variables and Secret Manager mounts/references. See `.env.example`.

Never use one shared `.env` file in production.

Local `.env` may mirror `.env.example`, but it is intentionally ignored by git.

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
