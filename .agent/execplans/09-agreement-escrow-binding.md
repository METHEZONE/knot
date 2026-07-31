# Phase 9 ExecPlan — Agreement and Escrow Binding

## Goal

Bind accepted A2A Agreement Artifacts to deterministic Agreement terms and escrow operations without retaining the legacy 30/70 settlement shape.

## Source Documents

- `docs/00_DOCUMENT_INDEX.md`
- `docs/13_AGREEMENT_ESCROW_EVIDENCE_SETTLEMENT.md`
- `docs/17_WBS_AND_IMPLEMENTATION_PLAN.md`
- `docs/KNOT_PRODUCT_MASTER_SPEC_FINAL.md`

## Scope

- Normalize new Agreement terms to the MVP one-milestone settlement schedule.
- Recompute canonical terms hash when creating Agreement documents.
- Reject Artifact terms hash mismatch before saving an Agreement.
- Preserve escrow lock amount/hash validation through the Web3 Gateway path.
- Fix release idempotency replay for one 100% milestone completion.
- Update frontend fixture milestone state to avoid legacy 30/70 UI.

## Implementation Notes

- New Agreements now use `content` / `contentLiveVerified` / `releasePct: 100`.
- Agreement documents store `hashAlgorithm` and `hashVersion`.
- Existing legacy Agreements remain readable; no destructive migration or backfill was executed.
- No devnet transaction was submitted because on-chain actions require explicit approval.

## Verification

- `../.venv/bin/python -m pytest tests/test_api_promotions.py tests/test_api_escrow.py tests/test_a2a_negotiation.py tests/test_domain_models.py` from `backend`
- `../.venv/bin/python -m pytest` from `backend`
- `../.venv/bin/python -m ruff check .` from `backend`
- `../.venv/bin/python -m mypy` from `backend`
- `npm run typecheck` from `frontend`
- `npm run lint` from `frontend`
- `npm test` from `frontend`
- `npm run build` from `frontend`
- `npm run build` from `web3/gateway`
- `npm test` from `web3/gateway`
- `npm run lint` from `web3/gateway`

## Result

Implemented and verified in local/fake-gateway test paths. Devnet lock receipt remains unverified until an approved on-chain smoke is run.
