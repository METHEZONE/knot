# Phase 10 ExecPlan — Evidence and Settlement

## Goal

Verify creator evidence against the funded Agreement escrow state and release the single MVP settlement milestone only when deterministic policy passes.

## Source Documents

- `docs/00_DOCUMENT_INDEX.md`
- `docs/13_AGREEMENT_ESCROW_EVIDENCE_SETTLEMENT.md`
- `docs/17_WBS_AND_IMPLEMENTATION_PLAN.md`
- `docs/KNOT_PRODUCT_MASTER_SPEC_FINAL.md`

## Scope

- Require a locked escrow before creator evidence submission.
- Preserve creator-agent ownership enforcement for evidence writes.
- Normalize and validate external https evidence URLs.
- Persist source digest and deterministic verification results.
- Block duplicate evidence submissions for one Agreement milestone.
- Gate the one 100% milestone release on passed evidence only.
- Bind settlement, released milestone, and release timeline event to the evidence ID and source digest.
- Prove failed evidence does not create a settlement or authorize release.

## Implementation Notes

- Evidence verification remains deterministic URL-policy based in this phase; no Gemini fetch/analysis provider was enabled.
- A failed evidence result remains stored with `status: FAILED` and a rejected `verificationResults` document.
- Release idempotency continues to return the original settlement for repeated release keys.
- No live devnet release transaction was submitted because on-chain transactions require explicit approval.

## Verification

- `../.venv/bin/python -m pytest tests/test_api_promotions.py tests/test_api_escrow.py` from `backend`

## Result

Implemented and verified through local/fake-gateway tests. Live devnet release signature remains unverified until an approved on-chain smoke is run.
