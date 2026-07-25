#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-${GOOGLE_CLOUD_PROJECT:-${GCP_PROJECT_ID:-}}}"
REGION="${REGION:-${GCP_REGION:-us-central1}}"
ARTIFACT_REPOSITORY="${ARTIFACT_REPOSITORY:-knot-containers}"
SERVICE="${SERVICE:-knot-api}"
DOCKERFILE="${DOCKERFILE:-backend/apps/api/Dockerfile}"
IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse --short HEAD)}"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${ARTIFACT_REPOSITORY}/${SERVICE}:${IMAGE_TAG}"

if [[ -z "${PROJECT_ID}" ]]; then
  echo "PROJECT_ID, GOOGLE_CLOUD_PROJECT, or GCP_PROJECT_ID is required." >&2
  exit 1
fi

case "${SERVICE}" in
  knot-api)
    SERVICE_ACCOUNT="knot-api-sa@${PROJECT_ID}.iam.gserviceaccount.com"
    ENV_VARS="KNOT_SERVICE_NAME=knot-api,KNOT_REPOSITORY_BACKEND=firestore,GOOGLE_CLOUD_PROJECT=${PROJECT_ID},GCP_PROJECT_ID=${PROJECT_ID},GCP_REGION=${REGION},GIT_SHA=$(git rev-parse HEAD)"
    ALLOW_UNAUTHENTICATED="${ALLOW_UNAUTHENTICATED:-true}"
    ;;
  knot-creator-agent)
    SERVICE_ACCOUNT="knot-creator-agent-sa@${PROJECT_ID}.iam.gserviceaccount.com"
    ENV_VARS="KNOT_SERVICE_NAME=knot-creator-agent,GOOGLE_CLOUD_PROJECT=${PROJECT_ID},GCP_PROJECT_ID=${PROJECT_ID},GCP_REGION=${REGION},GIT_SHA=$(git rev-parse HEAD)"
    ALLOW_UNAUTHENTICATED="${ALLOW_UNAUTHENTICATED:-false}"
    ;;
  *)
    echo "Unsupported backend SERVICE=${SERVICE}. Use knot-api or knot-creator-agent." >&2
    exit 1
    ;;
esac

gcloud builds submit \
  --project="${PROJECT_ID}" \
  --config=<(cat <<YAML
steps:
  - name: gcr.io/cloud-builders/docker
    args:
      - build
      - --file
      - ${DOCKERFILE}
      - --tag
      - ${IMAGE}
      - .
images:
  - ${IMAGE}
YAML
)

auth_flag="--no-allow-unauthenticated"
if [[ "${ALLOW_UNAUTHENTICATED}" == "true" ]]; then
  auth_flag="--allow-unauthenticated"
fi

gcloud run deploy "${SERVICE}" \
  --image="${IMAGE}" \
  --region="${REGION}" \
  --service-account="${SERVICE_ACCOUNT}" \
  --set-env-vars="${ENV_VARS}" \
  --max-instances="${MAX_INSTANCES:-3}" \
  --project="${PROJECT_ID}" \
  "${auth_flag}"
