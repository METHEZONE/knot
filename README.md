# KNOT v1

KNOT is an agentic promotion workflow for Brands and Creators.

```text
Firebase login
-> one-page role onboarding
-> role dashboard
-> Promotion / Offer
-> HTTP A2A negotiation
-> Agreement
-> evidence verification
-> Solana Devnet escrow lock/release through Web3 Gateway
```

## Current Status

- Frontend: Next.js + TypeScript.
- Backend: FastAPI Product API, Brand orchestration, Creator A2A service, Firestore repository boundary.
- A2A: HTTP+JSON Creator A2A Service with AgentCard discovery, service auth, server-created Task, multi-turn negotiation, final Agreement Artifact.
- Escrow: Product API requires confirmed Web3 Gateway receipts with real Solana Devnet signatures for successful lock/release. Local simulated gateway receipts are rejected by Product API as escrow success.
- Dev Admin: `/dev/admin` calls protected Product API endpoints requiring Firebase admin claim or server allowlist.

External Solana devnet smoke is blocked until safe existing devnet signer/RPC/program configuration is provided. No mainnet or real-value transfer is used.

## Source Of Truth

Read `AGENTS.md`, then use `docs/00_DOCUMENT_INDEX.md` for task-specific documents.

Important status files:

- `docs/IMPLEMENTATION_STATUS.md`
- `docs/HANDOFF.md`
- `.agent/execplans/`

## Environment

Backend:

```text
KNOT_AUTH_MODE=firebase
FIREBASE_PROJECT_ID=knot-dev-503505
KNOT_REPOSITORY_BACKEND=firestore
GOOGLE_CLOUD_PROJECT=knot-dev-503505
KNOT_CREATOR_A2A_MODE=http
CREATOR_AGENT_BASE_URL=http://localhost:8081/a2a/v1
KNOT_A2A_SERVICE_TOKEN=...
KNOT_WEB3_MODE=gateway
WEB3_GATEWAY_BASE_URL=http://localhost:8082
KNOT_DEV_ADMIN_ENABLED=false
KNOT_DEV_ADMIN_ALLOWLIST=
```

Frontend:

```text
NEXT_PUBLIC_KNOT_DATA_MODE=api
KNOT_API_BASE_URL=http://127.0.0.1:18080
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=knot-dev-503505.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=knot-dev-503505
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

Web3 Gateway devnet signing requires existing safe development credentials:

```text
KNOT_WEB3_SIGNING_MODE=devnet
SOLANA_RPC_URL=...
KNOT_ESCROW_PROGRAM_ID=...
KNOT_USDC_MINT=...
KNOT_BRAND_KEYPAIR_JSON=...
KNOT_CREATOR_KEYPAIR_JSON=...
KNOT_AGENT_KEYPAIR_JSON=...
```

Do not commit secrets, private keys, service account JSON, seed phrases, or tokens.

## Local Checks

Backend:

```text
python3 -m venv .venv
.venv/bin/python -m pip install -e 'backend[dev]'
cd backend
../.venv/bin/python -m ruff check apps libs tests
../.venv/bin/python -m pytest tests
```

Frontend:

```text
cd frontend
npm install
npm run typecheck
npm run lint
npm run test
npm run build
```

## Demo Seed Data

Memory-only verification:

```text
.venv/bin/python scripts/seed_demo.py --target memory
```

Firestore demo reseed is restricted to the configured demo project and requires an explicit confirmation:

```text
ALLOW_DEMO_DATA_RESET=true DEMO_PROJECT_ID=knot-dev-503505 \
.venv/bin/python scripts/seed_demo.py --target firestore --project knot-dev-503505 --confirm=RESET_KNOT_DEMO_DATA
```

Do not run Firestore reseed against production or unknown projects. The script does not create Firebase Auth users; it seeds Product API/Firestore fixture documents only.

Web3 Gateway:

```text
cd web3/gateway
npm install
npm run build
npm run lint
npm run test
```

## Deployment Notes

All off-chain runtime targets Google Cloud:

- Frontend: Cloud Run.
- Product API: Cloud Run.
- Creator A2A Service: Cloud Run.
- Web3 Gateway: private Cloud Run.
- Database: Firestore Native mode.

Do not deploy, change IAM, rotate secrets, fund wallets, or send devnet transactions unless the operator explicitly approves that external action.
