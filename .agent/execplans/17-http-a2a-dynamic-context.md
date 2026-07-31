# Phase 17 - HTTP A2A Dynamic Context for Local Account Flows

## Goal

Allow local HTTP A2A mode to negotiate with creator agents created through real authenticated onboarding, even when Product API and Creator Agent are running as separate in-memory processes.

## Scope

- Add optional server-to-server A2A request metadata.
- Send `creatorNegotiationContext` from Product API to Creator Agent over the internal A2A HTTP call.
- Register embedded context only for unknown tenants so Creator Agent-owned context remains authoritative when present.
- Keep persisted negotiation messages free of private metadata.
- Add regression tests for embedded dynamic context.

## Non-goals

- No browser Firestore writes.
- No production mock fallback.
- No on-chain transaction, wallet funding, IAM, secret, or deployment work.

## Verification

- `.venv/bin/python -m pytest backend/tests/test_a2a_negotiation.py backend/tests/test_health_apps.py backend/tests/test_api_a2a_http_integration.py backend/tests/test_api_promotions.py::test_start_negotiation_uses_creator_a2a_http_when_configured backend/tests/test_api_promotions.py::test_start_negotiation_uses_saved_initial_offer_for_counter_flow backend/tests/test_api_escrow.py backend/tests/test_escrow_devnet.py -q`
- `cd frontend && npm run typecheck`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`

## Status

- [x] A2A metadata added.
- [x] Product API sends internal Creator negotiation context over HTTP A2A.
- [x] Creator Agent registers embedded context for dynamic unknown tenants.
- [x] Existing Creator Agent-owned context is not overwritten.
- [x] Tests passed.
