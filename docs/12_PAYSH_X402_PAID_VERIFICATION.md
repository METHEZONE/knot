# pay.sh / x402 Paid Verification (Updated with Mentoring Feedback)

## 1. Product purpose

pay.sh/x402 is used for an Agent to buy external verification APIs. It has TWO distinct use cases:

```text
Use Case 1: Creator Authenticity Verification (Discovery Phase)
→ Nansen/HypeAuditor API
→ ~$0.10 USDC per call
→ Filters fake influencers (bot_percentage > 25%)

Use Case 2: Content Quality Verification (Evidence Phase)
→ Brandwatch API
→ ~$0.50 USDC per call
→ Validates brand mention, sentiment, quality

Promotion Escrow
= human service compensation (separate ledger)
```

The UI and code must keep these ledgers and terms separate.

**Key Distinction**: pay.sh is for **Agent operational costs** (buying external APIs), NOT for creator compensation (which uses Solana escrow).

## 2. Triggers

### 2.1 Creator Verification Trigger (Discovery)

Triggered when:
- Discovery finds creator candidates
- `PAYSH_CREATOR_VERIFICATION_ENABLED=true` (default)
- Budget allows ($0.10 per candidate)
- Top 20 candidates need authenticity check

### 2.2 Content Verification Trigger (Evidence)

Triggered when:
- Creator submits content URL
- `PAYSH_CONTENT_VERIFICATION_ENABLED=true` (default)
- Budget allows ($0.50 per content)
- Brand keywords extracted from terms

Both use sandbox mode by default (`PAYSH_MODE=sandbox`).

## 3. Reasoning loop

```text
candidate scores are close / confidence low
→ inspect allowlisted tool catalog
→ get quote/payment requirement
→ Policy Engine checks per-run and daily spend caps
→ Agent wallet pays
→ API result returned
→ structured result mapped to candidate score/evidence
→ receipt and effect recorded
```

## 4. Receipt

```json
{
  "receiptId": "receipt-001",
  "matchRunId": "run-001",
  "candidateId": "creator-001",
  "purpose": "CANDIDATE_VERIFICATION",
  "provider": "...",
  "toolId": "...",
  "protocol": "X402",
  "network": "SOLANA_DEVNET_OR_SANDBOX",
  "amountUsdc": 0.02,
  "status": "CONFIRMED",
  "paymentReference": "...",
  "resultDigest": "sha256:...",
  "scoreImpact": {
    "reliabilityFitBefore": 0.7,
    "reliabilityFitAfter": 0.82
  },
  "createdAt": "timestamp"
}
```

Do not display a blockchain transaction if the used mode/protocol produces a different receipt type. Reflect the actual implementation.

## 5. UI events

Success:

```text
후보 검증 API를 사용했어요.
0.02 USDC · 결제 완료
```

Skipped:

```text
무료 정보만으로 후보를 결정했어요.
```

Failure with permitted continuation:

```text
유료 검증을 완료하지 못해 공개 정보만 사용했어요.
```

No silent fallback.

## 6. Security and authority

- allowlisted providers and endpoints;
- fixed maximum response size/time;
- no arbitrary URL/tool selected from model output;
- quote validation;
- per-call, per-run and daily caps;
- idempotency;
- no key/token in prompt or logs;
- sandbox/local mode for development;
- actual configured mode clearly shown.

## 7. P0/P1 treatment

The core product must work without paid verification using confirmed internal data. For hackathon scoring, one real paid verification call is strongly preferred when the current pay.sh environment is stable. It must not block the entire creator negotiation demo if the external provider is unavailable; the fallback policy must be explicit and visible.

## 8. Implementation

### 8.1 Code Location

```python
# backend/libs/payments/paysh.py
from libs.payments import verify_creator, verify_content

# Creator verification
receipt = verify_creator(
    profile_url="https://instagram.com/creator_handle",
    sandbox=True,  # or False for real API
    max_price_usdc=0.10,
    provider="nansen",
)
# Returns: bot_percentage, engagement_quality, follower_count

# Content verification
receipt = verify_content(
    content_url="https://instagram.com/p/abc123",
    brand_keywords=["product_name", "brand"],
    sandbox=True,
    max_price_usdc=0.50,
)
# Returns: sentiment_score, brand_mention_found, estimated_reach, quality_score
```

### 8.2 Integration Points

**Discovery Flow** (`backend/libs/agents/discovery.py`):
```python
verified_candidates = verify_candidates(
    detailed=detailed_candidates,
    sandbox=(settings.paysh_mode == "sandbox"),
    bot_threshold=0.25,
)
# Filters candidates with bot_percentage > 25%
```

**Evidence Verification** (`backend/apps/api/routes.py`):
```python
def _evidence_observations(...):
    if settings.paysh_content_verification_enabled:
        receipt = verify_content(
            content_url=url,
            brand_keywords=extract_keywords(terms),
            sandbox=(settings.paysh_mode == "sandbox"),
        )
        # Uses verification result for brand_mention, quality checks
```

## 9. Tests

**Sandbox Mode** (`backend/tests/test_paysh_sandbox.py`):
- `test_sandbox_creator_verification()` - deterministic fake data
- `test_sandbox_content_verification()` - simulated analysis
- `test_sandbox_creator_verification_deterministic()` - same URL → same result

**Live Mode Checks**:
- cap exceeded blocks payment;
- duplicate request does not double pay;
- tool quote changes are revalidated;
- external failure follows configured continue/stop policy;
- receipt belongs to current operation;
- result cannot inject arbitrary ranking weight;
- fake receipt is impossible in live mode.
