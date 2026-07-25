#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-${GOOGLE_CLOUD_PROJECT:-${GCP_PROJECT_ID:-}}}"
REGION="${REGION:-${GCP_REGION:-us-central1}}"
ARTIFACT_REPOSITORY="${ARTIFACT_REPOSITORY:-knot-containers}"

if [[ -z "${PROJECT_ID}" ]]; then
  echo "PROJECT_ID, GOOGLE_CLOUD_PROJECT, or GCP_PROJECT_ID is required." >&2
  exit 1
fi

gcloud config set project "${PROJECT_ID}"
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  aiplatform.googleapis.com \
  firestore.googleapis.com \
  secretmanager.googleapis.com \
  cloudtasks.googleapis.com \
  logging.googleapis.com \
  monitoring.googleapis.com \
  cloudtrace.googleapis.com \
  iam.googleapis.com \
  cloudresourcemanager.googleapis.com \
  --project="${PROJECT_ID}"

gcloud artifacts repositories describe "${ARTIFACT_REPOSITORY}" \
  --location="${REGION}" \
  --project="${PROJECT_ID}" >/dev/null 2>&1 || \
gcloud artifacts repositories create "${ARTIFACT_REPOSITORY}" \
  --repository-format=docker \
  --location="${REGION}" \
  --description="KNOT Cloud Run container images" \
  --project="${PROJECT_ID}"

for service_account in knot-api-sa knot-creator-agent-sa knot-web3-sa knot-web-sa knot-build-sa; do
  email="${service_account}@${PROJECT_ID}.iam.gserviceaccount.com"
  gcloud iam service-accounts describe "${email}" --project="${PROJECT_ID}" >/dev/null 2>&1 || \
  gcloud iam service-accounts create "${service_account}" \
    --display-name="${service_account}" \
    --project="${PROJECT_ID}"
done

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:knot-api-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/datastore.user" \
  --condition=None >/dev/null
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:knot-creator-agent-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/datastore.user" \
  --condition=None >/dev/null
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:knot-api-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user" \
  --condition=None >/dev/null
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:knot-creator-agent-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user" \
  --condition=None >/dev/null

if ! gcloud firestore databases list --project="${PROJECT_ID}" \
  --format="value(name)" | grep -q "projects/${PROJECT_ID}/databases/(default)"; then
  gcloud firestore databases create \
    --database="(default)" \
    --location="${REGION}" \
    --type=firestore-native \
    --project="${PROJECT_ID}"
fi

echo "GCP bootstrap complete for ${PROJECT_ID} in ${REGION}."
