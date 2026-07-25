# KNOT A2A Protocol Architecture v1

**Binding:** HTTP+JSON  
**A2A version:** `1.0`  
**KNOT payload schema:** `knot.negotiation.v1`  
**Scope:** Brand Agent discovery of a selected Creator Agent and multi-turn negotiation.

## 1. Boundary

A2A handles AgentCard discovery, Messages, Tasks, multi-turn state, streaming updates and Artifacts. Matching strategy, policy decisions, Gemini prompts, payment signing and settlement rules are KNOT domain concerns.

Brand Agent is the A2A client. The Creator Agent service is the A2A server for the negotiation task.

## 2. Agent discovery and tenant routing

The Creator Agent Registry stores one AgentCard per logical Creator Agent. Multiple cards may advertise the same Cloud Run interface and a different opaque `tenant` value.

```json
{
  "name": "KNOT Creator Negotiation Agent",
  "description": "Evaluates and negotiates creator promotion offers.",
  "supportedInterfaces": [{
    "url": "https://<creator-agent-service>/a2a/v1",
    "protocolBinding": "HTTP+JSON",
    "protocolVersion": "1.0",
    "tenant": "creator-agent-001"
  }],
  "provider": {"organization": "KNOT", "url": "https://knot.example"},
  "version": "1.0.0",
  "capabilities": {
    "streaming": true,
    "pushNotifications": false,
    "extendedAgentCard": false
  },
  "securitySchemes": {
    "bearerAuth": {"httpAuthSecurityScheme": {"scheme": "Bearer"}}
  },
  "securityRequirements": [{"bearerAuth": []}],
  "defaultInputModes": ["application/json"],
  "defaultOutputModes": ["application/json"],
  "skills": [{
    "id": "promotion-negotiation",
    "name": "Promotion Negotiation",
    "description": "Returns counter, accept, reject or escalation decisions.",
    "tags": ["creator", "promotion", "negotiation"],
    "inputModes": ["application/json"],
    "outputModes": ["application/json"]
  }]
}
```

The client echoes the advertised tenant in every request. Elsewhere in KNOT, call this value `creatorAgentId`; reserve `tenant` for the A2A protocol field.

## 3. Required headers

```http
Content-Type: application/a2a+json
A2A-Version: 1.0
Authorization: Bearer <service identity token>
```

## 4. Required operations

```text
POST /message:send
POST /message:stream
GET  /tasks/{id}
GET  /tasks
POST /tasks/{id}:subscribe
POST /tasks/{id}:cancel
```

The v1 application may use polling in the web-facing API, but the Creator A2A service must support either `message:stream` or task subscription for the demo.

## 5. Domain payload

```json
{
  "mediaType": "application/json",
  "data": {
    "schema": "knot.negotiation.v1",
    "type": "OFFER",
    "round": 1,
    "terms": {
      "compensation": {"structure": "flat", "baseAmountUsdc": 500},
      "deliverables": [{"format": "reel", "count": 1}],
      "usageRights": "paidBoost30d",
      "deadline": "2026-08-10"
    },
    "changedFields": [],
    "rationale": "Initial promotion offer"
  }
}
```

`type`, `round`, and KNOT terms are domain fields, not A2A enums.

## 6. Initial request

The client generates `messageId` and `contextId`; it omits `taskId` for a new negotiation. The server creates the Task.

```json
{
  "tenant": "creator-agent-001",
  "message": {
    "messageId": "uuid",
    "contextId": "uuid",
    "role": "ROLE_USER",
    "parts": [{
      "mediaType": "application/json",
      "data": {
        "schema": "knot.negotiation.v1",
        "type": "OFFER",
        "round": 1,
        "terms": {}
      }
    }]
  },
  "configuration": {"acceptedOutputModes": ["application/json"]}
}
```

## 7. Multi-turn response

A counter response uses:

```text
Task.status.state = TASK_STATE_INPUT_REQUIRED
Task.status.message.role = ROLE_AGENT
Part.data.type = COUNTER
```

The next Brand Agent message uses the same `taskId` and `contextId` with `ROLE_USER`.

## 8. Completion

An agreement completes the task and returns an Artifact:

```json
{
  "artifactId": "uuid",
  "name": "Negotiation Result",
  "parts": [{
    "mediaType": "application/json",
    "data": {
      "schema": "knot.term-sheet.v1",
      "result": "AGREED",
      "agreementId": "uuid",
      "terms": {},
      "termsHash": "sha256:..."
    }
  }]
}
```

A business rejection after valid processing is `TASK_STATE_COMPLETED` with a rejection Artifact. `TASK_STATE_REJECTED` is reserved for refusing the task itself.

## 9. State mapping

| A2A TaskState | KNOT use |
|---|---|
| `TASK_STATE_SUBMITTED` | request accepted |
| `TASK_STATE_WORKING` | agent/model/policy processing |
| `TASK_STATE_INPUT_REQUIRED` | waiting for next negotiation turn or human input |
| `TASK_STATE_AUTH_REQUIRED` | additional authority required |
| `TASK_STATE_COMPLETED` | agreement or valid business rejection Artifact created |
| `TASK_STATE_REJECTED` | server refuses task execution |
| `TASK_STATE_FAILED` | system failure |
| `TASK_STATE_CANCELED` | canceled |

## 10. Invariants

1. JSON field names are camelCase.
2. A2A enum strings use official ProtoJSON values.
3. `A2A-Version: 1.0` is included in every request.
4. New task IDs are server-generated.
5. A follow-up `taskId` and `contextId` must refer to the same task.
6. A Part contains exactly one of `text`, `raw`, `url`, or `data`.
7. Terminal tasks accept no negotiation messages.
8. `messageId` provides idempotency.
9. Stream event order is persisted with a monotonic sequence.
10. Final business terms are in an Artifact, not inferred from rationale text.
