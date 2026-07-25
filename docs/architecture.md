# KNOT Web3 Architecture

This document defines the Web3/payment interface between Product API, Creator
Agent, frontend and the Solana escrow layer.

Product and API language uses **Promotion** / `promotionId`. The current Anchor
program still exposes legacy instruction/account names containing `campaign`.
Those names map one-to-one to a KNOT Promotion escrow until the Web3 owner
renames the on-chain API and regenerates the IDL.

## 1. Layers

```text
Browser / Next.js frontend
  -> Product API and Brand Agent
  -> Creator A2A service
  -> private web3 gateway
  -> Solana devnet knot-escrow program
```

Payment flows:

- Flow 1: pay.sh / x402 sandbox call for one agent-paid verification/API action.
- Flow 2: KNOT escrow lock and milestone release in devnet USDC.
- Reputation: on-chain Reputation PDA, currently not wired into Product API.

## 2. User Flow

| Step | Flow | Owner | Payment |
|---|---|---|---|
| 0 | Seed demo brand, creators, agents, policies and wallets | Backend | - |
| 1 | Create Promotion, match candidates and optionally run paid verification | Backend/Web3 | pay.sh |
| 2 | A2A offer/counter negotiation within deterministic limits | Backend/Creator Agent | - |
| 3 | Agreement and escrow funding | Backend/Web3 | Solana |
| 4 | Evidence verification and milestone release | Backend/Web3 | Solana |
| 5 | Completion or timelock refund | Web3 | Solana |

Demo proof points:

- An agent-paid pay.sh/x402 sandbox call.
- A devnet USDC escrow lock and milestone release within policy limits.
- Solana signatures visible in the frontend timeline.

Autonomy rule: within `auto_approve_cap`, the Brand Agent authority may release
without a new human signature. Above the cap, brand authority must sign.

## 3. On-Chain Reference

Workspace:

```text
Anchor.toml
Cargo.toml
programs/knot-escrow/
```

The removed `web3/program/` workspace was a no-op stub and must not be restored.

Devnet constants:

```text
programId: Aj63B5hLtvJdNQiAi61rMrgfW3pt8Lak3GQB59B6jysj
usdcMint: 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
network: solanaDevnet
```

Current Anchor accounts:

- `Config` PDA `[b"config"]`: admin, treasury token account, `brand_fee_bps`, `creator_fee_bps`.
- `Campaign` PDA `[b"campaign", brand, campaign_id(u64 LE)]`: legacy on-chain state name for one KNOT Promotion escrow. It stores parties, mint, vault, treasury, total/released amounts, `auto_approve_cap`, fee snapshots, `terms_hash[32]`, `refund_available_at`, status and up to eight milestones.
- `vault` token account PDA `[b"vault", campaign]`: authority is `vault_authority` PDA `[b"vault-auth", campaign]`.
- `Reputation` PDA `[b"rep", wallet]`: completed Promotion count, settled total and rating.

Current Anchor instructions:

| Instruction | Signer | Product meaning |
|---|---|---|
| `initialize_config(brand_fee_bps, creator_fee_bps)` | admin | Configure fee bps and treasury |
| `initialize_campaign(...)` | brand | Legacy name for initializing one Promotion escrow |
| `submit_milestone(index)` | creator | Mark a milestone as submitted |
| `approve_and_release(index)` | brand or `agent_authority` | Release a verified milestone within policy/cap |
| `refund()` | brand | Refund remaining vault balance after timelock |

Fees: the Anchor program supports brand-side and creator-side fee bps snapshots.
KNOT v1 Product API currently uses off-chain `PLATFORM_FEE_BPS = 0` until the
team finalizes fee policy. If nonzero fees are enabled on-chain, API amount
calculation, Firestore documents, gateway payloads and docs must be updated in
the same PR.

## 4. Backend Interface

Product API owns business state and should call the private web3 gateway for
real signing. Current backend escrow endpoints persist simulated receipts until
that gateway call is wired:

```text
POST /api/v1/agreements/{agreementId}/escrow:lock
GET  /api/v1/escrows/{escrowId}
POST /api/v1/escrows/{escrowId}/milestones/{milestoneId}:release
GET  /api/v1/transaction-receipts/{receiptId}
```

The gateway-facing payload must use Promotion/Agreement/Escrow terminology:

```json
{
  "agreementId": "agreement-...",
  "escrowId": "escrow-...",
  "termsHash": "sha256:...",
  "expectedAmountBaseUnits": "650000000",
  "mint": "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
  "programId": "Aj63B5hLtvJdNQiAi61rMrgfW3pt8Lak3GQB59B6jysj",
  "network": "solanaDevnet",
  "brandAuthority": "brand-wallet",
  "creatorDestination": "creator-wallet"
}
```

## 5. Open Items

- Agreement mapping: A2A Agreement terms -> on-chain arguments, including absolute milestone amounts and `auto_approve_cap`.
- Wallet/key management: Brand, Creator and `agent_authority` keys must be provisioned through Secret Manager or devnet-only local setup, never committed.
- Evidence anchoring: decide whether evidence URL/hash remains off-chain only or whether a digest is included in milestone submission.
- On-chain rename: Web3 owner may rename legacy `campaign` symbols to Promotion escrow names, but must update Anchor IDL, Python client, tests and docs in one coordinated change.
