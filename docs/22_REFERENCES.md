# References

## 1. Project source documents

### The Agentic Commerce Stack: x402 & mpp

Used for:

- definition of agentic commerce as end-to-end discovery, comparison, negotiation, choice, payment and post-transaction management;
- distinction between A2A communication and external system/tool access;
- pay.sh support for x402/mpp and Agent-paid APIs;
- need for a defensible missing layer rather than protocol decoration.

### Why Solana for Agentic Commerce

Used for:

- wallet, stablecoin and smart-contract building blocks;
- machine-native, 24/7 settlement narrative;
- policy/limit-bounded autonomous payment;
- actual on-chain transaction expectations;
- localnet → devnet development path;
- pay.sh and Solana stack integration.

### Google × Solana AI Agentic Hackathon Intro Deck

Used for:

- Multi-Agent Commerce and Autonomous On-chain Settlement tracks;
- evaluation criteria: innovative UX, Gemini/Google Cloud, USDC/Solana/pay.sh, actual execution logs and transactions;
- mock-only exclusion;
- reproducible GitHub/README/demo expectations.

### Vibe Coding on Google Cloud

Used for:

- preserving a strong existing design while connecting it to real code;
- Cloud Run, Firestore and serverless architecture;
- agentic coding workflow and phased implementation;
- pay.sh sandbox/local testing concept;
- deployment and observability direction.

### KNOT_A2A_ARCHITECTURE

Used for:

- A2A protocol boundary;
- AgentCard, Message, Part, Task, TaskState and Artifact;
- HTTP+JSON baseline;
- tenant routing;
- one Task for a multi-turn Brand–Creator negotiation;
- KNOT domain OFFER/COUNTER/ACCEPT/REJECT/ESCALATE mapping;
- persistence model and invariants.

## 2. Previous KNOT documentation used as migration baseline

- `KNOT_PRODUCT_MASTER_SPEC_V2.md`
- `KNOT_DOCS_V2_COMBINED.md`
- `KNOT_UI_FIRST_RECOVERY_CODEX_PROMPT.md`
- `KNOT_MVP_REAL_A2A_ESCROW_DEVELOPMENT_PROMPT.md`
- `KNOT_REBOOT_MASTER_ALL_IN_ONE.md`
- earlier PRD/onboarding/A2A research documents.

Preserved principles:

- current design as UI source;
- stable server/API/Web3 behavior as implementation source;
- ViewModel/Adapter integration;
- actual A2A and on-chain proof;
- no silent mock fallback;
- private policy isolation;
- idempotency;
- phase-by-phase tests/status;
- no direct push to main.

Updated decisions:

- Brand run targets one funded Agreement and can try three candidates sequentially;
- Creator Agent is persistently published/asynchronously callable;
- discovery uses a separate indexed projection and vector retrieval;
- candidate selection is fully Agent-owned;
- onboarding is a one-decision-per-card deck for both roles;
- MVP settlement is one 100% post-verification milestone;
- Dashboard is explicitly an Agent Control Room with persisted live/replay behavior.

## 3. Official references to verify during implementation

Codex must use the installed dependency and current official documentation when protocol/library details differ.

- A2A Protocol specification and definitions
- Google Cloud Firestore indexing/vector search documentation
- Google Cloud Run and managed task/queue documentation
- Firebase Authentication/Admin SDK documentation
- Gemini structured output/model SDK documentation in current repository
- Solana and Anchor documentation
- pay.sh/x402 documentation and the configured environment

## 4. Conflict rule

- Product behavior and terminology: this final bundle wins.
- Existing working API/deployment behavior: preserve through compatible adaptation unless a documented bug is fixed.
- Protocol/library fields: verified installed official contract wins; update docs and tests.
- Security/payment behavior: truthful actual architecture wins over aspirational copy.
