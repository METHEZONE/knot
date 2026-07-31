# Matching, Discovery and Ranking Specification

## 1. Boundary

Matching belongs to the Brand Agent/application layer. A2A begins only after a specific Creator Agent is selected and reserved.

```text
Discovery ≠ A2A
A2A = communication with selected Agent
```

## 2. Inputs

### Promotion query

```json
{
  "promotionId": "promotion-001",
  "productProfileId": "product-profile-001",
  "categoryKeys": ["beauty", "skincare"],
  "desiredMoodIds": ["clean_minimal", "natural_wellness"],
  "audienceTags": ["20s_30s", "daily_skincare"],
  "requiredFormat": "REEL",
  "targetAmountUsdc": 250,
  "maxAmountUsdc": 350,
  "deadline": "2026-08-10T14:59:59Z",
  "usageRights": "ORGANIC_ONLY",
  "languageKeys": ["ko"],
  "countryCodes": ["KR"],
  "verificationSpendCapUsdc": 0.5,
  "queryEmbedding": "vector",
  "taxonomyVersion": 1,
  "embeddingVersion": 2
}
```

`maxAmountUsdc` is private and must not appear in Creator-facing requests or public event copy.

### Discovery candidate projection

Only read-optimized, owner-approved fields plus safe platform summaries.

## 3. Stage 0 — run guards

Before retrieval:

- authenticated Brand owns the Promotion;
- Promotion is complete and not already fulfilled;
- no active Match Run exists for the same Promotion;
- Brand Agent is active;
- wallet/authority prerequisites are truthful;
- idempotency key is valid;
- maximum amount and verification cap are positive and internally consistent.

## 4. Stage 1 — hard filters

The query must use supported indexes. It must not fetch all documents and filter in application memory.

Public/index filters:

```text
agentStatus == PUBLISHED
acceptingOffers == true
availability in [AVAILABLE, NEGOTIATING_ALLOWED]
capacityAvailable == true
formatKeys array-contains requiredFormat
country/language if required
nextAvailableAt <= latest feasible start
```

Private policy eligibility is evaluated through a server-side method:

```text
checkCandidateEligibility(promotion, creatorAgentPolicySnapshot)
→ ELIGIBLE | INELIGIBLE + internal reasonCode
```

Brand receives only a safe reason category when needed.

## 5. Stage 2 — vector retrieval

Query the discovery index for nearest neighbors to the Promotion embedding after supported prefilters.

MVP:

```text
limit = 100
```

The embedding represents confirmed product attributes, desired mood, audience, category, and content intent. It excludes private maximum budget.

Distance is converted to a normalized semantic fit in `[0, 1]` using a versioned function. Store raw distance and normalized score in the candidate snapshot.

## 6. Stage 3 — deterministic ranking

### Score components

```text
semanticMoodFit      0..1 × 35
categoryAudienceFit  0..1 × 20
formatFit            0..1 × 15
scheduleFit          0..1 × 10
coarseBudgetFit      0..1 × 10
reliabilityFit       0..1 × 10
```

### Component guidance

#### semanticMoodFit

- vector similarity;
- exact desired mood overlap bonus capped inside the component;
- no LLM free-form final score.

#### categoryAudienceFit

- controlled category overlap;
- audience tag overlap;
- primary category match scores higher than secondary.

#### formatFit

- 1.0 if requested format is explicitly confirmed;
- 0.7 if format is supported but not primary;
- hard fail if unsupported.

#### scheduleFit

- based on deadline slack beyond `minimumLeadDays`;
- hard fail if impossible;
- more slack yields higher score up to 1.0.

#### coarseBudgetFit

- use public/owner-approved rate band if available;
- if no public rate band exists, use neutral score and let negotiation discover fit;
- never infer or return the exact minimum.

#### reliabilityFit

- verified completed deals;
- completion rate;
- on-time rate;
- cancellation rate;
- use a minimum sample adjustment so a new creator is not unfairly assigned 0.

### Tie-breakers

1. higher final score;
2. higher semantic fit;
3. earlier next available date;
4. lower number of recent proposals to avoid starvation;
5. stable creator ID hash for deterministic final order.

## 7. Stage 4 — detail enrichment

Read full public profile projections for Top 20 only. Do not read private policies into the Brand UI layer. The internal matching service may read private policy only for eligibility and reservation.

## 8. Stage 5 — optional paid verification

Top 3 may be verified when all conditions hold:

```text
remainingVerificationCap > quotedPrice
AND (topScoreGap < configured threshold OR confidence < threshold)
AND tool is allowlisted
AND agent authority allows the call
```

The Agent records:

- tool/API identifier;
- quote;
- payment protocol;
- amount;
- receipt/transaction reference;
- result digest;
- score adjustment;
- whether the call changed selection.

Failure is explicit. Depending on policy, the run either continues with free signals or stops; no silent fallback.

## 9. Stage 6 — fresh availability and reservation

Before A2A:

- re-read current Agent status and capacity;
- run private eligibility again;
- create a short reservation lease in a Firestore transaction;
- save policy/profile version snapshots.

If reservation fails, move to the next ranked candidate without recomputing the full ranking.

## 10. Stage 7 — sequential A2A

For candidate rank 1..3:

```text
reserve
→ create Negotiation/context
→ send A2A OFFER
→ multi-turn negotiation
→ AGREED: stop Match Run and create Agreement
→ REJECTED/EXPIRED: release reservation and continue
→ retryable error: retry within policy
→ fatal error: mark candidate failed and continue or fail run according to error policy
```

## 11. Explainability

Store score components and safe evidence. Gemini may produce a short explanation from those facts:

```text
선정 이유
· 제품과 콘텐츠 무드가 가장 가까웠어요.
· 요청한 Reel 포맷을 지원해요.
· 마감 전에 제작 가능한 일정이에요.
```

Do not state hidden rate compatibility or blocked category details.

## 12. Query cost guardrails

- No `stream()`/unbounded collection reads for discovery.
- Every discovery query has a limit.
- Top K IDs are stored in Match Run candidate snapshots.
- Full profile reads are bounded to Top 20.
- Paid tools are bounded to Top 3 and spend cap.
- Index and embedding versions are attached to results.
- Repository interface exposes query metrics for tests.

## 13. Pseudocode

```python
async def execute_match_run(run_id: str) -> None:
    run = await runs.claim(run_id)
    promotion = await promotions.get_owned(run.promotion_id, run.brand_id)
    query = await query_builder.build(promotion)

    neighbors = await discovery.search(
        query=query,
        hard_filters=build_public_filters(query),
        limit=100,
    )

    candidates = []
    for neighbor in neighbors:
        eligibility = await policy.check_creator_eligibility(
            promotion=promotion,
            creator_agent_id=neighbor.creator_agent_id,
        )
        if not eligibility.allowed:
            continue
        score = ranker.score(query, neighbor)
        candidates.append(snapshot(neighbor, eligibility, score))

    ranked = deterministic_sort(candidates)[:20]
    ranked = await verifier.verify_top_candidates(run, ranked[:3], ranked)
    await runs.persist_candidates(run_id, ranked)

    for candidate in ranked[: run.max_candidates]:
        lease = await reservations.try_acquire(candidate.creator_agent_id, run_id)
        if not lease:
            await runs.record_skip(run_id, candidate, "RESERVATION_CONFLICT")
            continue
        outcome = await negotiate_via_a2a(run, promotion, candidate, lease)
        if outcome.agreed:
            await agreements.create_exactly_once(outcome.artifact)
            await runs.complete_agreed(run_id, outcome)
            return
        await reservations.release(lease)

    await runs.mark_exhausted(run_id)
```

## 14. Future scale

Maintain the interface:

```text
CreatorDiscoveryRepository.search(query, filters, limit)
```

MVP implementation may use Firestore vector search. Later implementation may use Vertex AI Vector Search without changing canonical Profile/Policy storage or Match Run logic.
