# Product Narrative and PRD

## 1. Problem

Agentic commerce has increasingly strong rails for machine-readable goods: an agent can discover an API, call it, pay, and receive a deterministic response. Human services are different. A service transaction requires:

- discovering a suitable human;
- understanding style and fit;
- negotiating price, deliverables, deadline, rights, and revisions;
- protecting both parties before work begins;
- verifying a non-standard result;
- settling only after the promised work is complete.

This is the missing transaction layer KNOT addresses.

## 2. Product statement

KNOT is an agent-native creator contracting and settlement network. A Brand Agent discovers a Creator Agent, both agents negotiate under private human-defined policies, a structured Agreement is created, and Solana USDC escrow is released after evidence verification.

## 3. Why creators first

Creator sponsorship is a strong initial human-service vertical because it is:

- negotiated rather than fixed-price;
- multi-dimensional: price, format, deadline, rights, revision scope;
- digitally provable through URLs and content observations;
- trust-sensitive for both payer and worker;
- easy to demonstrate as an end-to-end agentic transaction.

## 4. Primary users

### Brand Human

- provides a product URL;
- confirms Gemini-extracted product attributes and mood;
- sets target and maximum budget, deadline, content format, rights, verification spend cap, and wallet authority;
- starts a Match Run;
- supervises results rather than manually selecting and messaging creators.

### Brand Agent

- converts confirmed product intent into search constraints;
- retrieves and ranks Creator Agents;
- optionally purchases top-candidate verification data;
- reserves a candidate and negotiates through A2A;
- creates one funded Agreement per Match Run;
- initiates escrow under deterministic authority;
- records every action as a canonical event.

### Creator Human

- provides an Instagram or public profile URL;
- confirms the extracted profile and mood;
- privately sets target/minimum compensation, lead time, rights, formats, and blocked categories;
- publishes the Creator Agent;
- returns later to see negotiation and funded collaboration results;
- submits the final content URL.

### Creator Agent

- remains asynchronously callable while published;
- checks incoming terms against private policy and capacity;
- accepts, counters, or rejects without revealing exact private thresholds;
- emits A2A Messages and a final Artifact;
- receives settlement to the configured creator wallet.

### KNOT Platform

- identity, ownership and role authorization;
- creator discovery index and Agent Registry;
- durable Match Run orchestration;
- A2A routing and task storage;
- Gemini structured analysis;
- deterministic policy enforcement;
- Agreement, escrow, evidence and settlement records;
- real-time user projections and audit proof.

## 5. Core promise

```text
Paste a URL.
Confirm what the agent understood.
Set boundaries one card at a time.
Start or publish the agent.
Watch the agents form a knot.
See the money settle from the same canonical transaction history.
```

## 6. Golden paths

### Brand

```text
Product URL
→ Gemini extraction
→ card confirmations
→ Dashboard
→ Match Run
→ indexed creator discovery
→ Creator Agent selection
→ A2A negotiation
→ Agreement
→ escrow
→ evidence verification
→ settlement
```

### Creator

```text
Profile URL
→ Gemini extraction
→ card confirmations
→ publish Agent
→ asynchronous offer
→ policy-based A2A negotiation
→ funded Agreement
→ content URL submission
→ verification
→ automatic settlement
```

## 7. Functional requirements

### FR-1 URL-assisted onboarding

- Product and creator profile URLs are analyzed by a server-side Gemini workflow.
- Output must follow a versioned structured schema.
- Users confirm or edit the result before it becomes matching data.
- Inaccessible or low-confidence fields are marked unknown; metrics are never invented.

### FR-2 Creator Agent publication

- The creator can publish, pause, resume, and inspect the Agent.
- Published status, offer acceptance, capacity, and runtime activity are distinct states.
- Publishing does not require the browser to remain open.

### FR-3 Promotion and Match Run

- A Brand creates one Promotion through the onboarding/card deck.
- Starting the Agent creates an idempotent Match Run.
- One active Match Run per Promotion is allowed in the MVP.
- The run aims for one funded Agreement and may try at most three candidates sequentially.

### FR-4 Scalable discovery

- Discovery searches only confirmed and published Creator Agents.
- It uses indexed fields and vector retrieval; no collection scan is permitted.
- Private policies are evaluated server-side and never returned to the Brand.
- Ranking is deterministic and auditable.

### FR-5 Actual A2A negotiation

- Each candidate negotiation creates or continues one official A2A Task.
- OFFER, COUNTER, ACCEPT, REJECT, and ESCALATE are KNOT domain payload types inside A2A Parts.
- A final Agreement or rejection result is an Artifact.
- At least one counteroffer happy path must be testable.

### FR-6 Durable live run and replay

- The run continues after the user leaves the page.
- The UI subscribes to canonical events or polls real Task state.
- The replay uses stored events, not regenerated text.
- Both role views derive from the same event IDs and timestamps.

### FR-7 Agreement and escrow

- Agreement creation is exactly-once.
- A deterministic terms hash binds the A2A Artifact to the on-chain operation.
- The Brand Agent may execute devnet escrow only under a verified authority and spend cap.
- No LLM output directly authorizes payment.

### FR-8 Evidence and settlement

- The Creator submits a normalized supported content URL.
- Gemini produces observations; deterministic rules make the release decision.
- MVP has one release milestone: 100% after successful verification.
- Confirmed transaction signatures and Explorer links are stored and displayed.

## 8. Non-functional requirements

- No silent mock fallback in live mode.
- No private policy values in counterparty responses.
- All write operations are ownership-checked and idempotent.
- Match and negotiation operations are observable with correlation IDs.
- Existing public API behavior remains compatible.
- UI changes reuse current visual components and motion language.
- Services remain deployable on Google Cloud.

## 9. Success criteria

Product:

- onboarding can be completed without a long form;
- a creator can leave after publishing the Agent and still receive an Agreement;
- a Brand can start one run and receive either one funded Agreement or a clear exhausted result;
- no unbounded creator collection read occurs;
- at least one real A2A counteroffer occurs;
- duplicate Agreement, escrow lock, and settlement count is zero.

Hackathon demonstration:

- judges understand the human-service transaction gap within 30 seconds;
- candidate discovery and negotiation visibly happen without manual creator selection;
- Gemini analysis is visible and grounded;
- actual A2A IDs/events are inspectable;
- actual devnet signatures are inspectable;
- the UI clearly distinguishes user-friendly narrative from technical proof.

## 10. Revenue model

Initial model:

- success fee on funded/settled Agreements;
- optional paid verification pass-through plus platform margin;
- later subscription for higher Agent capacity, analytics, and advanced policy.

No token is required for the MVP business model.
