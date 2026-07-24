# Demo and Submission Acceptance Criteria

## 1. Three-minute narrative

### 0:00–0:25 — Problem and Promotion

Show one concise creator-marketing pain and the Brand Human's bounded Promotion settings.

### 0:25–1:20 — Agent discovery and A2A negotiation

- Brand Agent ranks creators.
- Agent Society Map activates candidate and selected creator nodes.
- Offer, counter and accept messages appear with rationale.
- One deliberately invalid term is blocked by policy.
- Final Agreement Artifact and hash appear.

### 1:20–2:20 — Agentic payment

- Brand Agent requests escrow lock without a new click/approval.
- Show policy permit, web3 gateway event and devnet signature.
- Show evidence URL and verification observations.
- Show milestone release signature.

### 2:20–3:00 — Why GCP, Solana and KNOT

- Cloud Run services, Vertex AI/ADK, Firestore timeline and A2A architecture.
- Solana low-cost programmable escrow and transparent receipts.
- Structured history creates future matching and transaction reputation data.

## 2. Hard demo gates

- Live Cloud Run URL
- Reproducible seed/reset
- At least three creator candidates
- At least one A2A counter round
- One policy block
- Agreement Artifact
- Devnet lock signature
- Evidence decision
- Devnet release signature
- No manual Firestore edits
- No exposed secrets

## 3. Fallbacks

- Keep a recorded successful E2E run.
- Persist the last successful transaction receipts.
- If pay.sh resource is unavailable, show the last sandbox receipt and clearly label it as prior run; do not pretend a new payment occurred.
- If social URL blocks server fetch, use a pre-captured private evidence snapshot tied to the URL and explain the limitation.
- Never claim mainnet or production custody.

## 4. Submission repository checklist

- root README with product, architecture, setup and demo
- license
- reproducible code and pinned dependencies
- `.env.example`, no secrets
- architecture diagram
- test commands and results
- live URL
- devnet program ID and transaction links
- known limitations and out-of-scope section
