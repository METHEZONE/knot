# ExecPlan 21 - pay.sh rail and Brand-funded Solana escrow

## Scope

Refactor the current payment flow without rewriting the integrated UI:

- pay.sh/x402 remains Agent operational API spend for creator verification only.
- Creator compensation escrow is funded by the Brand's connected Phantom wallet.
- Existing server-keypair escrow lock path remains only as legacy/local fixture compatibility.
- Production/devnet UI moves to prepare unsigned transaction, Phantom signature, backend confirmation.

## Current Gaps

- `web3/gateway/src/solana.ts` live lock loads Brand/Creator/Agent keypairs, mints test USDC, and submits the lock server-side.
- Frontend has no real Phantom connection or transaction signing code.
- Backend `/api/v1/agreements/{id}/escrow:lock` treats a confirmed Gateway receipt as enough to create `LOCKED` escrow state.
- Firestore has `paymentOperations`/`transactionReceipts`, but no separate canonical `agentPaymentEvents` path for pay.sh events.
- Agreement creation stores `AGREED`; the new flow requires `FUNDING_REQUIRED` until Brand-funded escrow is confirmed.

## Implementation Steps

1. Add Agreement-scoped Anchor instructions and account state for `initialize_escrow`, `fund_escrow`, `release_milestone`, and `refund_remaining`.
2. Add Web3 Gateway funding prepare/confirm endpoints that build unsigned transactions and verify confirmed token balance deltas.
3. Add backend prepare/confirm APIs and Firestore state transitions.
4. Mirror pay.sh verification events into `agentPaymentEvents`, keeping statuses `SKIPPED`, `PAID`, and `FAILED`.
5. Add frontend Phantom connect/sign/send flow in the existing negotiation detail UI.
6. Add/adjust tests for separation, validation, and UI states.
7. Update implementation status and report verification results truthfully.

## Validation

- Anchor build/test where available.
- Web3 Gateway lint/build/test.
- Backend pytest targeted escrow/pay.sh suites.
- Frontend lint/typecheck/build/test.
