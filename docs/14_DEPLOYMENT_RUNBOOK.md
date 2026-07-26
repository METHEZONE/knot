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

## 5. Demo Cloud Run deploy

The current repository has a direct demo deploy script for the four Cloud Run
services. It builds immutable images from the current Git SHA tag, deploys the
Creator A2A server and web3 gateway first, reads their Cloud Run URLs, then
deploys Product API and frontend with those URLs.

```text
PROJECT_ID=knot-dev-503505 REGION=us-central1 ./scripts/deploy_cloud_run_demo.sh
```

Current script behavior:

- `knot-web`: public Cloud Run service, Next.js API mode.
- `knot-api`: public demo service, Firestore repository, Vertex Gemini enabled,
  Creator A2A HTTP mode, web3 gateway mode and pay.sh sandbox mode.
- `knot-creator-agent`: public demo A2A HTTP service with Vertex Gemini enabled.
- `knot-web3`: public demo gateway in `KNOT_WEB3_SIGNING_MODE=simulated`.

This public setup is for hackathon demo iteration only. The target production
topology still requires private IAM/OIDC invocation for `knot-creator-agent`
and `knot-web3`.

`knot-api` should set `CREATOR_A2A_TIMEOUT_SECONDS=60` on Cloud Run because a
cold Creator Agent revision plus Vertex Gemini rationale generation can exceed
the local 10-second HTTP client default.

To switch the deployed gateway from simulated receipts to real devnet
transactions, mount Secret Manager values for the brand, creator and agent
devnet signer keypairs and set:

```text
KNOT_WEB3_SIGNING_MODE=devnet
KNOT_BRAND_KEYPAIR_PATH=/secrets/<brand-keypair-file>
KNOT_CREATOR_KEYPAIR_PATH=/secrets/<creator-keypair-file>
KNOT_AGENT_KEYPAIR_PATH=/secrets/<agent-keypair-file>
```

Use Secret Manager mounts or secret env vars only. Do not commit keypair JSON,
private keys or seed phrases.

To make pay.sh produce a fresh live sandbox receipt, deploy `knot-api` with a
real priced sandbox resource:

```text
PAYSH_MODE=sandbox
PAYSH_RESOURCE_ID=<pay.sh sandbox resource URL or ID>
```

The API image installs the `pay` CLI so this works in Cloud Run even when the
CLI is not installed on a local developer machine.

## 6. Smoke test

The smoke script checks:

- `/version` for every service
- authenticated API request
- Firestore read/write
- Vertex AI structured response
- A2A AgentCard and message request
- web3 gateway simulation
- frontend URL

Current manual Cloud Run smoke:

```text
curl -sS https://<knot-api-url>/readyz
curl -sS https://<knot-api-url>/api/v1/promotions
curl -sS https://<knot-creator-agent-url>/readyz
curl -sS https://<knot-web3-url>/readyz
curl -sS https://<knot-web-url>/login
curl -sS https://<knot-web-url>/api/v1/promotions
```

## 7. Demo-day preparation

- deploy immutable Git SHA
- set backend minimum instances to 1 shortly before demo
- reset and reseed
- verify devnet balances and program
- pre-run one non-recorded transaction
- confirm pay.sh sandbox/resource availability
- record fallback video after successful run
- export transaction signatures and key screenshots

## 8. Rollback

Cloud Run rollback uses the last known good revision. Data migrations must be additive for v1. If an incompatible schema is unavoidable, provide a reversible migration script before deployment.
