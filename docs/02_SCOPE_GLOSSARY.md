# KNOT v1 Scope and Glossary

## 1. In scope

- Promotion creation and viewing
- Seeded brand, creator, agent, policy and wallet references
- Brand Agent creator discovery and matching
- A2A negotiation with one selected Creator Agent at a time
- Structured agreement and terms hash
- Solana devnet escrow lock and milestone release
- pay.sh sandbox integration for one agent-paid verification/API call
- Content evidence URL submission and verification
- Agent Society Map and Promotion Timeline
- Firestore persistence, audit events, Cloud Run deployment and demo seed

## 2. Out of scope

- User onboarding, social account connection and profile extraction
- Production login signup flow beyond demo accounts
- Mainnet assets, fiat on-ramp, KYC and tax handling
- Token issuance
- Open-ended legal contract generation
- Free-form usage rights; only three presets
- Automated revenue attribution; use fixture/manual evidence in v1
- Full dispute court; only safe stop and optional timeout/refund path
- General public agent marketplace or cross-organization registry
- Multi-chain settlement
- Production-grade key custody
- Push notification configuration, gRPC A2A and custom A2A extensions

## 3. How v1 works without onboarding

A seed command creates:

- one demo brand and Brand Agent
- three or more creator profiles and Creator Agents
- agent policies and rate cards
- wallet public addresses and Secret Manager references for demo signing
- one sample Promotion template

The application must never require the team to edit Firestore manually during the recorded demo.

## 4. Canonical terminology

| Use | Meaning | Do not use for new work |
|---|---|---|
| Promotion | One brand promotional initiative | campaign, deal brief |
| Creator candidate | Creator considered during matching | influencer row |
| Match run | One Brand Agent ranking execution | search job |
| Negotiation | Multi-turn Brand–Creator term exchange | chat only |
| Agreement | Final accepted structured terms | generated prose contract |
| Artifact | A2A task result | response blob |
| Policy | Human-defined deterministic limits | prompt rule only |
| Payment mandate | Data authorizing a bounded lock/release | LLM approval |
| Evidence | URL and verification data for a milestone | arbitrary attachment |
| Settlement | Escrow release to creator | generic payment |

## 5. Identifier rules

Use UUIDv7 where available, otherwise UUIDv4.

- `promotionId`
- `brandAgentId`
- `creatorAgentId`
- `matchRunId`
- `negotiationId`
- `contextId`
- `taskId`
- `agreementId`
- `escrowId`
- `settlementId`

JSON and Firestore fields use `camelCase`. Solana program fields may use Rust conventions internally but gateway APIs must expose `camelCase`.
