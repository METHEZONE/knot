# Phase 4 — Real HTTP A2A

Read `AGENTS.md`, active ExecPlan, and docs 06, 07, 08, 11, 13.

Goal: Product API/Brand Agent to Creator A2A Service HTTP negotiation.

Requirements:

- AgentCard
- service auth
- tenant routing
- initial OFFER without taskId
- server-created Task
- Creator COUNTER
- Brand deterministic policy
- Brand ACCEPT
- final Artifact
- persisted messages/events/decisions
- sanitized UI projection
- actual HTTP integration test
- no timer state
- no policy leak

Use one primary writer. A read-only reviewer may review after tests. Do not begin escrow.
