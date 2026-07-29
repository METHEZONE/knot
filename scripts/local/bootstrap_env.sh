#!/usr/bin/env bash
# Create safe local-only env files for the KNOT full-stack dev runner.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ROOT_ENV="$ROOT/.env.local"
FRONTEND_ENV="$ROOT/frontend/.env.local"

write_if_missing() {
  local path="$1"
  local label="$2"
  local body="$3"
  if [[ -f "$path" ]]; then
    echo "  = $label already exists: ${path#$ROOT/}"
    return 0
  fi
  printf "%s\n" "$body" >"$path"
  echo "  + wrote $label: ${path#$ROOT/}"
}

echo "▸ Local env bootstrap"

write_if_missing "$ROOT_ENV" "backend/web3 env" "# KNOT local-only runtime.
# Do not rename this to .env: backend/libs/settings/config.py auto-loads .env
# during tests, which can contaminate pytest with emulator settings.
KNOT_ENV=local
GCP_PROJECT_ID=demo-knot
GOOGLE_CLOUD_PROJECT=demo-knot
FIREBASE_PROJECT_ID=demo-knot
GCP_REGION=us-central1
GIT_SHA=local
LOG_LEVEL=INFO

# Local data/auth path.
KNOT_AUTH_MODE=emulator
KNOT_REPOSITORY_BACKEND=memory
KNOT_CREATOR_A2A_MODE=http
CREATOR_AGENT_BASE_URL=http://127.0.0.1:8081/a2a/v1
CREATOR_A2A_TIMEOUT_SECONDS=30

# Local Product API and Web3 gateway.
KNOT_API_BASE_URL=http://127.0.0.1:18080
NEXT_PUBLIC_KNOT_API_BASE_URL=http://127.0.0.1:18080
WEB3_GATEWAY_BASE_URL=http://127.0.0.1:8082
KNOT_WEB3_MODE=gateway
KNOT_WEB3_SIGNING_MODE=simulated

# Simulated gateway stamps real configured identifiers but does not sign.
KNOT_ESCROW_NETWORK=solanaDevnet
KNOT_ESCROW_PROGRAM_ID=Aj63B5hLtvJdNQiAi61rMrgfW3pt8Lak3GQB59B6jysj
KNOT_USDC_MINT=4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU

# LLM/payment integrations are off or sandboxed locally.
KNOT_GEMINI_MODE=off
GEMINI_MODEL=gemini-2.5-flash
PAYSH_MODE=sandbox
PAYSH_RESOURCE_ID=local-sandbox
"

write_if_missing "$FRONTEND_ENV" "frontend env" "# KNOT frontend local-only runtime.
NEXT_PUBLIC_KNOT_DATA_MODE=api
KNOT_API_BASE_URL=http://127.0.0.1:18080
NEXT_PUBLIC_KNOT_API_BASE_URL=http://127.0.0.1:18080

# Firebase Auth emulator client config. Values are public local identifiers.
NEXT_PUBLIC_FIREBASE_API_KEY=demo-knot-local
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=demo-knot.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-knot
NEXT_PUBLIC_FIREBASE_APP_ID=demo-knot-local-app
NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
"

echo "▸ Done"
echo "  Run: scripts/local/dev_stack.sh"
