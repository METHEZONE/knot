# KNOT Monorepo Structure

```text
knot/
├── AGENTS.md
├── PLANS.md
├── README.md
├── frontend/
│   └── # intentionally empty until frontend milestone
├── backend/
│   ├── apps/
│   │   ├── api/
│   │   └── creator_agent/
│   ├── libs/
│   │   ├── agents/
│   │   ├── a2a/
│   │   ├── domain/
│   │   ├── policies/
│   │   ├── repositories/
│   │   ├── observability/
│   │   └── settings/
│   ├── tests/
│   ├── pyproject.toml
│   └── uv.lock
├── web3/
│   ├── gateway/
│   │   ├── src/
│   │   ├── tests/
│   │   ├── Dockerfile
│   │   └── package.json
│   └── program/
│       ├── programs/knot_escrow/
│       ├── tests/
│       ├── Anchor.toml
│       └── Cargo.toml
├── docs/
├── infra/
│   └── cloudbuild/
└── scripts/
```

## Directory rules

- Shared domain models live in `backend/libs/domain`, never inside HTTP route modules.
- Policy functions are pure and isolated in `backend/libs/policies`.
- A2A protocol types/adapters are separate from KNOT domain messages.
- When frontend work starts, `frontend/features` is organized by Promotion, matching, negotiation, agreement, evidence and settlement.
- Solana program logic stays in `web3/program`; RPC/signing orchestration stays in `web3/gateway`.
- Terraform owns deployed GCP resources when `infra/` is added. Manual console changes must be backported or documented.
- The primary code areas are `frontend`, `backend`, and `web3`; support folders such as `infra/` and `scripts/` are added only when their implementation starts.

## Dependency direction

```text
HTTP apps -> application services -> domain/policy -> repositories/adapters
```

Domain and policy modules cannot import FastAPI, Firestore, ADK, web3 SDK or UI code.
