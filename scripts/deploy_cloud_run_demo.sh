#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-knot-dev-503505}"
REGION="${REGION:-us-central1}"
REPOSITORY="${REPOSITORY:-knot}"
TAG="${TAG:-$(git rev-parse --short HEAD)}"
A2A_SECRET_NAME="${A2A_SECRET_NAME:-knot-a2a-service-token}"
WEB3_SIGNING_MODE="${KNOT_WEB3_SIGNING_MODE:-devnet}"
SOLANA_CLUSTER="${SOLANA_CLUSTER:-devnet}"
SOLANA_RPC_URL="${SOLANA_RPC_URL:-https://api.devnet.solana.com}"
KNOT_USDC_MINT="${KNOT_USDC_MINT:-4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU}"
KNOT_ESCROW_PROGRAM_ID="${KNOT_ESCROW_PROGRAM_ID:-Aj63B5hLtvJdNQiAi61rMrgfW3pt8Lak3GQB59B6jysj}"
BRAND_KEYPAIR_SECRET_NAME="${BRAND_KEYPAIR_SECRET_NAME:-knot-web3-brand-keypair-json}"
CREATOR_KEYPAIR_SECRET_NAME="${CREATOR_KEYPAIR_SECRET_NAME:-knot-web3-creator-keypair-json}"
AGENT_KEYPAIR_SECRET_NAME="${AGENT_KEYPAIR_SECRET_NAME:-knot-web3-agent-keypair-json}"

AR_HOST="${REGION}-docker.pkg.dev"
IMAGE_BASE="${AR_HOST}/${PROJECT_ID}/${REPOSITORY}"

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required environment variable: ${name}" >&2
    exit 1
  fi
}

build_image() {
  local config="$1"
  local image="$2"
  shift 2
  local substitutions="_IMAGE=${image}"
  local substitution
  for substitution in "$@"; do
    substitutions="${substitutions},${substitution}"
  done
  gcloud builds submit \
    --project="${PROJECT_ID}" \
    --config="${config}" \
    --substitutions="${substitutions}" \
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
WEB_IMAGE="${IMAGE_BASE}/knot-web:${TAG}"
WEB3_IMAGE="${IMAGE_BASE}/knot-web3:${TAG}"

require_env "NEXT_PUBLIC_FIREBASE_API_KEY"
require_env "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"
require_env "NEXT_PUBLIC_FIREBASE_PROJECT_ID"
require_env "NEXT_PUBLIC_FIREBASE_APP_ID"
require_env "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"
require_env "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"
require_env "NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID"
require_env "PAYSH_RESOURCE_ID"

if [[ "${WEB3_SIGNING_MODE}" == "devnet" ]]; then
  echo "▸ Web3 Gateway will run in devnet signing mode."
  echo "  Required Secret Manager secrets:"
  echo "  - ${BRAND_KEYPAIR_SECRET_NAME} -> KNOT_BRAND_KEYPAIR_JSON"
  echo "  - ${CREATOR_KEYPAIR_SECRET_NAME} -> KNOT_CREATOR_KEYPAIR_JSON"
  echo "  - ${AGENT_KEYPAIR_SECRET_NAME} -> KNOT_AGENT_KEYPAIR_JSON"
fi

build_image "infra/cloudbuild/web3.yaml" "${WEB3_IMAGE}"
deploy_service "knot-web3" "${WEB3_IMAGE}" \
  --allow-unauthenticated \
  --set-env-vars="KNOT_SERVICE_NAME=knot-web3,GIT_SHA=${TAG},GOOGLE_CLOUD_PROJECT=${PROJECT_ID},GCP_PROJECT_ID=${PROJECT_ID},SOLANA_CLUSTER=${SOLANA_CLUSTER},SOLANA_RPC_URL=${SOLANA_RPC_URL},KNOT_WEB3_SIGNING_MODE=${WEB3_SIGNING_MODE},KNOT_ESCROW_PROGRAM_ID=${KNOT_ESCROW_PROGRAM_ID},KNOT_USDC_MINT=${KNOT_USDC_MINT}" \
  --set-secrets="KNOT_BRAND_KEYPAIR_JSON=${BRAND_KEYPAIR_SECRET_NAME}:latest,KNOT_CREATOR_KEYPAIR_JSON=${CREATOR_KEYPAIR_SECRET_NAME}:latest,KNOT_AGENT_KEYPAIR_JSON=${AGENT_KEYPAIR_SECRET_NAME}:latest"

WEB3_URL="$(service_url "knot-web3")"

build_image "infra/cloudbuild/creator-agent.yaml" "${CREATOR_IMAGE}"
deploy_service "knot-creator-agent" "${CREATOR_IMAGE}" \
  --allow-unauthenticated \
  --set-env-vars="KNOT_SERVICE_NAME=knot-creator-agent,KNOT_REPOSITORY_BACKEND=firestore,GOOGLE_CLOUD_PROJECT=${PROJECT_ID},GCP_PROJECT_ID=${PROJECT_ID},CREATOR_AGENT_BASE_URL=$(service_url "knot-creator-agent")/a2a/v1,KNOT_GEMINI_MODE=vertex,VERTEX_AI_LOCATION=us-central1,GEMINI_MODEL=gemini-2.5-flash" \
  --set-secrets="KNOT_A2A_SERVICE_TOKEN=${A2A_SECRET_NAME}:latest"

CREATOR_URL="$(service_url "knot-creator-agent")/a2a/v1"

build_image "infra/cloudbuild/api.yaml" "${API_IMAGE}"
deploy_service "knot-api" "${API_IMAGE}" \
  --allow-unauthenticated \
  --set-env-vars="KNOT_REPOSITORY_BACKEND=firestore,GOOGLE_CLOUD_PROJECT=${PROJECT_ID},GCP_PROJECT_ID=${PROJECT_ID},KNOT_AUTH_MODE=firebase,FIREBASE_PROJECT_ID=${PROJECT_ID},KNOT_SERVICE_NAME=knot-api,KNOT_CREATOR_A2A_MODE=http,CREATOR_AGENT_BASE_URL=${CREATOR_URL},CREATOR_A2A_TIMEOUT_SECONDS=60,KNOT_WEB3_MODE=gateway,WEB3_GATEWAY_BASE_URL=${WEB3_URL},KNOT_AGENT_AUTO_SETTLEMENT=1,SOLANA_CLUSTER=${SOLANA_CLUSTER},SOLANA_RPC_URL=${SOLANA_RPC_URL},KNOT_ESCROW_PROGRAM_ID=${KNOT_ESCROW_PROGRAM_ID},KNOT_USDC_MINT=${KNOT_USDC_MINT},KNOT_GEMINI_MODE=vertex,VERTEX_AI_LOCATION=us-central1,GEMINI_MODEL=gemini-2.5-flash,PAYSH_MODE=sandbox,PAYSH_RESOURCE_ID=${PAYSH_RESOURCE_ID},PAYSH_TIMEOUT_SECONDS=90" \
  --set-secrets="KNOT_A2A_SERVICE_TOKEN=${A2A_SECRET_NAME}:latest"

API_URL="$(service_url "knot-api")"

build_image "infra/cloudbuild/web.yaml" "${WEB_IMAGE}" \
  "_NEXT_PUBLIC_FIREBASE_API_KEY=${NEXT_PUBLIC_FIREBASE_API_KEY}" \
  "_NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN}" \
  "_NEXT_PUBLIC_FIREBASE_PROJECT_ID=${NEXT_PUBLIC_FIREBASE_PROJECT_ID}" \
  "_NEXT_PUBLIC_FIREBASE_APP_ID=${NEXT_PUBLIC_FIREBASE_APP_ID}" \
  "_NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=${NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}" \
  "_NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=${NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID}" \
  "_NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=${NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID}" \
  "_NEXT_PUBLIC_KNOT_DATA_MODE=api"
deploy_service "knot-web" "${WEB_IMAGE}" \
  --allow-unauthenticated \
  --set-env-vars="NEXT_PUBLIC_KNOT_DATA_MODE=api,KNOT_API_BASE_URL=${API_URL},NEXT_PUBLIC_KNOT_API_BASE_URL=${API_URL}"

WEB_URL="$(service_url "knot-web")"

echo "knot-api: ${API_URL}"
echo "knot-creator-agent: ${CREATOR_URL}"
echo "knot-web3: ${WEB3_URL}"
echo "knot-web: ${WEB_URL}"
