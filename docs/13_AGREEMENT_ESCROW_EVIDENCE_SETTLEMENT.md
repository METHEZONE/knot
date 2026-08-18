# Agreement, Escrow, Evidence and Settlement

## 1. Agreement creation

Agreement is created from a final A2A Artifact after deterministic canonicalization.

```text
A2A Artifact
→ validate ownership/task/terminal result
→ normalize terms
→ compute deterministic termsHash
→ create Agreement exactly once
```

Canonical term fields:

- parties and Agent IDs;
- Promotion and Negotiation IDs;
- compensation amount/asset;
- deliverable format/count;
- deadline/timezone;
- usage rights;
- revision limit if used;
- evidence requirements;
- settlement condition;
- schema/version.

## 2. Deterministic terms hash

- Serialize a canonical JSON representation.
- Stable key ordering and normalized numeric/date formats.
- Exclude mutable metadata and UI text.
- Hash algorithm/version stored with value.
- Agreement ID, Artifact ID and on-chain operation reference the same hash.

A mismatch is a hard failure.

## 3. Settlement Schedule (Updated with Mentoring Feedback)

**3-Stage Milestone System** (환불 방지 + 분쟁 해결):

```python
milestones = [
    Milestone(id="contract", trigger="contractSigned", releasePct=30),
    Milestone(id="verification", trigger="contentVerified", releasePct=50),
    Milestone(id="timelock", trigger="timelockExpired", releasePct=20),
]
```

### Purpose

| Milestone | % | Trigger | Purpose |
|-----------|---|---------|---------|
| Contract | 30% | Agreement 생성 시 | 브랜드 환불 방지, 크리에이터 최소 보장 |
| Verification | 50% | pay.sh 콘텐츠 검증 통과 | 크리에이터 80% 확보 |
| Timelock | 20% | 72시간 경과 + 분쟁 없음 | 이의 제기 기간 제공 |

### Rationale

**Problem**: 브랜드가 콘텐츠 받고 일방적 환불 요구
**Solution**:
- 계약 체결 시 30% 즉시 릴리즈 → 브랜드 환불 불가
- 검증 통과 시 50% 추가 릴리즈 → 크리에이터 80% 확보
- 72시간 대기 후 20% 최종 릴리즈 → 분쟁 제기 기간

**Note**: 기존 단일 마일스톤(100%) 방식은 deprecated.

## 4. Escrow authority

The Agent can lock funds only when all are true:

- Agreement exists and belongs to the Brand;
- terms hash matches;
- amount equals Agreement compensation;
- asset/network/program/mint are allowlisted;
- Brand Agent authority permits escrow;
- per-run/daily spend cap is sufficient;
- wallet balance is sufficient;
- no existing confirmed lock;
- Web3 Gateway validates idempotency.

Gemini does not authorize this operation.

## 5. Actual wallet architecture

Codex must inspect current implementation and document one truthful mode:

### Delegated/pre-funded Agent wallet

- Brand funds a controlled devnet wallet during setup;
- server-side signer is protected by Secret Manager/KMS-equivalent service architecture;
- authority and spend caps limit actions;
- Agent can submit without a human click at transaction time.

### User wallet approval

- user signs the lock interactively;
- product must not call it autonomous settlement;
- the UI shows approval-required state.

Hackathon target is the first mode on devnet if the repository already supports safe delegated signing.

## 6. Escrow state

```text
NOT_STARTED
PREPARING
SUBMITTED
CONFIRMED
RELEASE_SUBMITTED
RELEASED
FAILED
CANCELED
```

Keep operation state separate from Aggregate state.

## 7. Operation receipt

```json
{
  "operationId": "op-lock-001",
  "operationType": "ESCROW_LOCK",
  "network": "SOLANA_DEVNET",
  "asset": "USDC",
  "amountUsdc": 300,
  "status": "CONFIRMED",
  "signature": "...",
  "explorerUrl": "...",
  "submittedAt": "timestamp",
  "confirmedAt": "timestamp",
  "errorCode": null
}
```

Never display a placeholder or EVM-style `0x...` as a Solana signature.

## 8. Evidence submission

Creator input:

- supported content URL;
- optional note;
- optional screenshot/file only if existing storage pipeline supports it.

Validation:

- authenticated creator owns Agreement;
- Agreement escrow is funded;
- URL scheme/domain is supported;
- URL normalized;
- duplicate handling;
- deadline/cutoff;
- safe fetch rules.

## 9. Verification

```text
Evidence submitted
→ secure fetch
→ Gemini observations
→ deterministic gate
→ VERIFIED / REVISION_REQUIRED / MANUAL_REVIEW / REJECTED
```

MVP rule examples:

- content is accessible;
- expected content type is observed;
- product/brand mention is observed;
- required disclosure is present if configured;
- prohibited claims are absent or not confidently detected;
- submission timing is valid.

Low confidence does not automatically fail or release; it moves to review.

## 10. Settlement release

```text
Evidence VERIFIED
→ load Agreement and Escrow
→ revalidate termsHash and amount
→ create release operation idempotently
→ submit transaction
→ confirm
→ update Escrow and Settlement
→ update reputation summary/index
→ emit Dashboard events
```

The creator receives funds directly at the configured settlement wallet in the automatic-transfer architecture. Do not show a `정산 받기` button if no claim action exists.

## 11. Failure recovery

### Lock submitted but API timed out

- query by known signature/operation ID;
- do not submit a second lock blindly.

### On-chain confirmed, Firestore update failed

- reconciler writes confirmed receipt and advances state.

### Release failed

- milestone remains unreleased;
- bounded retry when retryable;
- no second payout for a confirmed release.

### Evidence changed after verification

MVP does not silently re-open a settled Agreement. Record the source digest used at verification.

## 12. Dispute System (New)

### 12.1 Dispute Triggers

Either party can raise a dispute:
- Brand: Content quality issues, missing disclosure, late delivery
- Creator: Payment delays, unfair rejection

### 12.2 Dispute Flow

```text
POST /disputes
→ Freeze milestone (frozen=true)
→ If amount < $100 && Gemini available:
  → Auto-resolve with Gemini
→ Else:
  → Manual review required
→ POST /disputes/{id}:resolve
→ Unfreeze milestone
```

### 12.3 Implementation

```python
# Raise dispute
POST /disputes
{
  "agreementId": "agreement-123",
  "milestoneId": "verification",
  "reason": "CONTENT_QUALITY",
  "description": "Brand mention missing",
  "evidenceUrl": "optional screenshot"
}

# Auto-resolution (< $100)
if dispute_amount < 100.0 and settings.gemini_mode != "off":
    resolution = _auto_resolve_dispute_with_gemini(
        dispute, agreement, milestone
    )
    # Returns: decision ("brand" | "creator" | "partial")
```

## 13. Timelock System (New)

### 13.1 Purpose

72-hour dispute window after content verification before final 20% release.

### 13.2 Flow

```text
verification milestone released
→ _set_timelock_for_next_milestone()
→ timelock.timelockExpiresAt = now + 72h
→ timelock.status = "TIMELOCK_ACTIVE"

[72 hours later]

POST /milestones/timelock:check
→ Check all active timelocks
→ If expired && no active disputes:
  → Auto-release timelock milestone
→ Else:
  → Keep frozen
```

### 13.3 Implementation

```python
# Set timelock (called after verification release)
def _set_timelock_for_next_milestone(
    repository, agreement_id, released_milestone_id, released_at
):
    if released_milestone_id == "verification":
        timelock_expires_at = released_at + timedelta(hours=72)
        # Update timelock milestone with expiry

# Check and release (periodic job)
POST /milestones/timelock:check
→ Scans all TIMELOCK_ACTIVE milestones
→ Releases expired ones with no disputes
```

## 14. Amount-Based Automation (New)

### 14.1 Policy Levels

| Amount | Level | Behavior |
|--------|-------|----------|
| < $100 | FULL_AUTO | 완전 자동, 사람 개입 없음 |
| $100-500 | HUMAN_REVIEW | 검토 필요, 수동 승인 |
| >= $500 | HUMAN_SIGNATURE | 사람 서명 필수 |

### 14.2 Implementation

```python
def _determine_automation_level(amount_usdc: float) -> AutomationLevel:
    if amount_usdc < 100.0:
        return AutomationLevel.FULL_AUTO
    elif amount_usdc < 500.0:
        return AutomationLevel.HUMAN_REVIEW
    else:
        return AutomationLevel.HUMAN_SIGNATURE

# Check before auto-release
automation_level = _determine_automation_level(total_amount_usdc)
if automation_level != AutomationLevel.FULL_AUTO:
    raise HUMAN_APPROVAL_REQUIRED
```

## 15. Tests

**Existing**:
- canonical hash stable across equivalent inputs;
- duplicate Artifact creates one Agreement;
- duplicate lock/release returns same operation;
- amount/hash/owner mismatch rejected;
- actual local validator program tests;
- devnet smoke produces real signature;
- evidence ambiguity does not pay;
- settlement updates both role projections from same canonical event.

**New** (3-stage milestone):
- 30% released on agreement creation;
- 50% released after content verification;
- 20% released after 72h timelock expiration;
- dispute freezes milestone;
- timelock prevents release during dispute;
- automation level blocks auto-release for high amounts.
