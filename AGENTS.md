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

## KNOT v2 Product Source of Truth

- Follow `docs/KNOT_PRODUCT_MASTER_SPEC_V2.md`.
- Use `docs/00_DOCUMENT_INDEX.md` to select specialized documents.
- Do not use archived or git-history product documents as active requirements.
- Frontend UI/UX source of truth is `origin/feat/two-user-session`.
- Preserve its onboarding, Manager, Agent conversation, and Settings visual language.
- Backend/API/A2A/Agreement/Escrow/Settlement source of truth is the stable branch that currently runs the real services.
- Connect UI and backend through ViewModel/Adapter layers.
- Do not restore the legacy long-form onboarding.
- Do not mix old and new dashboards or duplicate settings pages.
- `매니저 붙이기` creates and connects an Agent; it does not start a negotiation.
- Creator `협찬 받기` and Brand `협찬 제안하기` are the Agent run entry points.
- Dashboard shows summaries. Negotiation Detail shows the full Agent conversation.
- Store rejected and expired negotiations.
- Never expose counterparty private policy, raw prompts, chain-of-thought, credentials, or wallet secrets.
- Never use silent mock fallback in production.
- Never fabricate profile metrics, Agreement hashes, Solana signatures, Explorer links, or payment success.
- Use Solana localnet/devnet only for the MVP. Do not use mainnet.
- Preserve idempotency for A2A messages, Agreement creation, escrow lock, and milestone release.
- Run relevant tests and update `docs/IMPLEMENTATION_STATUS.md` at every phase.
- Do not push directly to main.

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
