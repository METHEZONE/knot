# ExecPlan 25 - Promotion Budget Input UX

## Scope

Fix the Brand promotion wizard numeric budget input so a user can replace the
initial value cleanly, for example entering `10` without seeing `010`.

## Source Documents Read

- `docs/00_DOCUMENT_INDEX.md`
- `docs/IMPLEMENTATION_STATUS.md`

## Constraints

- Frontend-only UX fix.
- Do not change API contracts, Firestore data, deployment, wallet state, or
  on-chain state.
- Preserve existing promotion payload normalization rules.

## Implementation Steps

1. [x] Inspect the Brand promotion creation wizard numeric input handling.
2. [x] Allow USDC draft values to keep an empty editing state.
3. [x] Normalize values only when deriving UI amounts or submitting the
   promotion payload.
4. [x] Run frontend typecheck, lint, and tests.
5. [x] Update implementation status.

## Verification

- `npm --prefix frontend run typecheck`: passed.
- `npm --prefix frontend run lint`: passed.
- `npm --prefix frontend run test`: 21 passed.
