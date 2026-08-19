# ExecPlan 24 - Final Demo Candidate Seed

## Scope

Prepare the final XEXYMIX demo baseline so the deployed app has enough real
Firestore data to demonstrate discovery, ranking, pay.sh verification, A2A
negotiation, and Agreement creation without relying on mock fallback.

## Source Documents Read

- `docs/00_DOCUMENT_INDEX.md`
- `docs/KNOT_PRODUCT_MASTER_SPEC_FINAL.md`
- `docs/02_TEAM_MATCHING_DECISION.md`
- `docs/24_FINAL_DEMO_SCENARIO_AND_SEED.md`
- `docs/IMPLEMENTATION_STATUS.md`

## Constraints

- Use devnet/test data only.
- Do not change Secret Manager, IAM, wallet funding, Solana programs, or on-chain
  state.
- Keep reset scope bounded to the XEXYMIX final demo IDs and operational docs.
- Keep final selected creator tied to `c1@knot.com` so the two-role demo works.
- Preserve Firebase Auth accounts and wallet addresses.

## Implementation Steps

1. [x] Inspect existing XEXYMIX/devnet seed scripts and live account IDs.
2. [x] Confirm deployed Firestore currently has only 1 matching discovery
   profile for `promotion-xexymix-devnet`.
3. [x] Design a 30-creator candidate pool with 20 detailed eligible candidates.
4. [x] Add scoped reset/reseed script `scripts/seed_xexymix_final_demo.py`.
5. [x] Add final demo scenario and input-value runbook.
6. [ ] Run local dry-run, lint, and ranking validation.
7. [ ] Seed Firestore with `--reset-demo`.
8. [ ] Verify deployed API sees 30 discovery profiles and 20 detailed eligible
   candidates.
9. [ ] Run deployed Brand Agent flow and verify pay.sh/system negotiation output.
10. [ ] Update `docs/IMPLEMENTATION_STATUS.md` with final results.

## Expected Demo Shape

- Discovery profiles: 30.
- Public filter matched: 30.
- Format matched: 30.
- Ranked: 30.
- Detail reads: 20.
- Detailed eligible: 20.
- Selected creator: `creator-devnet-phantom / agent-creator-devnet-phantom`.
- Contract amount: 1 devnet USDC.
- pay.sh verification: sandbox, expected 0.02 USDC.
