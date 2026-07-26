#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-knot-dev-503505}"
REGION="${REGION:-us-central1}"
REPOSITORY="${REPOSITORY:-knot}"
TAG="${TAG:-$(git rev-parse --short HEAD)}"

AR_HOST="${REGION}-docker.pkg.dev"
IMAGE_BASE="${AR_HOST}/${PROJECT_ID}/${REPOSITORY}"

build_image() {
  local config="$1"
  local image="$2"
  gcloud builds submit \
    --project="${PROJECT_ID}" \
    --config="${config}" \
    --substitutions="_IMAGE=${image}" \
    .
}

deploy_service() {
  local service="$1"
  local image="$2"
  shift 2
  gcloud run deploy "${service}" \
    --project="${PROJECT_ID}" \
    --region="${REGION}" \
    --image="${image}" \
    "$@"
}

service_url() {
  local service="$1"
  gcloud run services describe "${service}" \
    --project="${PROJECT_ID}" \
    --region="${REGION}" \
    --format="value(status.url)"
}

API_IMAGE="${IMAGE_BASE}/knot-api:${TAG}"
CREATOR_IMAGE="${IMAGE_BASE}/knot-creator-agent:${TAG}"
WEB3_IMAGE="${IMAGE_BASE}/knot-web3:${TAG}"
WEB_IMAGE="${IMAGE_BASE}/knot-web:${TAG}"

build_image "infra/cloudbuild/api.yaml" "${API_IMAGE}"
build_image "infra/cloudbuild/creator-agent.yaml" "${CREATOR_IMAGE}"
build_image "infra/cloudbuild/web3.yaml" "${WEB3_IMAGE}"
build_image "infra/cloudbuild/web.yaml" "${WEB_IMAGE}"

deploy_service "knot-creator-agent" "${CREATOR_IMAGE}" \
  --allow-unauthenticated \
  --set-env-vars="KNOT_SERVICE_NAME=knot-creator-agent,GOOGLE_CLOUD_PROJECT=${PROJECT_ID},GCP_PROJECT_ID=${PROJECT_ID},KNOT_GEMINI_MODE=vertex,VERTEX_AI_LOCATION=us-central1,GEMINI_MODEL=gemini-2.5-flash"

deploy_service "knot-web3" "${WEB3_IMAGE}" \
  --allow-unauthenticated \
  --min-instances=1 \
  --set-env-vars="KNOT_SERVICE_NAME=knot-web3,SOLANA_CLUSTER=devnet,SOLANA_RPC_URL=https://api.devnet.solana.com,KNOT_WEB3_SIGNING_MODE=simulated"

CREATOR_URL="$(service_url "knot-creator-agent")/a2a/v1"
WEB3_URL="$(service_url "knot-web3")"

deploy_service "knot-api" "${API_IMAGE}" \
  --allow-unauthenticated \
  --set-env-vars="KNOT_REPOSITORY_BACKEND=firestore,GOOGLE_CLOUD_PROJECT=${PROJECT_ID},GCP_PROJECT_ID=${PROJECT_ID},KNOT_SERVICE_NAME=knot-api,KNOT_CREATOR_A2A_MODE=http,CREATOR_AGENT_BASE_URL=${CREATOR_URL},KNOT_WEB3_MODE=gateway,WEB3_GATEWAY_BASE_URL=${WEB3_URL},KNOT_GEMINI_MODE=vertex,VERTEX_AI_LOCATION=us-central1,GEMINI_MODEL=gemini-2.5-flash,PAYSH_MODE=sandbox,PAYSH_RESOURCE_ID=${PAYSH_RESOURCE_ID:-replace-me},PAYSH_TIMEOUT_SECONDS=90"

API_URL="$(service_url "knot-api")"

deploy_service "knot-web" "${WEB_IMAGE}" \
  --allow-unauthenticated \
  --set-env-vars="NEXT_PUBLIC_KNOT_DATA_MODE=api,KNOT_API_BASE_URL=${API_URL},NEXT_PUBLIC_KNOT_API_BASE_URL=${API_URL}"

WEB_URL="$(service_url "knot-web")"

echo "knot-api: ${API_URL}"
echo "knot-creator-agent: ${CREATOR_URL}"
echo "knot-web3: ${WEB3_URL}"
echo "knot-web: ${WEB_URL}"
