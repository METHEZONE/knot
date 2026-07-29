# KNOT v2 API Contracts

## 1. 공통

Base:

```text
/api/v1
```

Headers:

```http
Authorization: Bearer <Firebase ID Token>
Content-Type: application/json
Idempotency-Key: <key>    # mutation where required
X-Correlation-Id: <uuid>  # optional; server generates if absent
```

Error:

```json
{
  "error": {
    "code": "NEGOTIATION_NOT_FOUND",
    "message": "협상 기록을 찾을 수 없습니다.",
    "correlationId": "..."
  }
}
```

---

## 2. Me / Auth

### `GET /me`

```json
{
  "userId": "...",
  "role": "CREATOR",
  "onboarding": {
    "version": 2,
    "completed": true,
    "step": "COMPLETE"
  },
  "profileId": "creator-001",
  "agentId": "creator-agent-001"
}
```

---

## 3. Brand Source Analysis

### `POST /brand-sources:analyze`

```json
{
  "url": "https://demo-skincare.example.com/spf-daily"
}
```

Response:

```json
{
  "source": "REAL",
  "product": {
    "name": "Daily SPF Moisturizer",
    "priceKrw": 28000,
    "category": "beauty",
    "description": "...",
    "imageUrl": null
  },
  "confidence": {
    "name": 0.98,
    "category": 0.85
  }
}
```

보안:
- SSRF 차단
- private IP 금지
- redirect 제한
- timeout/content size 제한

### `POST /brands:onboard`

```json
{
  "brand": {
    "name": "Glow",
    "sourceUrl": "...",
    "productSnapshot": {}
  },
  "promotionDraft": {
    "moodTags": ["설명형", "정보", "루틴"],
    "totalBudgetUsdc": 2000,
    "perDealCapUsdc": 800
  }
}
```

Response:
- brand
- draft Promotion
- Agent
- onboarding state

---

## 4. Creator Source Analysis

### `POST /creator-sources:analyze`

```json
{
  "instagram": "@demobeauty"
}
```

Response:

```json
{
  "source": "REAL",
  "profile": {
    "handle": "demobeauty",
    "displayName": "Mina",
    "followerCount": 57922,
    "averageViews": 98467,
    "engagementRate": 2.8,
    "reelsRatio": 65,
    "styleTags": ["차분한 설명", "성분 중심", "루틴 공유"]
  },
  "collectedAt": "..."
}
```

실제 수집이 불가능하면:

```json
{
  "source": "USER_CONFIRMED",
  "profile": {
    "handle": "demobeauty",
    "styleTags": []
  },
  "warnings": ["PUBLIC_METRICS_UNAVAILABLE"]
}
```

### `POST /creators:onboard`

```json
{
  "profile": {
    "instagramHandle": "demobeauty",
    "socialSnapshot": {},
    "styleTags": []
  },
  "policy": {
    "minimumBaseUsdc": 300,
    "blockedCategories": ["gambling"]
  }
}
```

---

## 5. Agent

### `POST /agents/{agentId}:activate`

Idempotent.

Response:

```json
{
  "agentId": "...",
  "status": "ACTIVE",
  "availability": "OFFLINE",
  "acceptingOffers": false
}
```

### `POST /agents/{agentId}:set-availability`

```json
{
  "acceptingOffers": true
}
```

Response:

```json
{
  "availability": "AVAILABLE",
  "acceptingOffers": true
}
```

---

## 6. Dashboard

### `GET /me/dashboard`

Role-specific response.

Creator:

```json
{
  "manager": {},
  "actionItems": [],
  "activeSponsorships": [],
  "recentActivities": [],
  "settlement": {
    "claimableUsdc": 0,
    "pendingUsdc": 300,
    "releasedUsdc": 0
  }
}
```

Brand:

```json
{
  "manager": {},
  "actionItems": [],
  "promotions": [],
  "activeNegotiations": [],
  "recentActivities": [],
  "escrow": {
    "lockedUsdc": 300,
    "releasedUsdc": 0
  }
}
```

---

## 7. Promotion

### `POST /promotions`

```json
{
  "title": "...",
  "productSnapshot": {},
  "moodTags": [],
  "deliverables": [],
  "usageRights": "ORGANIC_ONLY",
  "deadline": "...",
  "totalBudgetUsdc": 2000,
  "perDealCapUsdc": 800,
  "milestones": [
    { "code": "AGREEMENT", "percentage": 30 },
    { "code": "POST_VERIFIED", "percentage": 70 }
  ]
}
```

### `POST /promotions/{id}:run`

- status DRAFT → MATCHING
- Match Run 생성

### `GET /promotions/{id}/candidates`

Public candidate view only.

---

## 8. Negotiation

### `POST /negotiations`

```json
{
  "promotionId": "promotion-001",
  "creatorAgentId": "creator-agent-001"
}
```

Server:
- Brand owner/Promotion 검증
- Creator availability 검증
- A2A initial OFFER
- negotiation/task 생성

### `GET /negotiations`

Query:
- status
- role-derived owner
- promotionId
- cursor

### `GET /negotiations/{id}`

- summary
- participants
- public current terms
- related Agreement/Escrow IDs
- owner-specific own policy summary

### `GET /negotiations/{id}/timeline`

Response:

```json
{
  "items": [
    {
      "id": "activity-001",
      "type": "OFFER",
      "actor": "BRAND_AGENT",
      "actorName": "Glow Agent",
      "message": "릴스 1개에 240 USDC로 시작해볼게요.",
      "amountUsdc": 240,
      "status": "DONE",
      "occurredAt": "..."
    }
  ],
  "nextCursor": null
}
```

### `POST /negotiations/{id}:approve`

```json
{
  "decision": "APPROVE"
}
```

또는 수정:

```json
{
  "decision": "MODIFY",
  "terms": {}
}
```

### `POST /negotiations/{id}:reject`

```json
{
  "reasonCode": "USER_REJECTED"
}
```

---

## 9. Agreement

### `GET /agreements/{id}`

Returns canonical terms and user-safe metadata.

Agreement creation is internal and exactly once after final Artifact.

---

## 10. Evidence

### `POST /agreements/{id}/evidence`

```json
{
  "type": "INSTAGRAM_URL",
  "url": "https://instagram.com/reel/..."
}
```

### `POST /evidence/{id}:verify`

May be internal/system-triggered.

Response:
- observations
- deterministic decision
- milestone eligibility

---

## 11. Escrow

### `POST /agreements/{id}/escrow:lock`

Idempotency required.

Request:

```json
{
  "fundingWallet": "...",
  "asset": "USDC",
  "network": "SOLANA_DEVNET"
}
```

Response:

```json
{
  "escrowId": "...",
  "status": "SUBMITTED",
  "receiptId": "..."
}
```

### `GET /escrows/{id}`

- status
- locked/released/remaining
- milestones
- receipts

### `POST /escrows/{id}/milestones/{milestoneId}:release`

Internal or authorized Brand/system operation.

---

## 12. Settlement

### `GET /settlements/summary`

Role-specific.

### `POST /settlements/{id}:claim`

Only if current architecture uses claim. Automatic payout architecture omits this CTA.

---

## 13. Transaction Receipt

### `GET /transaction-receipts/{id}`

```json
{
  "status": "CONFIRMED",
  "network": "SOLANA_DEVNET",
  "signature": "...",
  "explorerUrl": "...",
  "confirmedAt": "..."
}
```

---

## 14. Streaming

Preferred:
- SSE endpoint or A2A subscribe
- fallback polling

User API option:

```text
GET /negotiations/{id}/events
Accept: text/event-stream
```

Event envelope:

```json
{
  "sequence": 4,
  "type": "ACTIVITY_UPDATED",
  "negotiationId": "...",
  "occurredAt": "..."
}
```

Frontend re-fetches sanitized timeline or applies safe projection.

---

## 15. Status Codes

- 200/201 success
- 202 operation submitted
- 400 validation
- 401 unauthenticated
- 403 wrong owner/role
- 404 not found
- 409 invalid state/idempotency conflict
- 422 business policy invalid
- 429 rate limit
- 502 downstream A2A/Web3
- 503 temporary unavailable
