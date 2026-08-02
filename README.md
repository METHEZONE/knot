# KNOT v1

KNOT is an agentic promotion workflow for Brands and Creators. A Brand Agent and a Creator Agent
negotiate a campaign over HTTP A2A, the agreed terms are hashed on-chain, and USDC is settled from a
Solana Devnet escrow after the promised content is verified.

```text
Google / email login
-> one-page role onboarding
-> role dashboard
-> Promotion / Offer
-> HTTP A2A negotiation
-> Agreement (terms hash)
-> Brand funds USDC escrow
-> evidence verification
-> milestone release to the Creator wallet
```

## Current Status

Baseline for this document: branch `fix/payment-rails-escrow` (the deployed demo stack).

- **Frontend**: Next.js 16 + TypeScript, Cloud Run.
- **Backend**: FastAPI Product API, Brand orchestration, Creator A2A service, Firestore repository
  boundary.
- **A2A**: HTTP+JSON Creator A2A Service with AgentCard discovery, service auth, server-created Task,
  multi-turn negotiation, and a final Agreement Artifact.
- **Escrow**: two rails live in `programs/knot-escrow`.
  - *Agreement rail* (`initialize_escrow` / `fund_escrow` / `verify_milestone` / `release_milestone`) —
    the v1 user flow. Escrow PDA is derived from the Agreement ID.
  - *Campaign rail* (`initialize_campaign` / `approve_and_release`) — legacy, blocked in the user
    flow, retained for the earlier agent-funded tests.
- **Payments**: pay.sh / x402 paid verification during Match Run, with allowlist and per-call,
  per-run, and daily USDC spend caps.
- **Dev Admin**: `/dev/admin` calls protected Product API endpoints requiring a Firebase admin claim
  or a server allowlist.

Product API rejects simulated Web3 Gateway receipts as escrow success. Only a confirmed Solana
signature counts. No mainnet or real-value transfer is used anywhere.

## Money Flow

Who signs what, and who pays the network fee:

| Step | On-chain call | Signer | Network fee paid by |
|---|---|---|---|
| Brand funds escrow | `initialize_escrow` + `fund_escrow` | Brand wallet (Phantom) | relayer if configured, otherwise the Brand |
| Evidence passes | — | — | — |
| Milestone release | `verify_milestone` + `release_milestone` | platform settlement authority (server) | relayer if configured, otherwise the settlement authority |

Two behaviours make this work without the user holding SOL or clicking through settlement:

- **Automatic settlement.** When evidence passes verification, the Product API immediately releases
  the milestone using the server-held settlement authority. No human signature. If that fails, the
  failure is recorded as `MILESTONE_AUTO_RELEASE_DEFERRED` and the manual Phantom release endpoint
  remains available as a fallback. Toggle with `KNOT_AUTO_SETTLEMENT_ON_EVIDENCE`.
- **Gas sponsorship.** When `KNOT_RELAYER_KEYPAIR_JSON` (or `_PATH`) is set, the Web3 Gateway sets the
  transaction `feePayer` to the relayer and partially signs before returning the unsigned transaction
  to the browser. The user still signs the instruction, but holds no SOL. Prepare responses carry
  `feePayer` and `gasSponsored` so the UI can show it.

Solana network fees are always paid in SOL. KNOT does not pay gas in USDC — it sponsors the SOL and
recovers the cost as a USDC fee. Use that wording.

## Wallets

| | User wallet | Settlement authority | Gas relayer |
|---|---|---|---|
| Owner | user (self) or platform (custody) | platform | platform |
| Where | Phantom, or Secret Manager `knot-user-key-{uid}` | Secret Manager / env | Secret Manager / env |
| Used for | funding escrow, receiving settlement | signing milestone release | paying network fees |

With `KNOT_USER_WALLET_PROVISION=1`, selecting a role provisions a Solana keypair for the account,
stores the secret in Secret Manager, and records `walletAddress` plus `walletCustody: "PLATFORM"` on
the user. A user who connects an external Phantom wallet through `POST /api/v1/me/wallet` overrides
it with `walletCustody: "SELF"`.

If the secret cannot be stored, no address is assigned — a payout address whose key we do not hold
would make settled USDC unrecoverable.

Custodial wallets here are devnet-only. Key rotation and recovery policy are out of v1 scope.

## Source Of Truth

Read `AGENTS.md`, then `docs/00_DOCUMENT_INDEX.md` for task-specific documents.

Important files:

- `docs/IMPLEMENTATION_STATUS.md` — capability matrix, verified evidence, known blockers.
- `docs/WALLET_LOGIN_FEE_AND_PAYSH_DECISION.md` — wallet login, gas sponsorship, and pay.sh decisions.
- `docs/BLOCKCHAIN_NARRATIVE.md` — judge-facing narrative and what is/is not proven.
- `docs/WALLET_AND_MONEY_FLOW.md` — the two-wallet model.
- `.agent/execplans/`

## Getting Started

Requirements: Python 3.12+, Node.js 20+, and (for on-chain work) Rust, Anchor, and the Solana CLI.

```bash
git clone https://github.com/METHEZONE/knot.git
cd knot
cp .env.example .env
```

Backend:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -e 'backend[dev]'
cd backend
../.venv/bin/python -m ruff check apps libs tests
../.venv/bin/python -m pytest tests
```

Frontend:

```bash
cd frontend
npm install
npm run typecheck
npm run lint
npm run test
npm run build
```

Web3 Gateway:

```bash
cd web3/gateway
npm install
npm run build
npm run lint
npm run test
```

pay.sh CLI (needed for real x402 calls; the paid-verification tests skip without it):

```bash
npm install -g @solana/pay
pay --version
pay --sandbox fetch https://debugger.pay.sh/mpp/quote/AAPL
```

On Windows the npm postinstall shells out to `unzip` and fails. The binary is still downloaded;
extract it manually:

```powershell
$bin = "$env:APPDATA\npm\node_modules\@solana\pay\bin"
Expand-Archive "$bin\pay-x86_64-pc-windows-msvc.zip" -DestinationPath $bin -Force
```

## Demo Accounts

Devnet demo only.

| Role | Email | Password |
|---|---|---|
| Brand | `t1@knot.com` | `000000` |
| Creator | `c1@knot.com` | `000000` |

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
KNOT_SETTLEMENT_AUTHORITY=...
KNOT_AUTO_SETTLEMENT_ON_EVIDENCE=1
KNOT_USER_WALLET_PROVISION=0
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
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
```

Web3 Gateway devnet signing:

```text
KNOT_WEB3_SIGNING_MODE=devnet
SOLANA_RPC_URL=...
KNOT_ESCROW_PROGRAM_ID=...
KNOT_USDC_MINT=...
KNOT_SETTLEMENT_KEYPAIR_JSON=...
KNOT_RELAYER_KEYPAIR_JSON=...
```

pay.sh:

```text
PAYSH_MODE=sandbox
PAYSH_RESOURCE_ID=https://debugger.pay.sh/mpp/quote/AAPL
PAYSH_MAX_CALL_AMOUNT_USDC=0.02
PAYSH_RUN_SPEND_CAP_USDC=0.02
PAYSH_DAILY_SPEND_CAP_USDC=1.0
PAYSH_ALLOWED_RESOURCE_PREFIXES=https://debugger.pay.sh/mpp/quote/
PAYSH_FAILURE_POLICY=continue
```

Do not commit secrets, private keys, service account JSON, seed phrases, or tokens.

## Demo Seed Data

Memory-only verification:

```text
.venv/bin/python scripts/seed_demo.py --target memory
```

Firestore demo reseed is restricted to the configured demo project and requires explicit
confirmation:

```text
ALLOW_DEMO_DATA_RESET=true DEMO_PROJECT_ID=knot-dev-503505 \
.venv/bin/python scripts/seed_demo.py --target firestore --project knot-dev-503505 --confirm=RESET_KNOT_DEMO_DATA
```

Devnet Phantom demo fixtures: `scripts/seed_devnet_phantom_demo.py`.

Do not run a Firestore reseed against production or unknown projects. The script seeds Product
API/Firestore fixture documents only; it does not create Firebase Auth users.

## Deployment

All off-chain runtime targets Google Cloud:

- Frontend, Product API, Creator A2A Service: Cloud Run.
- Web3 Gateway: private Cloud Run.
- Database: Firestore Native mode.

```bash
scripts/deploy_cloud_run_demo.sh
```

Do not deploy, change IAM, rotate secrets, fund wallets, or send devnet transactions unless the
operator explicitly approves that external action.
