# Phase 16 - Creator Agent Card Dynamic Tenant Compatibility

## Goal

Remove the fixture-only tenant from the Creator Agent Card so Product API can validate the Creator Agent service for dynamically-created creator agents.

## Scope

- Change the Creator Agent service card from a single hardcoded tenant to a multi-tenant service interface.
- Preserve Product API validation that rejects cards advertising a conflicting tenant.
- Add regression coverage to prevent the fixture tenant from returning.

## Non-goals

- No Firestore migration.
- No production deployment.
- No on-chain transaction or wallet funding.
- No changes to Firebase Auth provider configuration.

## Verification

- `.venv/bin/python -m pytest backend/tests/test_health_apps.py backend/tests/test_api_a2a_http_integration.py backend/tests/test_api_promotions.py::test_start_negotiation_uses_creator_a2a_http_when_configured -q`
- `cd frontend && npm run typecheck`

## Status

- [x] Hardcoded `creator-agent-001` tenant removed from public Agent Card.
- [x] Health test asserts the service card is not fixture-tenant bound.
- [x] HTTP A2A integration tests still pass.
