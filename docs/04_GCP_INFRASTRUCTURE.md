# GCP Infrastructure Specification

## 1. Required services

| GCP service | Use |
|---|---|
| Cloud Run | Web, API, Creator A2A server and web3 gateway containers |
| Vertex AI | Gemini inference for matching explanation, negotiation and evidence analysis |
| Firestore Native mode | Primary operational and audit database |
| Firebase Authentication | Demo user identity and ID tokens |
| Secret Manager | Solana demo signer, pay.sh token if required and service secrets |
| Artifact Registry | Container images |
| Cloud Build | Build, test and deploy pipeline |
| Cloud Tasks | Durable asynchronous execution and retry |
| Cloud Storage | Optional evidence snapshots and exported demo artifacts |
| Cloud Logging / Monitoring / Trace | Structured logs, alerts, latency and correlation tracing |
| IAM | Service-to-service authentication and least privilege |

## 2. Resource naming

```text
Project: knot-agentic-dev
Region: us-central1
Artifact repository: knot-containers
Cloud Run:
  knot-web
  knot-api
  knot-creator-agent
  knot-web3
Task queue: knot-agent-tasks
Storage bucket: <project>-knot-evidence
Service accounts:
  knot-web-sa
  knot-api-sa
  knot-creator-agent-sa
  knot-web3-sa
  knot-build-sa
```

Actual project ID must be configured, not hardcoded.

## 3. IAM matrix

| Principal | Minimum access |
|---|---|
| `knot-web-sa` | no Firestore admin, no secret access |
| `knot-api-sa` | Firestore user, Vertex AI user, Cloud Tasks enqueuer, invoke creator-agent and web3 |
| `knot-creator-agent-sa` | Firestore user, Vertex AI user, logging writer |
| `knot-web3-sa` | Firestore limited access, selected Secret Manager secret accessor, logging writer |
| `knot-build-sa` | Artifact Registry writer, Cloud Run developer, service account user |

Do not grant project-wide Owner or Editor to runtime service accounts.

## 4. Required APIs

Terraform or bootstrap scripts enable at least:

```text
run.googleapis.com
artifactregistry.googleapis.com
cloudbuild.googleapis.com
aiplatform.googleapis.com
firestore.googleapis.com
secretmanager.googleapis.com
cloudtasks.googleapis.com
logging.googleapis.com
monitoring.googleapis.com
cloudtrace.googleapis.com
iam.googleapis.com
cloudresourcemanager.googleapis.com
```

## 5. Firestore

- Native mode, selected once during bootstrap.
- Server code uses Admin SDK/client libraries.
- Browser does not receive privileged direct-write access to business collections.
- Composite indexes are tracked in source.
- Transactions protect negotiation-round increments, escrow state and settlement idempotency.

## 6. CI/CD

Preferred path:

1. GitHub push or pull request triggers Cloud Build.
2. Run service-specific lint, typecheck and tests.
3. Build container and push immutable SHA tag to Artifact Registry.
4. Deploy only the changed service to Cloud Run.
5. Run smoke test.
6. Record deployed revision and Git SHA.

Use substitutions for project, region and service names. Do not place secrets in `cloudbuild.yaml`.

## 7. Cost controls

- One project is sufficient for the hackathon.
- Use scale-to-zero except demo window.
- Set maximum Cloud Run instances.
- Use Gemini Flash-class model by environment variable.
- Apply task retry limits.
- Configure budget alerts.
- Delete stale image tags and disable minimum instances after Demo Day.
