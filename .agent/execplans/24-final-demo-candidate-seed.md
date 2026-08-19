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
6. [x] Run local dry-run, lint, and ranking validation.
7. [x] Seed Firestore with `--reset-demo`.
8. [x] Verify deployed API sees 30 discovery profiles and 20 detailed eligible
   candidates.
9. [x] Run deployed Brand Agent flow and verify pay.sh/system negotiation output.
10. [x] Update `docs/IMPLEMENTATION_STATUS.md` with final results.
11. [x] Clarify deployed Negotiation Detail pay.sh visibility and milestone
    evidence gating.
12. [x] Redeploy Web so the final demo URL serves the pay.sh summary and
    content-only evidence UI.
13. [x] Document one-browser Brand/Creator demo order and presentation notes.

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

## Final Live Results

- Firestore reset/reseed installed 155 documents and 30
  `creatorDiscoveryProfiles`.
- Firestore matching verification:
  - `creatorProfiles=31`
  - `discoveryProfiles=30`
  - `publicFilterMatched=30`
  - `formatMatched=30`
  - `ranked=30`
  - `detailReads=20`
  - `detailed=20`
  - `eligibleDetailed=20`
- Creator Agent was redeployed from stale image `7f97e86` to
  `knot-creator-agent-00015-8hx` with image tag `787d091`.
- Final deployed Brand Agent run:
  - `matchRunId=match-954b9104-e730-41a3-8d6e-ee8891c3cb28`
  - `discoveryReturnedCount=30`
  - `detailReadCount=20`
  - candidate endpoint returned `count=20`, `eligible=20`
  - selected `creator-devnet-phantom / agent-creator-devnet-phantom`
  - pay.sh `SETTLED`, receipt
    `receipt-paysh-d5974f95-6a09-546a-9a35-fbc53ac0c0b6`
  - negotiation `negotiation-76b252f1-60b5-4758-9c76-6582e80590da`
    reached `AGREED`
  - agreement `agreement-ab135b84-7876-481a-ace2-dfc24b84e8a9`
    reached `FUNDING_REQUIRED`
  - amount `1 devnet USDC`
- Creator API and Web routes returned 200 for the final offer and agreement.

## Post-Seed Web Verification

- Web was redeployed to revision `knot-web-00019-wqc` with image tag
  `8974883`.
- The final deployed Web routes returned 200 for:
  - `/brand/negotiations/negotiation-76b252f1-60b5-4758-9c76-6582e80590da`
  - `/brand/agreements/agreement-ab135b84-7876-481a-ace2-dfc24b84e8a9`
  - `/creator/offers/negotiation-76b252f1-60b5-4758-9c76-6582e80590da`
  - `/creator/agreements/agreement-ab135b84-7876-481a-ace2-dfc24b84e8a9`
- The deployed Web proxy returned the final negotiation messages:
  - `SYSTEM / VERIFICATION_EVENT / pay.sh / SETTLED`
  - Brand Agent `OFFER` at `1 USDC`
  - Creator Agent `ACCEPT` at `1 USDC`
- No wallet funding, Solana program deployment, Secret Manager change, or new
  on-chain transaction was performed in the post-seed Web verification.
