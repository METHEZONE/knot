# Solana Devnet Escrow and Settlement

## Scope

One Agreement, one escrow, one milestone.

```text
Agreement → lock → evidence → verification → release
```

## Boundary

Use a restricted server-side Web3 Gateway or equivalent. Browser never receives signer secrets.

Gateway revalidates Agreement, termsHash, amount, mint, recipient, state, and idempotency.

## Receipt rule

A successful receipt requires a real signature and confirmed status. Random or simulated signatures are prohibited.

## Evidence

Creator submits URL and metadata. Gemini may summarize. Deterministic checks decide release. Normal success automatically invokes release.

## Idempotency

```text
lock:{agreementId}
release:{agreementId}:milestone-1
```

Duplicate requests return the existing in-progress or confirmed operation.

## Failures

Missing wallet, insufficient balance, invalid mint, termsHash mismatch, submission failure, confirmation timeout, duplicate release, and evidence failure must persist as failures rather than simulated success.

## Secrets

Use Secret Manager and service identity. No key in repository, Firestore, logs, or prompts.
