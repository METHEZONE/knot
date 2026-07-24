# Google ADK Agent Design

## 1. Agent inventory

### Brand Agent

Responsibilities:

- parse active Promotion and Brand policy
- call creator discovery and matching tools
- form an initial structured offer
- call the Creator Agent through A2A
- evaluate counters and choose counter/accept/reject/escalate
- request paid verification through pay.sh adapter
- request escrow lock/release after policy approval

### Creator Agent

Responsibilities:

- load creator profile, rate card, availability and policy by `creatorAgentId`
- evaluate A2A offer/counter
- return structured decision
- never call the web3 gateway in v1

## 2. ADK deployment mapping

- Brand Agent lives in `knot-api`.
- Creator Agent is exposed by `knot-creator-agent` as an A2A server.
- Both use Vertex AI Gemini through ADK.
- Session state and long-lived business state are distinct: ADK session is transient context; Firestore domain documents are authoritative.

## 3. Tool boundaries

Brand Agent tools:

```text
getPromotion
listCreatorCandidates
getCreatorProfile
scoreCandidates
validateBrandTerms
sendA2AMessage
getA2ATask
purchaseVerificationApi
createAgreement
requestEscrowLock
verifyEvidence
requestMilestoneRelease
appendAuditEvent
```

Creator Agent tools:

```text
getCreatorContext
validateCreatorTerms
getNegotiationHistory
appendDecision
appendAuditEvent
```

Tools return typed objects. Do not make an LLM parse command-line output or Firestore snapshots as free text.

## 4. Structured output

Each negotiation generation uses a schema equivalent to:

```json
{
  "type": "COUNTER",
  "terms": {},
  "changedFields": ["compensation.baseAmountUsdc"],
  "rationale": "The offered amount is below the creator minimum.",
  "confidence": 0.93
}
```

Allowed `type`: `OFFER`, `COUNTER`, `ACCEPT`, `REJECT`, `ESCALATE`.

Pydantic validates shape. Policy Engine validates semantics. Invalid model output gets one repair attempt; then the task fails safely or escalates.

## 5. Prompt construction

Prompt inputs must include only:

- agent role and non-secret profile summary
- immutable policy snapshot
- Promotion fields relevant to the decision
- current structured terms
- bounded negotiation history
- requested output schema

Never include:

- private keys, secret names that reveal credentials, bearer tokens
- unrelated user records
- full raw logs
- policy instructions that exist only in natural language without code enforcement

## 6. Matching use of Gemini

Matching order:

1. deterministic hard filters
2. deterministic weighted score
3. deterministic sort and tie-break
4. Gemini explanation for top candidates

Gemini must not invent missing creator metrics. Explanations cite the input fields used.

## 7. Evidence analysis

Gemini may extract observations from fetched content or supplied snapshots. It cannot decide payment. Policy code maps observations to pass, revision-required, escalation or reject.

## 8. Evaluation set

Create a small committed dataset with:

- low offer requiring counter
- blocked industry requiring reject
- acceptable offer requiring accept
- rights preset outside creator policy
- Brand budget overflow
- ambiguous case requiring escalation
- evidence missing disclosure

Run agent evaluation or deterministic golden tests before demo freeze.
