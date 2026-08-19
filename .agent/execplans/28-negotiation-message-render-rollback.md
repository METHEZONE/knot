# ExecPlan 28 - Negotiation Message Render Rollback

## Scope

Restore the negotiation message window to the previous stable rendering after
the sentence-splitting and larger-font change made the conversation UI break.

## Source Documents Read

- `docs/00_DOCUMENT_INDEX.md`
- Existing `NegotiationDetail.tsx` implementation.
- Previous stable version from commit `a5c44ae`.

## Implementation Steps

1. [x] Revert the message body from multi-line `messageLines` rendering to the
   previous single paragraph `messageLine` rendering.
2. [x] Restore message metadata, detail summary, JSON payload, and timestamp
   font sizes to `text-[11px]`.
3. [x] Remove unused sentence-splitting helpers.
4. [x] Run frontend typecheck, lint, and production build.

## Verification

- `npm --prefix frontend run typecheck`: passed.
- `npm --prefix frontend run lint`: passed.
- `npm --prefix frontend run build`: passed.

## Pending

- Deployment is pending explicit approval.
