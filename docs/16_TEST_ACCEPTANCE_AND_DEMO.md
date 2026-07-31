# Test Strategy, Acceptance Criteria and Demo

## 1. Evidence model

A feature is not complete because a screen exists. Track five dimensions:

| Capability | UI | API | Firestore | External/A2A/On-chain | E2E |
|---|---:|---:|---:|---:|---:|
| Auth/role | | | | | |
| Brand onboarding | | | | Gemini | |
| Creator onboarding | | | | Gemini | |
| Discovery/index | | | | Vector search | |
| Match Run | | | | Worker | |
| A2A negotiation | | | | A2A | |
| Agreement | | | | Artifact/hash | |
| Escrow | | | | Solana | |
| Evidence verification | | | | Gemini | |
| Settlement | | | | Solana | |

Statuses:

```text
NOT_STARTED
IN_PROGRESS
BLOCKED
IMPLEMENTED
VERIFIED
DEPLOYED
```

## 2. Unit tests

### Matching

- each hard filter;
- private blocked category eligibility;
- score component normalization;
- deterministic order/tie-break;
- unknown public rate band neutral behavior;
- max Top K and detail-read bounds;
- no candidate path;
- score explanation uses safe facts only.

### Policy

- Brand target/max;
- Creator target/minimum;
- rights compatibility;
- lead time arithmetic/timezone;
- blocked category;
- maximum rounds;
- paid API spend cap;
- escrow authority;
- settlement gate.

### State machines

- valid/invalid Match Run transitions;
- candidate fallback;
- first Agreement stops run;
- escrow failure does not negotiate next creator;
- cancel rules;
- worker lease expiry/reclaim.

### Idempotency

- duplicate run start;
- duplicate A2A Message;
- duplicate Agreement Artifact;
- duplicate lock/release;
- conflicting key payload.

### Security

- URL validation/SSRF cases;
- prompt injection fixture;
- private policy projection;
- cross-owner access;
- secret/log redaction.

## 3. Backend integration tests

Use repository-supported emulator/test dependencies.

- onboarding job to confirmed profile/index;
- discovery query against seeded discovery projections;
- reservation transaction race;
- Match Run worker with candidate 1 rejection and candidate 2 agreement;
- A2A server Message → Task → counter → Artifact;
- Agreement canonicalization/hash;
- Dashboard projection after events;
- evidence verification state;
- reconciliation after simulated partial failure.

## 4. Frontend tests

- current design components render unchanged in main states;
- card deck keyboard/swipe/back/refresh;
- analysis partial/error/edit;
- Brand start button disabled on invalid prerequisites;
- Creator publish/pause;
- live event ordering/reconnect;
- browser refresh during run;
- replay from stored events;
- owner-only private values;
- responsive and reduced motion;
- no double action from repeated click.

## 5. A2A contract tests

- AgentCard schema according to installed SDK;
- auth/tenant routing;
- initial Task creation;
- same task/context follow-up;
- Message ID dedupe;
- protocol versus business rejection;
- terminal Task immutable;
- stream sequence;
- Artifact schema;
- private policy absent.

## 6. Web3 tests

### Local validator

- program/gateway build;
- escrow initialization;
- lock exact amount;
- terms hash binding;
- unauthorized operation rejected;
- duplicate lock/release idempotency;
- release exact 100%;
- cannot over-release;
- wrong mint/program/recipient rejected.

### Devnet smoke

- actual test USDC or current supported devnet asset path;
- real lock signature;
- real release signature;
- Explorer link resolves;
- receipt persisted;
- Dashboard reflects confirmed operation.

Do not claim USDC if the current devnet program uses a different test mint; label the asset truthfully and align the final demo target.

## 7. Discovery scale guard test

The test should fail if implementation performs an unbounded scan.

Verify:

- search repository receives a finite limit;
- detailed profile reads do not exceed configured Top 20;
- paid verification calls do not exceed Top 3;
- candidate list stored once per run;
- query metrics logged;
- synthetic large dataset does not change application read count linearly with total collection size.

Exact cloud performance is environment-dependent; the invariant is bounded reads and indexed queries.

## 8. E2E scenarios

### E2E-1 happy path

```text
Creator onboard → publish
Brand onboard → start run
Top candidate selected
OFFER 250
COUNTER 320
COUNTER/ACCEPT 300
Agreement
Escrow confirmed
Evidence URL submitted
Verification passed
300 released
```

Assertions:

- same canonical IDs across both role views;
- at least one actual counter;
- one Agreement;
- one lock and one release;
- real signatures;
- private max/min not leaked.

### E2E-2 first candidate rejects

- candidate 1 blocked/policy rejection;
- reservation released;
- candidate 2 negotiated;
- run completes one Agreement;
- candidate outcomes replay correctly.

### E2E-3 exhausted

- three candidates reject/expire;
- no Agreement/escrow;
- clear Dashboard result;
- rerun possible after condition change.

### E2E-4 creator offline

- creator publishes and closes browser;
- Brand starts later;
- negotiation completes;
- creator logs in and sees result/replay.

### E2E-5 concurrency

- two Brand runs attempt same creator;
- one reservation wins in MVP;
- other moves to next candidate;
- no double active collaboration.

### E2E-6 partial infrastructure failure

- transaction submitted, API response interrupted;
- reconciliation finds signature;
- no duplicate transaction;
- final state converges.

## 9. Acceptance criteria by experience

### Onboarding

- one card per decision;
- real save/resume;
- unknown data shown honestly;
- confirmed moods drive matching;
- completion does not auto-start Brand run;
- Creator completion can publish Agent.

### Dashboard

- Brand action is start run;
- Creator action is accepting-offers state;
- active and historical results persist;
- money state comes from canonical escrow/settlement;
- no fake activity timeline.

### Live Run

- candidate stage based on real candidate snapshots;
- A2A bubbles based on real Messages/events;
- knot animation after Artifact/Agreement;
- close/reopen safe;
- Technical Proof accurate.

## 10. Three-minute demo script

### 0:00–0:25 — problem and product

> AI agents can already buy APIs. They still cannot safely contract with humans. KNOT fills the missing layer for human-service transactions in agentic commerce.

Show Brand and Creator agents already configured or rapidly show the URL/card flow.

### 0:25–0:55 — creator availability

Creator window:

- profile/mood summary;
- private policy;
- `제안 받기` published;
- explain it works while browser is closed.

### 0:55–1:30 — Brand starts Match Run

Brand window:

- product/mood/budget summary;
- `탐색·협상 시작`;
- indexed discovery;
- optional paid verification receipt;
- selected candidate reason.

### 1:30–2:10 — A2A

Two windows:

- OFFER;
- COUNTER;
- final ACCEPT;
- private max/min visible only to owner;
- Artifact/Agreement and knot animation.

### 2:10–2:35 — escrow

- actual devnet lock operation;
- signature/Explorer;
- Creator sees `에스크로 확보 완료`.

### 2:35–2:55 — evidence and settlement

- submit prepared content URL;
- Gemini observations;
- deterministic pass;
- actual release signature.

### 2:55–3:00 — proof

Open Technical Proof:

- Match Run;
- A2A Task/Messages;
- Agreement hash;
- lock/release receipts.

## 11. Final release gate

- lint/typecheck/tests/build green;
- no secret scan findings;
- no final happy-path `SIMULATED` state;
- live URL smoke passed;
- README reproducible;
- architecture diagram updated;
- implementation status evidence attached;
- known limitations truthful.
