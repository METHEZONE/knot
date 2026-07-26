# Solana, Escrow, x402 and pay.sh Specification

## 1. v1 objective

The demo must show an agent-triggered USDC-compatible escrow lock and a milestone release on Solana devnet, with no new human approval at transaction time and with deterministic limits enforced.

## 2. Components

```text
knot-api (policy + intent)
  -> private Cloud Run OIDC
knot-web3 (signing + RPC + receipt)
  -> Solana devnet
KNOT Anchor escrow program
```

## 3. Web3 gateway API

Private routes:

```text
POST /internal/v1/escrows:lock
POST /internal/v1/escrows/{escrowId}/milestones/{milestoneId}:release
GET  /internal/v1/transactions/{signature}
GET  /healthz
```

All writes require:

- Cloud Run IAM authentication
- `Idempotency-Key`
- request/correlation ID
- agreement/escrow identifiers
- expected amount, mint, destination and terms hash

## 4. Escrow program v1

Escrow state should bind:

- agreement ID or deterministic 32-byte digest
- terms hash
- brand authority
- creator destination
- mint
- total locked amount
- released amount
- milestone bitmap or release records
- expiry/refund timestamp if implemented
- status

Instructions:

```text
initializeEscrow
fundEscrow
releaseMilestone
cancelOrRefundAfterTimeout   # optional but preferred safety path
```

On-chain invariants:

- creator destination cannot change after initialization
- release amount cannot exceed remaining balance
- milestone cannot be released twice
- unauthorized signer cannot release
- program and token accounts use expected mint and owners

## 5. Agreement hashing

- Serialize canonical JSON with stable key ordering and normalized numbers.
- Exclude rationale, timestamps, model name, confidence and display metadata.
- Hash with SHA-256 off-chain.
- Store the digest in Firestore and escrow state.
- Recompute before every lock.

## 6. Key management for hackathon

- Use a dedicated devnet-only Brand Agent signer.
- Store secret material only in Secret Manager and grant access only to `knot-web3-sa`.
- Never return or log secret bytes.
- Rotate/delete the demo signer after the event.
- This is not presented as production custody. Mainnet key architecture is explicitly out of scope.

## 7. Transaction lifecycle

```text
RECEIVED
-> VALIDATED
-> SIMULATED
-> SUBMITTED
-> CONFIRMED | FAILED
```

Persist RPC endpoint alias, recent blockhash context, signature, slot, confirmation status, error, request ID and idempotency key. Do not persist signed raw transactions unless required for debugging and protected.

Current gateway modes:

- `KNOT_WEB3_SIGNING_MODE=simulated`: validate request and return
  `SIMULATED` receipts.
- `KNOT_WEB3_SIGNING_MODE=devnet`: use `@solana/web3.js` and
  `@solana/spl-token` to submit the deployed Anchor program's
  `initialize_campaign`, `submit_milestone`, and `approve_and_release`
  instructions. This mode requires `SOLANA_RPC_URL` and a devnet-only brand
  signer through `KNOT_BRAND_KEYPAIR_PATH`, `ANCHOR_WALLET`, or a Secret
  Manager-mounted `KNOT_BRAND_KEYPAIR_JSON` value.

The MVP gateway stores live lock context in-process so lock and release must run
against the same gateway instance for the recorded demo. Before a Cloud Run demo,
replace this with Firestore/Secret Manager-backed context persistence or keep
minimum instances at one during the run.

## 8. pay.sh / x402

Use one paid API call in the Brand Agent flow, preferably after candidate ranking and before final selection:

```text
Brand Agent needs creator/content verification
-> pay.sh sandbox adapter requests priced resource
-> x402 payment challenge handled by adapter
-> receipt and result returned
-> KNOT persists provider, price, receipt ID and correlation ID
```

Requirements:

- use sandbox mode during development
- adapter interface hides provider-specific CLI/API details
- do not hardcode a catalog provider that may disappear; configure resource identifier
- a failed paid check does not authorize a creator; retry or escalate
- pay.sh payment is distinct from KNOT escrow settlement
- current Product API implementation records `API_PAYMENT` PromotionEvents with
  `SETTLED`, `FAILED`, `SKIPPED` or `DISABLED`; a real sandbox receipt requires
  `PAYSH_MODE=sandbox`, a configured `PAYSH_RESOURCE_ID`, and the `pay` CLI on
  the backend runtime path

## 9. Explorer links

Frontend derives explorer URL from configured cluster and signature. Never trust a user-supplied explorer URL.
