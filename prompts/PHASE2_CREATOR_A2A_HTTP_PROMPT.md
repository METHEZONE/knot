# KNOT Phase 2 Prompt: Product API to Creator A2A HTTP

Read the repository instructions and canonical docs first:

1. `AGENTS.md`
2. `docs/01_PRD_v1.md`
3. `docs/02_SCOPE_GLOSSARY.md`
4. `docs/03_SYSTEM_ARCHITECTURE.md`
5. `docs/07_API_CONTRACTS.md`
6. `docs/09_A2A_PROTOCOL_v1.md`
7. `docs/20_IMPLEMENTATION_STATUS.md`
8. `PLANS.md`

## Goal

Replace the current Product API internal negotiation shortcut with a
service-to-service Creator A2A HTTP call while preserving the Product API as the
only browser-facing orchestration boundary.

## Non-negotiables

- KNOT v1 only.
- Use `Promotion` / `promotionId`; do not introduce `campaign` or `dealBrief`
  in new product code.
- Do not implement onboarding beyond existing demo-account persistence.
- Do not expose private keys, seed phrases, service-account JSON, API tokens, or
  secrets.
- Do not let LLM output authorize escrow lock or release.
- Preserve official A2A v1 `Message`, `Task`, `TaskState`, and `Artifact`
  semantics.
- Browser code must not construct direct A2A payloads. Product API owns
  orchestration and exposes sanitized projections to the frontend.

## Current baseline

Phase 1 made frontend API mode the default, removed page-load write fallbacks,
added read-only `GET /negotiations/{id}/agreement` and
`GET /agreements/{id}/escrow`, and moved Creator detail routing to
`/creator/agreements/{agreementId}`.

The remaining gap is that `POST /match-runs/{matchRunId}:start-negotiation`
still calls backend policy code directly instead of sending an official A2A
HTTP message to `apps/creator_agent`.

## Required work

1. Audit the current Creator A2A server routes and official A2A docs in this
   repository.
2. Define the Product API -> Creator A2A client contract.
3. Add a small A2A HTTP client module under `backend/libs` or the closest
   existing backend boundary.
4. Update Product API negotiation start so it can call Creator A2A over HTTP
   when configured, with a deterministic local fallback only for tests and local
   seed mode.
5. Persist returned A2A Task/Message/Artifact state using the existing
   Firestore model. Do not create duplicate business entities.
6. Keep frontend consuming Product API projections only.
7. Add tests for:
   - Product API using the A2A client boundary;
   - failure response does not create fake Agreement success;
   - persisted Task/Artifact still materializes an Agreement only when the
     Creator decision is accepted.
8. Update `PLANS.md` and `docs/20_IMPLEMENTATION_STATUS.md`.

## Validation

Run:

```text
cd backend && ../.venv/bin/python -m pytest tests/test_api_promotions.py tests/test_a2a_negotiation.py
cd backend && ../.venv/bin/python -m ruff check apps/api apps/creator_agent libs tests/test_api_promotions.py tests/test_a2a_negotiation.py
```

If frontend contracts change, also run:

```text
cd frontend && npm run typecheck
cd frontend && npm run lint
cd frontend && npm test
```

## Output

Summarize:

- what is now real A2A HTTP;
- what remains simulated or deterministic;
- exact test results;
- any new environment variables required for local and Cloud Run.
