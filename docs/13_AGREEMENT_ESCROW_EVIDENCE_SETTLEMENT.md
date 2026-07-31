# Agreement, Escrow, Evidence and Settlement

## 1. Agreement creation

Agreement is created from a final A2A Artifact after deterministic canonicalization.

```text
A2A Artifact
→ validate ownership/task/terminal result
→ normalize terms
→ compute deterministic termsHash
→ create Agreement exactly once
```

Canonical term fields:

- parties and Agent IDs;
- Promotion and Negotiation IDs;
- compensation amount/asset;
- deliverable format/count;
- deadline/timezone;
- usage rights;
- revision limit if used;
- evidence requirements;
- settlement condition;
- schema/version.

## 2. Deterministic terms hash

- Serialize a canonical JSON representation.
- Stable key ordering and normalized numeric/date formats.
- Exclude mutable metadata and UI text.
- Hash algorithm/version stored with value.
- Agreement ID, Artifact ID and on-chain operation reference the same hash.

A mismatch is a hard failure.

## 3. MVP settlement schedule

One milestone only:

```text
POST_VERIFIED = 100%
```

This matches the MVP’s one content deliverable and keeps the demo clear. Do not retain a legacy 30/70 UI if the actual contract releases 100% after verification.

## 4. Escrow authority

The Agent can lock funds only when all are true:

- Agreement exists and belongs to the Brand;
- terms hash matches;
- amount equals Agreement compensation;
- asset/network/program/mint are allowlisted;
- Brand Agent authority permits escrow;
- per-run/daily spend cap is sufficient;
- wallet balance is sufficient;
- no existing confirmed lock;
- Web3 Gateway validates idempotency.

Gemini does not authorize this operation.

## 5. Actual wallet architecture

Codex must inspect current implementation and document one truthful mode:

### Delegated/pre-funded Agent wallet

- Brand funds a controlled devnet wallet during setup;
- server-side signer is protected by Secret Manager/KMS-equivalent service architecture;
- authority and spend caps limit actions;
- Agent can submit without a human click at transaction time.

### User wallet approval

- user signs the lock interactively;
- product must not call it autonomous settlement;
- the UI shows approval-required state.

Hackathon target is the first mode on devnet if the repository already supports safe delegated signing.

## 6. Escrow state

```text
NOT_STARTED
PREPARING
SUBMITTED
CONFIRMED
RELEASE_SUBMITTED
RELEASED
FAILED
CANCELED
```

Keep operation state separate from Aggregate state.

## 7. Operation receipt

```json
{
  "operationId": "op-lock-001",
  "operationType": "ESCROW_LOCK",
  "network": "SOLANA_DEVNET",
  "asset": "USDC",
  "amountUsdc": 300,
  "status": "CONFIRMED",
  "signature": "...",
  "explorerUrl": "...",
  "submittedAt": "timestamp",
  "confirmedAt": "timestamp",
  "errorCode": null
}
```

Never display a placeholder or EVM-style `0x...` as a Solana signature.

## 8. Evidence submission

Creator input:

- supported content URL;
- optional note;
- optional screenshot/file only if existing storage pipeline supports it.

Validation:

- authenticated creator owns Agreement;
- Agreement escrow is funded;
- URL scheme/domain is supported;
- URL normalized;
- duplicate handling;
- deadline/cutoff;
- safe fetch rules.

## 9. Verification

```text
Evidence submitted
→ secure fetch
→ Gemini observations
→ deterministic gate
→ VERIFIED / REVISION_REQUIRED / MANUAL_REVIEW / REJECTED
```

MVP rule examples:

- content is accessible;
- expected content type is observed;
- product/brand mention is observed;
- required disclosure is present if configured;
- prohibited claims are absent or not confidently detected;
- submission timing is valid.

Low confidence does not automatically fail or release; it moves to review.

## 10. Settlement release

```text
Evidence VERIFIED
→ load Agreement and Escrow
→ revalidate termsHash and amount
→ create release operation idempotently
→ submit transaction
→ confirm
→ update Escrow and Settlement
→ update reputation summary/index
→ emit Dashboard events
```

The creator receives funds directly at the configured settlement wallet in the automatic-transfer architecture. Do not show a `정산 받기` button if no claim action exists.

## 11. Failure recovery

### Lock submitted but API timed out

- query by known signature/operation ID;
- do not submit a second lock blindly.

### On-chain confirmed, Firestore update failed

- reconciler writes confirmed receipt and advances state.

### Release failed

- milestone remains unreleased;
- bounded retry when retryable;
- no second payout for a confirmed release.

### Evidence changed after verification

MVP does not silently re-open a settled Agreement. Record the source digest used at verification.

## 12. Tests

- canonical hash stable across equivalent inputs;
- duplicate Artifact creates one Agreement;
- duplicate lock/release returns same operation;
- amount/hash/owner mismatch rejected;
- actual local validator program tests;
- devnet smoke produces real signature;
- evidence ambiguity does not pay;
- settlement updates both role projections from same canonical event.
