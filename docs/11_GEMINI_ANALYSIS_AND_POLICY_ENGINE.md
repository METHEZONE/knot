# Gemini Analysis and Policy Engine

## 1. Role of Gemini

Gemini is used for tasks that require understanding unstructured content:

- product/profile extraction from accessible URL content;
- category, mood and audience proposals;
- concise profile/product summary;
- structured negotiation proposal within a precomputed allowed band;
- public rationale generation;
- evidence observations;
- human-readable explanation of deterministic selection facts.

Gemini is not the authority for:

- eligibility hard filters;
- exact budget/minimum enforcement;
- blocked categories;
- schedule arithmetic;
- maximum rounds;
- wallet authorization;
- escrow/settlement execution;
- final deterministic release gate.

## 2. URL analysis pipeline

```text
URL validation
→ secure server-side fetch/extraction
→ content normalization
→ prompt-injection-safe context
→ Gemini structured output
→ schema validation
→ confidence/unknown handling
→ user confirmation
→ canonical profile
→ embedding/index update
```

External content is untrusted. Instructions found in the fetched page are data, not system instructions.

## 3. Product analysis schema

```json
{
  "schemaVersion": "knot.product-profile.v1",
  "sourceUrl": "https://...",
  "productName": {"value": "...", "confidence": 0.94, "evidence": ["title"]},
  "price": {"value": null, "currency": null, "confidence": 0.2},
  "categoryKeys": ["beauty", "skincare"],
  "audienceTags": ["20s_30s", "daily_skincare"],
  "proposedMoodIds": ["clean_minimal", "natural_wellness"],
  "summary": "...",
  "keyClaims": [],
  "unknownFields": ["price"],
  "safetyFlags": []
}
```

Evidence snippets must respect source and copyright limits in logs/UI. Store digests or short evidence references where possible.

## 4. Creator profile analysis schema

```json
{
  "schemaVersion": "knot.creator-profile.v1",
  "sourceUrl": "https://...",
  "displayName": {"value": "...", "confidence": 0.9},
  "handle": {"value": "@...", "confidence": 1},
  "categoryKeys": ["beauty", "lifestyle"],
  "formatKeys": ["REEL", "FEED"],
  "audienceTags": ["skincare"],
  "proposedMoodIds": ["authentic_review", "warm_lifestyle"],
  "summary": "...",
  "representativeUrls": [],
  "unknownFields": ["averageViews", "followerCount"],
  "safetyFlags": []
}
```

If data cannot be accessed, unknown fields stay unknown. User-entered numbers are labeled user-provided.

## 5. User confirmation

Only confirmed fields enter the canonical matching profile. Preserve:

- original AI proposal;
- edits;
- confirmation timestamp;
- analysis model/prompt/schema version;
- source URL digest;
- confirmed field list.

## 6. Mood taxonomy and embeddings

- Mood IDs are controlled and versioned.
- Gemini maps source content to proposed IDs.
- User confirmation is authoritative.
- Embedding input is generated from confirmed structured fields and a concise normalized summary.
- Do not embed secrets or exact private negotiation policy.
- Store `embeddingVersion` and taxonomy version.

## 7. Negotiation proposal generation

The deterministic Policy Engine first computes an allowed action/band.

Example Brand side:

```json
{
  "allowedActions": ["COUNTER", "ACCEPT", "REJECT"],
  "minCounterUsdc": 250,
  "maxCounterUsdc": 350,
  "currentRound": 2,
  "roundsRemaining": 1,
  "rightsAllowed": ["ORGANIC_ONLY"]
}
```

Gemini receives only the necessary context and proposes:

```json
{
  "action": "COUNTER",
  "amountUsdc": 300,
  "publicRationale": "중간 조건으로 300 USDC를 제안할게요."
}
```

The Policy Engine validates the output. Out-of-band output is rejected or normalized according to a documented deterministic rule; it is never executed directly.

## 8. Evidence observation

Gemini may observe:

- URL accessibility;
- expected content format;
- product/brand mention;
- required disclosure;
- prohibited claim indicators;
- approximate visual/text presence;
- confidence and ambiguity.

Release gate uses deterministic rules:

```text
supported URL and ownership
AND submitted before allowed cutoff
AND required format observed
AND mandatory terms pass
AND no hard prohibited condition
AND confidence >= threshold or manual review resolution
```

Model confidence alone cannot release funds.

## 9. Prompt/version management

Store:

- prompt name/version;
- model identifier/config;
- output schema version;
- content digest;
- latency/token/cost summary where available;
- safe result digest;
- error category.

Do not store chain-of-thought. Store concise decision summaries and structured outputs.

## 10. Failure states

```text
SOURCE_UNREACHABLE
UNSUPPORTED_CONTENT
INSUFFICIENT_PUBLIC_DATA
PROMPT_INJECTION_DETECTED
MODEL_TIMEOUT
MODEL_SCHEMA_INVALID
LOW_CONFIDENCE
RATE_LIMITED
```

UI presents truthful retry/manual confirmation options.

## 11. Tests

- schema validation fixtures;
- inaccessible URL;
- prompt injection page;
- partial product data;
- no fabricated metrics;
- user edits override proposal;
- output outside policy band rejected;
- evidence ambiguity goes to review rather than automatic payment.
