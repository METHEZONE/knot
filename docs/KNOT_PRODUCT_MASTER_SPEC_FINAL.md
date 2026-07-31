# KNOT Product & Implementation Master Specification — Final MVP Baseline

> **Status:** Final product baseline for the Google Cloud × Solana AI Agentic Hackathon  
> **Updated:** 2026-07-31  
> **Scope:** Existing KNOT repository refactor; preserve the current visual design and working server/API behavior  
> **Source of truth:** This file, then `docs/00_DOCUMENT_INDEX.md`

## 1. Product thesis

> **KNOT fills the missing layer for human-service transactions in agentic commerce.**

AI agents can already search, call APIs, and pay for machine-readable resources. They still struggle to contract with humans because human services require discovery, negotiation, deliverable definitions, proof of completion, and conditional settlement.

KNOT turns creator sponsorship into an agent-executable transaction:

```text
Human sets intent and boundaries
→ Brand Agent discovers a suitable Creator Agent
→ Agents negotiate through A2A
→ Agreement is generated
→ Brand funds Solana USDC escrow
→ Creator submits content evidence
→ Evidence is verified
→ Escrow is released
```

The first vertical is creator sponsorship, but the long-term category is **Agent-native Human Service Commerce**.

## 2. Final MVP object model

```text
User
└─ Role Profile
   ├─ Public Profile
   ├─ Private Agent Policy
   ├─ Agent Authority
   └─ Agent

Brand
└─ Promotion
   └─ Match Run
      ├─ Ranked Candidate Snapshots
      └─ Negotiation (one per Brand–Creator pair)
         └─ Agreement
            └─ Escrow
               ├─ Evidence
               └─ Settlement
```

## 3. Final run semantics

### 3.1 Brand Agent

A Brand Agent run is **not** “one negotiation with one creator.”

```text
One Match Run
= one attempt to produce one funded Agreement
```

MVP defaults:

```text
targetAgreementCount        = 1
maxCandidatesPerRun         = 3
maxRoundsPerNegotiation     = 3
negotiationMode             = SEQUENTIAL
```

The Brand Agent ranks candidates and negotiates with one Creator Agent at a time. If candidate 1 rejects or expires, the run advances to candidate 2. The first successful Agreement ends candidate search. If all candidates fail, the run ends as `EXHAUSTED`.

### 3.2 Creator Agent

A Creator Agent does not require its owner to be online. The creator publishes an asynchronously callable agent:

```text
agentStatus      = PUBLISHED
acceptingOffers  = true
availability     = AVAILABLE
```

The runtime is request-driven. It loads the creator’s profile, policy, authority, and current capacity when an A2A request arrives. “Always available” does not mean a dedicated model or server runs continuously.

### 3.3 One active pairwise negotiation

Each Brand–Creator pair has one A2A negotiation Task. Multiple rounds occur inside that Task. A Match Run may contain multiple sequential Tasks, but only one active candidate negotiation at a time in the MVP.

## 4. Final matching approach

Matching is a staged retrieval and ranking pipeline. It never reads every creator profile into application memory and never asks Gemini to choose freely from the entire database.

```text
Eligible Creator Agent Registry
→ indexed hard filters
→ vector semantic retrieval
→ deterministic ranking
→ optional paid verification for top candidates
→ concurrency reservation
→ A2A negotiation
```

### Hard eligibility gates

- Creator Agent is `PUBLISHED` and `acceptingOffers=true`.
- Capacity is available and no conflicting reservation exists.
- Requested content format is supported.
- Category is allowed. Private blocked categories are checked server-side and never revealed.
- Deadline is feasible using `nextAvailableAt` and private `minimumLeadDays`.
- Language/region constraints are satisfied when specified.
- Coarse public rate band is compatible when the creator opted to publish one.
- Account/agent is not suspended and required profile fields are confirmed.

### Ranking score

Hard failures are excluded first. Remaining candidates receive a deterministic score:

```text
semanticMoodFit     35
categoryAudienceFit 20
formatFit           15
scheduleFit         10
coarseBudgetFit     10
reliabilityFit      10
----------------------
total              100
```

Weights are configuration, not prompt text. Gemini can extract attributes and write a public explanation, but it cannot place an ineligible candidate above the deterministic ranking.

### Search scale

```text
All registered creators
→ indexed eligible pool
→ semantic Top 100
→ deterministic Top 20
→ optional paid verification Top 3
→ negotiate sequentially
```

## 5. Storage boundaries

### Source of truth

- `creatorProfiles`: confirmed full profile.
- `agentPolicies`: exact private minimum, blocked categories, rights, lead time.
- `agentAuthorities`: actions and spend limits the agent may execute.
- `agents` / Agent Registry: runtime identity and AgentCard metadata.

### Read-optimized discovery index

- `creatorDiscoveryProfiles`: compact, queryable, owner-approved matching projection.
- Contains normalized categories, formats, mood IDs, language, region, public rate band, availability summary, reliability summary, embedding, and version fields.
- Does not contain exact minimum rate, private notes, full social history, raw Gemini output, or wallet secrets.

### Run snapshots

Every Match Run stores candidate IDs, score components, profile/index versions, verification receipts, reservation result, and final outcome. Replays use stored events rather than regenerating a fictional conversation.

## 6. Final role flows

### Brand

```text
Login
→ card-deck onboarding
→ product URL analysis by Gemini
→ confirm product and mood
→ choose format, target/max budget, deadline, rights, paid-verification cap
→ connect or confirm agent payment authority
→ Dashboard
→ Start discovery & negotiation
→ live candidate-selection and A2A view
→ Agreement
→ autonomous devnet USDC escrow within authority
→ creator evidence
→ verification
→ settlement result on Dashboard
```

### Creator

```text
Login
→ card-deck onboarding
→ Instagram/public profile URL analysis by Gemini
→ confirm profile and mood
→ set formats, target/minimum rate, lead time, rights, blocked categories
→ connect settlement wallet
→ publish Creator Agent and accept offers
→ Dashboard
→ asynchronous A2A offer handling
→ view live run or replay later
→ see funded Agreement
→ submit content URL
→ verification
→ automatic USDC receipt
```

## 7. UX rules

1. Preserve the current KNOT visual design, typography, card language, illustrations, and motion style.
2. Onboarding is a story-based card deck: one question or confirmation per card.
3. Candidate selection is agent-owned. Users do not browse a candidate marketplace in the MVP.
4. Brand Dashboard is an Agent Control Room. Its primary action is `탐색·협상 시작`.
5. Creator Dashboard exposes a persistent `제안 받기` state, not a one-shot run button.
6. The live Agent Run screen is driven by real stored events, A2A Messages, Task states, receipts, and transactions—not timers.
7. Closing the live screen never cancels a run. Returning to Dashboard shows the current state and persisted result.
8. Private thresholds are visible only to their owner.
9. Technical proof is available in a collapsible panel without overwhelming the normal UX.

## 8. Real-agent requirements

The production-like path must include:

- real authenticated users and ownership checks;
- durable asynchronous Match Run execution;
- real profile/product Gemini structured output where credentials are configured;
- deterministic matching and policy checks;
- actual A2A HTTP+JSON Message/Task/Artifact exchange;
- persisted event stream and replay;
- exactly-once Agreement creation with deterministic `termsHash`;
- actual Solana localnet tests and devnet escrow/settlement smoke path;
- real transaction signatures and Explorer URLs only after confirmation;
- explicit `DEMO_MODE` for fixtures; no silent production fallback.

## 9. Existing-system preservation rules

- Audit the repository before code changes.
- Preserve the current deployed server, authentication, API contracts, A2A, Agreement, escrow, settlement, and deployment configuration unless a documented defect requires an additive change.
- Do not merge a UI branch wholesale into a stable backend branch.
- Preserve existing public endpoints. Add versioned or compatibility endpoints instead of deleting or renaming.
- Use frontend ViewModels/Adapters to connect the existing UI to live APIs.
- Use additive Firestore fields/collections and migration-safe dual-read logic where required.
- Do not introduce broad unrelated refactors.
- Do not push directly to `main`.

## 10. MVP boundaries

### P0

- Card-deck onboarding for both roles.
- User-confirmed Gemini profile/product analysis.
- Creator Agent publication and asynchronous availability.
- Brand Match Run with indexed matching and sequential fallback candidates.
- Real A2A negotiation with at least one counteroffer path.
- Agent-run live view and replay.
- Agreement and terms hash.
- Devnet escrow and one 100% post-verification release.
- Evidence URL verification.
- Real Dashboard summaries and transaction proof.
- Cloud Run deployment and reproducible README.

### P1

- One real pay.sh/x402 paid candidate-verification call when spend policy allows.
- Multiple concurrent creator capacities.
- scheduled social refresh;
- advanced performance-based payout;
- multiple creators per Promotion;
- richer reputation graph.

### Excluded

- mainnet;
- fiat/card settlement;
- broad open marketplace;
- multiple milestones in the MVP;
- calendar integration;
- complex dispute/arbitration;
- no-show deposit rules;
- DAO/token incentives;
- pretending inaccessible Instagram metrics were collected.

## 11. Definition of done

A capability is complete only when UI, API, Firestore, external/A2A/on-chain behavior, and E2E are all evidenced. “Code exists” is not “working.”

Final happy path:

```text
Creator publishes agent
→ Brand starts Match Run
→ candidates retrieved without collection scan
→ one creator reserved
→ real A2A OFFER/COUNTER/ACCEPT
→ one Agreement created
→ USDC escrow confirmed
→ content URL submitted
→ verification passes
→ USDC release confirmed
→ both Dashboards and replay show the same canonical events
```
