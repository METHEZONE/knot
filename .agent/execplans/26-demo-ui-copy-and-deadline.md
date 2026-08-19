# ExecPlan 26 - Demo UI Copy And Deadline

## Scope

Polish the final demo UI so common screens use user-facing language instead of
internal engineering terms, remove the extra pay.sh summary block above the
negotiation conversation, slightly increase negotiation message readability,
and add deadline selection to Brand promotion creation.

## Source Documents Read

- `docs/00_DOCUMENT_INDEX.md`
- `docs/18_UI_COPY_AND_STATE_DICTIONARY.md`
- `docs/13_AGREEMENT_ESCROW_EVIDENCE_SETTLEMENT.md`
- `docs/IMPLEMENTATION_STATUS.md`

## Constraints

- Frontend-only change.
- Do not change API contracts, Firestore shape, wallet state, Secret Manager,
  Solana programs, or on-chain transactions.
- Keep pay.sh verification visible in the conversation timeline, but remove
  the duplicate top summary panel.
- Keep internal trigger names for logic only; do not expose
  `creatorAccepted` or `contentLiveVerified` in user-facing labels.

## Implementation Steps

1. [x] Remove the top pay.sh verification summary from Negotiation Detail.
2. [x] Increase negotiation message and metadata font sizes slightly.
3. [x] Add `게시 마감일` date input to Brand promotion creation.
4. [x] Rename visible milestone/agent/status terms to user-facing Korean copy.
5. [x] Map escrow, agreement, promotion, payment, and evidence status codes to
   readable labels.
6. [x] Run frontend typecheck, lint, tests, and build.
7. [x] Update implementation status.

## Verification

- `npm --prefix frontend run typecheck`: passed.
- `npm --prefix frontend run lint`: passed.
- `npm --prefix frontend run test`: 21 passed.
- `npm --prefix frontend run build`: passed.
