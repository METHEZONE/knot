# Dispute and Timelock System

Updated: 2026-08-19 (Integrated with main branch 2-stage milestone system)

## 1. Overview

The Dispute and Timelock system provides a dispute resolution mechanism for creator-brand agreements. This system was implemented based on mentoring feedback to ensure fair resolution and prevent payment disputes.

**Integration Note**: This system works with the main branch's 2-stage milestone structure (20% deposit + 80% content) and adds dispute handling + 72-hour timelock protection.

## 2. Purpose

### Problems Addressed

1. **Payment Disputes**: Either party may have concerns about agreement fulfillment
2. **Creator Payment Delays**: Creators had no recourse for delayed or withheld payments
3. **Brand Quality Concerns**: Brands need mechanism to address content issues
4. **Trust Gap**: No mechanism to handle disagreements between parties

### Solutions

1. **2-Stage Milestones** (from main): 20% deposit on acceptance + 80% on content verification
2. **Dispute System**: Allow either party to raise concerns
3. **72-Hour Timelock**: Provide dispute window on content milestone before final 80% release
4. **Auto-Resolution**: Use Gemini for small-amount disputes

---

## 3. Dispute System

### 3.1 Dispute Creation

**Endpoint**: `POST /disputes`

**Request**:
```json
{
  "agreementId": "agreement-123",
  "milestoneId": "verification",
  "reason": "CONTENT_QUALITY" | "BRAND_MISMATCH" | "MISSING_DISCLOSURE" | "LATE_DELIVERY" | "PROHIBITED_CLAIMS" | "OTHER",
  "description": "Detailed explanation (10-1000 chars)",
  "evidenceUrl": "https://screenshot.example.com/proof.png" (optional)
}
```

**Response**:
```json
{
  "dispute": {
    "disputeId": "dispute-uuid",
    "agreementId": "agreement-123",
    "milestoneId": "verification",
    "raisedBy": "brand" | "creator",
    "reason": "CONTENT_QUALITY",
    "description": "Brand mention is missing from post",
    "evidenceUrl": "...",
    "status": "OPEN" | "UNDER_REVIEW" | "RESOLVED_CREATOR" | "RESOLVED_BRAND" | "RESOLVED_PARTIAL" | "REJECTED",
    "amountUsdc": 400.0,
    "resolution": null,
    "resolvedAt": null,
    "autoResolved": false,
    "createdAt": "2026-08-19T12:00:00Z",
    "updatedAt": "2026-08-19T12:00:00Z"
  }
}
```

### 3.2 Dispute Effects

When a dispute is raised:

1. **Milestone Freeze**: The disputed milestone is automatically frozen
   ```json
   {
     "frozen": true,
     "frozenAt": "2026-08-19T12:00:00Z",
     "frozenReason": "DISPUTE_dispute-uuid"
   }
   ```

2. **Auto-Release Block**: Frozen milestones cannot be auto-released

3. **Auto-Resolution** (if amount < $100 and Gemini available):
   - Gemini analyzes dispute details and agreement terms
   - Returns decision: "brand", "creator", or "partial"
   - Automatically resolves and unfreezes

### 3.3 Dispute Resolution

**Endpoint**: `POST /disputes/{dispute_id}:resolve`

**Request**:
```json
{
  "resolution": "Detailed resolution explanation",
  "resolvedInFavorOf": "brand" | "creator" | "partial"
}
```

**Effects**:
- Updates dispute status to `RESOLVED_BRAND`, `RESOLVED_CREATOR`, or `RESOLVED_PARTIAL`
- Unfreezes milestone (`frozen=false`)
- Records resolution timestamp

### 3.4 List Disputes

**Endpoint**: `GET /agreements/{agreement_id}/disputes`

**Response**:
```json
{
  "disputes": [
    {
      "disputeId": "...",
      "status": "OPEN",
      "raisedBy": "brand",
      "reason": "CONTENT_QUALITY",
      "amountUsdc": 400.0,
      "createdAt": "..."
    }
  ]
}
```

---

## 4. Timelock System

### 4.1 Purpose

Provides a 72-hour dispute window on the content milestone (80% payment) before automatic release. This allows either party to raise concerns before the final payment is processed.

**Integration with 2-Stage Milestones**:
- Deposit (20%) - Released immediately on creator acceptance (no timelock)
- Content (80%) - Gets 72-hour timelock after deposit release, then auto-releases after verification + timelock expiry

### 4.2 Timelock Flow

```text
1. Deposit Milestone Released (20%)
   ↓
2. _set_timelock_for_next_milestone() called
   ↓
3. Content milestone updated with timelock:
   {
     "milestoneId": "content",
     "timelockStartedAt": "2026-08-19T12:00:00Z",
     "timelockExpiresAt": "2026-08-22T12:00:00Z",  // +72 hours
     "status": "TIMELOCK_ACTIVE"
   }
   ↓
4. Creator submits content for verification
   ↓
5. Content passes verification
   ↓
6. Wait for timelock expiry (72 hours from deposit release)
   ↓
7. POST /milestones/timelock:check (periodic job)
   ↓
8. Check expired timelocks:
   - Has active disputes? → Keep frozen
   - No disputes? → Auto-release content milestone (80%)
```

### 4.3 Timelock Check API

**Endpoint**: `POST /milestones/timelock:check`

**Purpose**: Periodic job to check and release expired timelocks

**Response**:
```json
{
  "releasedCount": 3,
  "errors": [],
  "checkedAt": "2026-08-22T12:05:00Z"
}
```

**Process**:
1. Scan all agreements for `status=TIMELOCK_ACTIVE` milestones
2. Check if `timelockExpiresAt < now`
3. Verify no active disputes for milestone
4. Verify milestone not frozen
5. Auto-create timelock evidence (`timelock://auto-release`)
6. Execute `_perform_milestone_release()`

### 4.4 Dispute During Timelock

If a dispute is raised during the 72-hour window:
- Milestone is frozen (`frozen=true`)
- Timelock check skips frozen milestones
- Release waits for dispute resolution

---

## 5. Auto-Resolution with Gemini

### 5.1 Eligibility

Auto-resolution is attempted when:
- `dispute_amount < $100 USDC`
- `settings.gemini_mode != "off"`

### 5.2 Gemini Prompt

```python
prompt = f"""
You are an impartial dispute resolver for creator-brand sponsorship agreements.

DISPUTE DETAILS:
- Raised by: {dispute['raisedBy']}
- Reason: {dispute['reason']}
- Description: {dispute['description']}
- Amount: ${dispute['amountUsdc']} USDC
- Evidence URL: {dispute.get('evidenceUrl', 'None')}

AGREEMENT TERMS:
- Product: {agreement.get('promotionSnapshot', {}).get('productName')}
- Deliverable: {agreement.get('terms', {}).get('deliverables')}
- Usage Rights: {agreement.get('terms', {}).get('usageRights')}

MILESTONE:
- ID: {milestone.get('milestoneId')}
- Trigger: {milestone.get('trigger')}
- Release %: {milestone.get('releasePct')}%

Respond in JSON:
{{
    "decision": "brand" | "creator" | "partial",
    "reasoning": "Brief explanation",
    "resolution": "Detailed resolution text"
}}
"""
```

### 5.3 Decision Mapping

| Gemini Decision | Dispute Status |
|----------------|----------------|
| `"brand"` | `RESOLVED_BRAND` |
| `"creator"` | `RESOLVED_CREATOR` |
| `"partial"` | `RESOLVED_PARTIAL` |

---

## 6. Implementation Details

### 6.1 Data Models

**Dispute** (`libs/domain/models.py`):
```python
class Dispute(DomainModel):
    dispute_id: str
    agreement_id: str
    milestone_id: str
    raised_by: str  # "brand" or "creator"
    reason: DisputeReason
    description: str
    evidence_url: str | None
    status: DisputeStatus
    amount_usdc: float
    resolution: str | None
    resolved_at: datetime | None
    auto_resolved: bool
    created_at: datetime
    updated_at: datetime
```

**DisputeStatus**:
- `OPEN` - Newly raised
- `UNDER_REVIEW` - Manual review in progress
- `RESOLVED_CREATOR` - Resolved in favor of creator
- `RESOLVED_BRAND` - Resolved in favor of brand
- `RESOLVED_PARTIAL` - Partial resolution (split)
- `REJECTED` - Dispute rejected

**DisputeReason**:
- `CONTENT_QUALITY` - Content does not meet quality standards
- `BRAND_MISMATCH` - Brand mention missing or incorrect
- `MISSING_DISCLOSURE` - Required disclosure not present
- `LATE_DELIVERY` - Content posted after deadline
- `PROHIBITED_CLAIMS` - Prohibited claims found
- `OTHER` - Other reasons

### 6.2 Firestore Collections

**disputes** (`/disputes/{disputeId}`):
```json
{
  "disputeId": "dispute-uuid",
  "agreementId": "agreement-123",
  "milestoneId": "verification",
  "raisedBy": "brand",
  "reason": "CONTENT_QUALITY",
  "description": "...",
  "evidenceUrl": "...",
  "status": "OPEN",
  "amountUsdc": 400.0,
  "resolution": null,
  "resolvedAt": null,
  "autoResolved": false,
  "createdAt": "2026-08-19T12:00:00Z",
  "updatedAt": "2026-08-19T12:00:00Z"
}
```

**milestones** (`/agreements/{agreementId}/milestones/{milestoneId}`):
```json
{
  "milestoneId": "content",
  "trigger": "contentLiveVerified",
  "releasePct": 80,
  "status": "TIMELOCK_ACTIVE",
  "timelockStartedAt": "2026-08-19T12:00:00Z",
  "timelockExpiresAt": "2026-08-22T12:00:00Z",
  "frozen": false,
  "frozenAt": null,
  "frozenReason": null,
  "createdAt": "2026-08-19T10:00:00Z",
  "updatedAt": "2026-08-19T12:00:00Z"
}
```

**Note**: In 2-stage system, the content milestone (80%) receives the timelock after deposit (20%) is released.

### 6.3 Code Locations

**Dispute APIs**: `backend/apps/api/routes.py`
- `POST /disputes` - Line ~3150
- `GET /disputes/{dispute_id}` - Line ~3320
- `POST /disputes/{dispute_id}:resolve` - Line ~3340
- `GET /agreements/{agreement_id}/disputes` - Line ~3380
- `_auto_resolve_dispute_with_gemini()` - Line ~3420

**Timelock Logic**:
- `_set_timelock_for_next_milestone()` - `apps/api/routes.py` Line ~7912 (sets timelock on content milestone after deposit release)
- `POST /milestones/timelock:check` - Line ~3560 (periodic check for expired timelocks)
- `_has_active_dispute_for_milestone()` - Line ~3680 (checks for active disputes before auto-release)

---

## 7. Testing

### 7.1 Dispute Tests

**Manual Test Scenarios**:
1. Brand raises dispute after content submission
2. Creator raises dispute for delayed payment
3. Auto-resolution for $50 dispute
4. Manual resolution for $300 dispute
5. Frozen milestone blocks auto-release

### 7.2 Timelock Tests

**Manual Test Scenarios**:
1. Timelock set on content milestone after deposit (20%) release
2. Timelock expires without disputes → auto-release content (80%)
3. Dispute raised during timelock → blocks content release
4. Multiple timelocks checked in single run
5. Content verification completes during active timelock → waits for expiry

### 7.3 Test Commands

```bash
# Sandbox mode tests
cd backend
pytest tests/test_paysh_sandbox.py -v

# API integration tests (when available)
pytest tests/test_api_disputes.py -v
pytest tests/test_api_timelock.py -v
```

---

## 8. Security Considerations

### 8.1 Authorization

- Only agreement parties (brand or creator) can raise disputes
- Verified through Firebase Auth + agent ID matching
- Non-parties receive `403 FORBIDDEN`

### 8.2 Idempotency

- Duplicate dispute creation prevented by unique constraint
- Resolution operations are idempotent

### 8.3 Gemini Safety

- Auto-resolution only for small amounts (< $100)
- Fallback to manual review if Gemini fails
- No sensitive data in Gemini prompts

---

## 9. UI Guidelines

### 9.1 Dispute Raising

**Brand View**:
```
콘텐츠에 문제가 있나요?
→ [분쟁 제기] 버튼
→ 사유 선택: 품질 문제 / 브랜드 미언급 / 공개 누락 등
→ 상세 설명 입력 (10자 이상)
→ 증거 첨부 (선택)
```

**Creator View**:
```
정산에 문제가 있나요?
→ [분쟁 제기] 버튼
→ 사유 선택: 지연 / 부당 거절 등
→ 상세 설명 입력
```

### 9.2 Dispute Status Display

```
분쟁 상태: 검토 중
금액: $400 USDC
제기자: 브랜드
사유: 콘텐츠 품질 문제
제기일: 2026-08-19

[자동 중재 완료] (if auto-resolved)
결과: 크리에이터에게 유리하게 해결
```

### 9.3 Timelock Display

```
최종 정산 대기 중
72시간 후 자동 릴리즈: 2026-08-22 12:00
이의 제기 가능 기간입니다.

[분쟁 제기] 버튼
```

---

## 10. Future Enhancements

### 10.1 Planned Features

- **Escalation Path**: Multi-level dispute resolution (auto → review → arbitration)
- **Evidence Upload**: Direct file upload instead of URL
- **Notification System**: Push notifications for dispute updates
- **Dispute History**: Track all disputes by user for reputation

### 10.2 Optimization

- **Batch Timelock Checks**: Process multiple expired timelocks efficiently
- **Caching**: Cache active disputes to reduce Firestore reads
- **Webhooks**: Notify parties of dispute status changes

---

## 11. References

- **Mentoring Feedback**: `docs/IMPROVED_SPEC_MENTORING_FEEDBACK.md`
- **Pitch Deck**: `docs/PITCH_DECK_FINAL_MENTORING_UPDATED.md`
- **Settlement Spec**: `docs/13_AGREEMENT_ESCROW_EVIDENCE_SETTLEMENT.md`
- **Implementation Status**: `docs/IMPLEMENTATION_STATUS.md`
