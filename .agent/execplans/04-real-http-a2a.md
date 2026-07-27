# Phase 4 Real HTTP A2A

## Goal
Move negotiation from an in-process demo shortcut to a real HTTP boundary between Product API / Brand Agent and the Creator A2A Service.

## Current Behavior
- Creator Agent exposes A2A v1 HTTP endpoints and creates server-side Tasks.
- Product API can call Creator Agent over HTTP when configured, but only processes the first Creator response.
- A Creator COUNTER leaves the negotiation pending instead of continuing to Brand deterministic policy evaluation and ACCEPT.
- Service-to-service auth and AgentCard discovery are not enforced.
- Some persisted negotiation state includes a Creator policy snapshot.

## In Scope
- Add service-token authentication to the Product API to Creator A2A HTTP call.
- Require the same service-token on Creator A2A message/task endpoints when configured.
- Add AgentCard discovery before negotiation over HTTP.
- Keep initial OFFER without `taskId`.
- Let Creator A2A Service create `taskId`.
- Continue the same `contextId` and `taskId` with Brand ACCEPT when Brand policy allows the Creator COUNTER.
- Persist OFFER, COUNTER, ACCEPT, final ACCEPT response, decisions, A2A Task, Artifact, and Agreement.
- Ensure Agreement is created exactly once from the terminal Artifact.
- Persist sanitized promotion activity for UI.
- Add actual HTTP integration and privacy tests.

## Out of Scope
- Escrow, evidence, and settlement execution.
- Dev Admin.
- A2A streaming UI.
- New deployment/IAM/Secret Manager work.

## Files and Symbols
- `backend/libs/settings/config.py`: A2A service token setting.
- `backend/libs/a2a/client.py`: AgentCard discovery and bearer auth headers.
- `backend/apps/creator_agent/main.py`: service-token enforcement.
- `backend/apps/api/routes.py`: multi-turn negotiation orchestration and sanitized event persistence.
- `backend/tests/test_a2a_negotiation.py`: Creator A2A auth and protocol tests.
- `backend/tests/test_api_promotions.py`: Product API orchestration tests.
- `backend/tests/test_api_a2a_http_integration.py`: real HTTP golden path.
- `docs/IMPLEMENTATION_STATUS.md`, `docs/HANDOFF.md`.

## Data Migration
No migration.

New negotiations omit raw Creator private policy snapshots. Existing documents are not rewritten.

## Security Considerations
- Browser clients never call Creator A2A directly.
- Service auth is enforced when `KNOT_A2A_SERVICE_TOKEN` is configured.
- UI-facing Promotion activity receives sanitized status events only.
- Creator private minimums, private notes, raw prompts, and credentials are not written to public negotiation or event documents.

## Milestones
- [x] Read Phase 4 instructions and required docs.
- [x] Create Phase 4 ExecPlan.
- [x] Add service auth and AgentCard discovery.
- [x] Implement multi-turn Product API negotiation.
- [x] Add/update tests.
- [x] Run phase tests.
- [x] Review diff.
- [x] Update status and handoff.

## Tests
Planned:

```text
cd backend && ../.venv/bin/python -m ruff check apps libs tests
cd backend && ../.venv/bin/python -m pytest tests/test_a2a_negotiation.py tests/test_api_promotions.py tests/test_api_a2a_http_integration.py tests/test_api_resource_routes.py tests/test_health_apps.py
cd frontend && npm run typecheck
cd frontend && npm run lint
cd frontend && npm run test
cd frontend && npm run build
```

## Rollback
Revert the Phase 4 commit. No deployment, IAM, Secret Manager, or destructive data work is performed.

## Progress
- [x] Phase 3 pushed as `ac43767`.
- [x] ExecPlan created.
- [x] `KNOT_A2A_SERVICE_TOKEN` added to shared settings.
- [x] Product A2A client now discovers AgentCard and sends bearer service auth when configured.
- [x] Creator A2A message/task APIs require service auth when configured.
- [x] Product API now continues Creator COUNTER with Brand deterministic policy evaluation and ACCEPT on the same `contextId`/`taskId`.
- [x] Negotiation messages, decisions, A2A Task, Artifact, Agreement, and sanitized Promotion activity are persisted.
- [x] Creator private policy snapshot is redacted in new negotiation documents.
- [x] Actual localhost HTTP integration test added for `OFFER -> COUNTER -> ACCEPT -> TASK_STATE_COMPLETED -> Agreement`.

## Risks
- HTTP integration tests require binding an ephemeral localhost port. The sandboxed run blocked bind with `PermissionError: [Errno 1] Operation not permitted`; the same pytest command passed with approved elevated execution.

## Completion Evidence
Implemented and verified.

Commands:

```text
cd backend && ../.venv/bin/python -m ruff check apps libs tests/test_a2a_negotiation.py tests/test_api_promotions.py tests/test_api_a2a_http_integration.py
cd backend && ../.venv/bin/python -m pytest tests/test_a2a_negotiation.py tests/test_api_promotions.py tests/test_api_a2a_http_integration.py tests/test_api_resource_routes.py tests/test_health_apps.py
cd backend && ../.venv/bin/python -m ruff check apps libs tests
cd frontend && npm run typecheck
cd frontend && npm run lint
cd frontend && npm run test
cd frontend && npm run build
```

Results:

- Backend Ruff: passed.
- Backend selected pytest: 31 passed, 1 Starlette/httpx deprecation warning.
- Frontend typecheck: passed.
- Frontend lint: passed.
- Frontend tests: 12 passed.
- Frontend production build: passed.

Evidence:

- `tests/test_api_a2a_http_integration.py` starts a real Creator A2A HTTP service and verifies AgentCard discovery, service auth, server-created `taskId`, shared `contextId`, `OFFER -> COUNTER -> ACCEPT -> ACCEPT` messages, terminal Task state, and Agreement creation.
- `tests/test_a2a_negotiation.py` verifies Creator A2A auth rejection and allowed service-token access.
- `tests/test_api_promotions.py` verifies Product API HTTP failure does not create a fake Agreement and Creator private policy is redacted from new negotiation documents.
