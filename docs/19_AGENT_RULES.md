# Root AGENTS.md에 반영할 KNOT v2 규칙

아래 내용을 루트 `AGENTS.md`의 프로젝트 규칙에 반영한다.

```md
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
```

기존에 아래와 같은 규칙이 있으면 제거한다.

- Do not implement onboarding
- Keep the legacy onboarding
- Use the legacy page specification
- Settings must remain role-specific
