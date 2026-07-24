# Bounded Autonomy, Policy Engine and Matching

## 1. Principle

The model proposes. Pure code authorizes. The payment gateway executes only an authorized, idempotent action.

## 2. Policy engine design

Implement as pure functions with typed input and output:

```python
PolicyDecision = {
    "allowed": bool,
    "action": "ALLOW" | "BLOCK" | "ESCALATE",
    "violations": list[Violation],
    "ruleVersion": str,
}
```

No Firestore, HTTP, ADK or model dependency inside rule functions.

## 3. Brand rules

Required v1 checks:

- selected creator satisfies required category and prohibited-category rules
- base and maximum payable amount are within total and per-creator budget
- performance percentage is within ceiling
- deliverables and usage-rights preset are allowed
- posting window is valid
- negotiation round is within limit
- `autoEscrow` and `autoRelease` permit the action
- cumulative committed/locked amount does not exceed Promotion budget

## 4. Creator rules

Required v1 checks:

- industry is not blocked
- base amount meets minimum after rights premium
- usage-rights preset is allowed
- posting lead time meets minimum
- deliverables fit capacity
- exclusivity and revision count fit policy

## 5. Payment rules

Before lock:

- Agreement is `AGREED` and hash matches canonical terms
- no existing escrow for agreement
- amount is positive and within snapshot
- brand signer and creator destination match agreement
- network, mint and program ID match environment allowlist

Before release:

- escrow is locked
- milestone exists and is unreleased
- evidence decision permits release
- requested amount equals milestone formula
- resulting total does not exceed locked amount

## 6. Evidence verification rules

Evidence verification policy version is `verification-v1`.

Deterministic checks:

- submitted Evidence must belong to an `AGREED` Agreement
- `submittedByAgentId` must match the Agreement `creatorAgentId`
- `observations.urlReachable` must be true
- `observations.brandMentioned` must be true
- `observations.disclosurePresent` must be true
- `observations.prohibitedClaimsFound` must be empty

Gemini or a paid verification API may generate observations later, but the
payment release decision can only use deterministic policy output.

## 7. Matching pipeline

### Hard filters

- active creator/agent
- category and prohibited-industry compatibility
- rate-card range can fit maximum budget
- schedule availability
- deliverable format support
- rights preset support

### Weighted score v1

```text
score =
  categoryScore   * 0.30 +
  budgetScore     * 0.25 +
  scheduleScore   * 0.20 +
  deliverableScore* 0.15 +
  reputationScore * 0.10
```

Every component is normalized to `[0, 1]`. Tie-break order: higher score, higher completed-deal count, lower estimated base price, lexicographic creatorAgentId.

### Gemini explanation

After ranking, Gemini receives the exact component scores and produces one or two sentences. It cannot change eligibility, score or rank.

## 8. Negotiation decision order

```text
Incoming A2A message
-> schema validation
-> immutable snapshot lookup
-> LLM candidate decision
-> domain validation
-> sender policy validation
-> receiver/payment preview validation where applicable
-> persist decision and A2A state
```

## 9. Escalation

Escalate rather than guess when:

- required data is absent
- two policy rules conflict
- proposed terms cannot be represented in v1 presets
- confidence is below configured threshold
- model repeatedly emits invalid structured output
- transaction preflight differs from expected amount or destination
