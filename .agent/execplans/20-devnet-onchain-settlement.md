# 20 Devnet On-chain Settlement

## Scope

- Make settlement funding truthful outside localnet.
- Prepare shared Solana devnet deployment without silent mint/mock fallback.
- Verify demo flow only after explicit approval for Secret Manager changes, wallet funding, program deployment, and on-chain transactions.

## Milestones

1. Separate localnet faucet funding from shared devnet lock behavior.
2. Surface wallet balance network/mint in the dashboard so local tokens are not mistaken for devnet funds.
3. Add or run checks for devnet signer balances, SPL mint/config readiness, and deployment blockers.
4. Create required Secret Manager entries for Web3 signers after approval.
5. Deploy or verify escrow program/config on Solana devnet after approval.
6. Deploy Cloud Run Web3/API/Web services in live devnet mode after approval.
7. Run t1/c1 A2A -> Agreement -> escrow lock -> evidence -> release E2E and record signatures.

## Funding Notes

- Circle's public faucet supports Solana Devnet USDC (`4zMMC9...ncDU`) in 20 USDC chunks.
- A 200 USDC escrow requires the Agent funder wallet to already hold at least 200 USDC plus any configured fee.
- If we cannot pre-fund 200 USDC quickly, use a smaller demo Agreement amount such as 20 USDC for the real devnet demo.

## Verification Log

- 2026-08-02: `npm --prefix web3/gateway test` passed 13 tests.
- 2026-08-02: `npm --prefix web3/gateway run build` passed.
- 2026-08-02: `.venv/bin/python -m pytest backend/tests/test_api_escrow.py backend/tests/test_api_promotions.py backend/tests/test_api_dashboards.py -q` passed 49 tests, 2 warnings.
- 2026-08-02: `npm --prefix frontend run lint`, `npm --prefix frontend run typecheck`, and `npm --prefix frontend run build` passed.

## Current Blockers

- No shared devnet transaction was submitted in this phase.
- Devnet Secret Manager signer entries, escrow program/config readiness, wallet funding, deployment, and live on-chain smoke still require explicit approval before execution.
