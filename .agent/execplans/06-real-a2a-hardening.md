# Phase 6 - Real A2A Negotiation Hardening

## Goal

Preserve the existing A2A HTTP flow while adding registry lookup, AgentCard validation, and durable A2A task event projections.

## Current Behavior

- Product API already sends real HTTP A2A messages when configured.
- Creator A2A server already validates service auth, deduplicates message IDs, and rejects new messages for terminal tasks.
- Product API persisted negotiation messages, decisions, task records, and final artifacts.

## In Scope

- Add Creator Agent Registry projection builder.
- Write `agentRegistry/{agentId}` from seeded/published Creator Agents.
- Require registry lookup before Product API starts negotiation.
- Validate AgentCard interface protocol/version/tenant and negotiation skill.
- Persist `a2aTasks/{taskId}/events` from negotiated messages and final task state.
- Add focused privacy/event tests.

## Out of Scope

- Replacing the current A2A model classes with another SDK.
- Streaming implementation beyond existing endpoint compatibility.
- Queue-based async Match Run worker.
- Reservation leases.
- UI replay changes.

## Files and Symbols

- `backend/libs/a2a/registry.py`
- `backend/apps/api/routes.py`
- `backend/libs/repositories/seed.py`
- `backend/tests/test_api_promotions.py`
- `backend/tests/test_api_dashboards.py`
- `backend/tests/test_api_a2a_http_integration.py`
- `backend/tests/test_a2a_negotiation.py`
- `docs/API_COMPATIBILITY_MATRIX.md`
- `docs/FIRESTORE_MIGRATION_PLAN.md`
- `docs/IMPLEMENTATION_STATUS.md`

## Data Changes

- `agentRegistry/{agentId}` stores public routing metadata only.
- `a2aTasks/{taskId}/events/{eventId}` stores ordered A2A message/task-state events.

## Security Considerations

- Registry entries exclude exact minimum rates, blocked policy, prompts, credentials, wallet secrets, and private notes.
- Product API refuses negotiation when registry tenant does not match selected Creator Agent.
- AgentCard validation requires HTTP+JSON v1.0 interface for the selected tenant.

## Milestones

- [x] Add registry projection builder.
- [x] Write registry entries from seed and publish/pause flows.
- [x] Require registry lookup and AgentCard validation before A2A send.
- [x] Persist A2A task events.
- [x] Add focused tests.
- [x] Run full phase checks.
- [x] Commit and push.

## Tests

Planned:

- `cd backend && ../.venv/bin/python -m pytest tests/test_api_promotions.py tests/test_api_dashboards.py tests/test_api_a2a_http_integration.py tests/test_a2a_negotiation.py`
- `cd backend && ../.venv/bin/python -m pytest`
- `cd backend && ../.venv/bin/python -m ruff check .`
- `cd backend && ../.venv/bin/python -m mypy`
- `cd frontend && npm run typecheck`
- `cd frontend && npm run lint`
- `cd frontend && npm test`
- `cd frontend && npm run build`

## Rollback

Revert the Phase 6 commit. Registry and A2A event documents are additive.

## Progress

- [x] Focused backend tests passed: `38 passed, 1 warning`.
- [x] Backend ruff passed.
- [x] Backend mypy passed.

## Decisions

- Keep current HTTP+JSON A2A binding and validate the existing local schema rather than replacing working protocol code.
- Allow missing `skills` in legacy/fake AgentCards, but enforce negotiation skill when `skills` is present.

## Risks

- A2A task store remains in-memory inside Creator Agent unless Firestore-backed service settings are used.
- Streaming/subscription remains compatibility polling, not real server-sent streaming.

## Completion Evidence

- `backend`: focused A2A hardening tests passed, `38 passed, 1 warning`.
- `backend`: full pytest passed, `108 passed, 5 skipped, 2 warnings`.
- `backend`: ruff passed.
- `backend`: mypy passed.
- `frontend`: typecheck passed.
- `frontend`: lint passed.
- `frontend`: unit tests passed, `18 passed`.
- `frontend`: production build passed.
