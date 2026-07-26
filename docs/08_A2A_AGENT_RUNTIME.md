# Real A2A and Agent Runtime

## Required boundary

```text
Product API / Brand Agent Client
→ Creator A2A Service
```

These are separate runtime boundaries communicating via HTTP. Shared code is allowed; in-process negotiation completion is not.

## Protocol

- HTTP+JSON
- version `1.0`
- `Content-Type: application/a2a+json`
- `A2A-Version: 1.0`
- domain schema `knot.negotiation.v1`

MVP operations:

```text
GET  /.well-known/agent-card.json
POST /message:send
GET  /tasks/{id}
POST /tasks/{id}:cancel
```

Polling is acceptable for UI events.

## Discovery

Creator registry resolves `creatorAgentId`, AgentCard URL, A2A base URL, tenant, and status. AgentCard exposes public capability only.

## Multi-turn path

```text
Brand OFFER
→ Creator Task created
→ Creator COUNTER
→ TASK_STATE_INPUT_REQUIRED
→ Brand policy evaluation
→ Brand ACCEPT
→ TASK_STATE_COMPLETED
→ Agreement Artifact
```

Initial request has no `taskId`; Creator server creates it. Follow-ups preserve `contextId` and `taskId`.

## Decision model

Gemini returns structured proposals. Deterministic policy validates them.

Brand checks:

- amount <= hard maximum
- autonomous ACCEPT <= auto-accept ceiling
- total budget not exceeded
- maximum rounds
- allowed usage rights
- valid deadline

Creator checks:

- private minimum or counter
- blocked domain
- content type
- usage rights
- approval threshold

## UI projection

Return sanitized events only:

```text
AgentCard discovered
OFFER sent
Creator Agent reviewed the offer
COUNTER received
Brand autonomy policy passed
ACCEPT sent
Agreement created
```

Do not expose chain-of-thought or private policy values.

## Required tests

- AgentCard
- initial message without taskId
- server-created taskId
- tenant validation
- context/task consistency
- duplicate messageId
- OFFER → COUNTER → ACCEPT
- Artifact
- terminal state
- private projection
- service auth
- actual HTTP integration
