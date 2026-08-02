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
- 2026-08-02: `npm --prefix web3/gateway run preflight:devnet` executed read-only against Solana devnet. It confirmed executable program `Aj63B5hL...B6jysj`, but failed readiness because signer keypairs were not configured locally and the program config treasury mint is `7Hrvv...eK3p`, not Circle devnet USDC `4zMMC9...ncDU`.
- 2026-08-02: Created branch `fix/devnet-onchain-settlement` and generated a fresh devnet USDC program ID `HeviXng9...3z4v`.
- 2026-08-02: Added `npm --prefix web3/gateway run init-config:devnet` to initialize a fresh config PDA with a Circle devnet USDC treasury token account.
- 2026-08-02: `anchor build` passed with the new program ID.
- 2026-08-02: Devnet program deployment attempted after approval, but failed before deployment because the fee payer wallet had `0 SOL` and the public faucet/PoW bootstrap also hit rate limits.
- 2026-08-02: Fresh program preflight now points at `HeviXng9...3z4v` and Circle devnet USDC, but correctly reports missing executable program/config until deployment succeeds.
- 2026-08-02: Updated live escrow authority mapping so `brandAuthority` and `creatorDestination` come from user-connected Phantom wallet addresses instead of internal Agent IDs or server creator keypairs.
- 2026-08-02: Updated on-chain release path so a backend-verified evidence result lets the Brand Agent release a pending/submitted milestone to the Creator's Phantom token account without storing the Creator private key server-side.
- 2026-08-02: `npm --prefix web3/gateway run build`, `npm --prefix web3/gateway run lint`, `npm --prefix web3/gateway test`, API/PDA pytest subset, and frontend lint/typecheck/build passed on the branch.

## Current Blockers

- No shared devnet transaction was submitted in this phase.
- Devnet Secret Manager signer entries, Circle USDC escrow program/config readiness, wallet funding, deployment, and live on-chain smoke still require explicit approval before execution.
- The current deployed devnet program config is already initialized against a custom test mint. Circle devnet USDC requires deploying/configuring a fresh program ID or intentionally switching the demo to that custom test mint with truthful labeling.
- Fresh Circle USDC program deployment is blocked until deploy wallet `GX1q...gv6B` receives at least 2.2 devnet SOL. Official CLI airdrop and `devnet-pow` bootstrap both returned faucet rate-limit errors in this environment.
- pay.sh/x402 is wired as candidate-verification spend during match runs. It is not the creator payout escrow. If `PAYSH_RESOURCE_ID=replace-me` or caps/allowlist block the call, KNOT records a skipped/failed pay.sh operation instead of fabricating a paid receipt.
