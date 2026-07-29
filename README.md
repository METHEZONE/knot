# KNOT v2

KNOT v2 is a real-auth, role-onboarding, role-dashboard, Promotion/Offer,
A2A negotiation, Agreement, and Solana devnet Escrow product flow.

Read `docs/00_DOCUMENT_INDEX.md` first. Archived documents are not requirements.

## Local Full Stack

Prerequisites:

```bash
python3 --version   # Python 3.12+
node --version      # Node 20.18+ preferred
npm --version
```

Install dependencies:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -e 'backend[dev]'
npm --prefix frontend install
npm --prefix web3/gateway install
```

Create safe local env files and start everything:

```bash
scripts/local/bootstrap_env.sh
scripts/local/dev_stack.sh
```

Services:

```text
Frontend              http://127.0.0.1:3000
Firebase Auth UI      http://127.0.0.1:4000
Firebase Auth API     http://127.0.0.1:9099
Product API           http://127.0.0.1:18080
Creator A2A           http://127.0.0.1:8081
Web3 Gateway          http://127.0.0.1:8082
Logs                  /tmp/knot-local/*.log
```

The default local stack uses Firebase Auth emulator, in-memory Product API state,
Creator A2A over HTTP, and simulated Web3 signing. It is enough to run the UI,
signup/login, onboarding, dashboards, Promotion matching, A2A negotiation,
Agreement, Evidence, and settlement UI without touching live credentials or
mainnet.

Local account flow:

1. Open `http://127.0.0.1:3000/signup`.
2. Create a Brand or Creator account with email/password.
3. Complete the role onboarding.
4. Use a second browser window/profile for the opposite role when testing the
   two-window demo.

Seeded local fixture accounts are created in the Auth emulator on startup:

```text
Brand    test1@knot.demo     knot-demo-1234
Brand    test2@knot.demo     knot-demo-1234
Creator  test3@knot.demo     knot-demo-1234
Creator  test4@knot.demo     knot-demo-1234
```

Google OAuth is intentionally not the local emulator path. Use email/password
locally; verify Google sign-in only against a configured Firebase project.

Useful local smoke commands while `dev_stack.sh` is running:

```bash
scripts/local/api_smoke_wallet.sh CREATOR
scripts/local/agent_run.sh --new
```

On-chain localnet settlement is separate and opt-in:

```bash
.venv/bin/python scripts/local/localnet_bootstrap.py
scripts/local/dev_stack.sh
scripts/local/settlement_smoke.sh
```

Do not run shared devnet, deployment, IAM, Secret, wallet funding, or on-chain
transaction commands without explicit approval.

## Verification

```bash
npm --prefix frontend run test
npm --prefix frontend run typecheck
npm --prefix frontend run build
.venv/bin/python -m pytest backend/tests
npm --prefix web3/gateway run test
npm --prefix web3/gateway run build
```
