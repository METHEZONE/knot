# KNOT Repository Instructions

## Product goal

```text
Real authentication
→ one-page role onboarding
→ role dashboard
→ Promotion / Offer
→ real A2A negotiation
→ Agreement
→ Solana devnet Escrow
```

Society Map is not part of the MVP.

## Sources of truth

Read `docs/00_DOCUMENT_INDEX.md` first. Do not use archived documents as requirements. `DESIGN.md` and existing visual assets remain the visual source of truth.

## Development rules

1. Inspect existing code before editing.
2. Preserve working UI components and visual tokens.
3. Refactor incrementally; do not rewrite the repository from scratch.
4. Use real resource identifiers in routes and APIs.
5. Firebase Auth UID is the user identity source.
6. Firestore is the business-state source.
7. The browser must not write business data directly to Firestore.
8. API mode must never fall back to a successful mock result.
9. Seed data may exist only through an explicit dev/admin seed action.
10. Brand Agent and Creator Agent must cross an actual HTTP boundary for A2A.
11. Gemini proposes; deterministic policy code authorizes.
12. LLM output never authorizes payment or escrow.
13. Do not expose private brand or creator policy to the other party.
14. Do not expose credentials, tokens, wallet secrets, or private keys.
15. Do not claim escrow success without a confirmed Solana devnet signature.
16. Ask for approval before deployment, IAM/Secret changes, destructive data work, wallet funding, program deployment, or on-chain transactions.

## Required workflow

For each phase:

1. Read only the documents listed in the phase prompt.
2. Reproduce current behavior.
3. Write or update one ExecPlan in `.agent/execplans/`.
4. Implement only the approved phase.
5. Run phase tests.
6. Review the diff.
7. Update implementation status and migration notes.
8. Stop before the next phase.

## Definition of done

A feature is done only when the real data path works, state survives refresh, backend authorization is enforced, loading/empty/error states exist, tests exercise the real path, and no successful fixture fallback hides failure.
