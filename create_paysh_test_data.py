#!/usr/bin/env python3
"""
Create test campaign with pay.sh verification - standalone script.
"""
from google.cloud import firestore
from datetime import datetime, timezone

# Initialize Firestore
db = firestore.Client(project="knot-dev-503505", database="(default)")

now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

print("Creating test campaign with pay.sh verification...")

# 1. Match Run
match_run_id = "match-run-paysh-test"
db.collection("match_runs").document(match_run_id).set({
    "matchRunId": match_run_id,
    "promotionId": "promotion-paysh-test",
    "brandId": "brand-1",
    "status": "COMPLETED",
    "createdAt": now,
    "updatedAt": now,
})
print(f"✅ Match run: {match_run_id}")

# 2. Match Candidate with pay.sh receipt
creator_id = "creator-1"
candidate_id = creator_id
creator_agent_id = "agent-creator-1"

db.collection("match_runs").document(match_run_id).collection("match_candidates").document(candidate_id).set({
    "matchCandidateId": candidate_id,
    "candidateId": candidate_id,
    "matchRunId": match_run_id,
    "promotionId": "promotion-paysh-test",
    "creatorId": creator_id,
    "creatorAgentId": creator_agent_id,
    "status": "NEGOTIATING",
    "eligible": True,
    "rank": 1,
    "overallScore": 0.92,
    "explanation": "pay.sh 검증을 통과한 우수한 크리에이터입니다.",
    "negotiationStatus": "IN_PROGRESS",
    "negotiationId": "negotiation-paysh-test",
    "verificationReceipt": {
        "receiptId": "paysh-receipt-test-001",
        "provider": "nansen",
        "costUsdc": 0.10,
        "network": "SANDBOX",
        "verificationResult": {
            "bot_percentage": 0.08,
            "engagement_quality": "HIGH",
            "follower_count": 52000,
            "verified": True,
        },
    },
    "verificationPassed": True,
    "createdAt": now,
    "updatedAt": now,
})
print(f"✅ Match candidate with pay.sh receipt: {candidate_id}")

# 3. Negotiation
negotiation_id = "negotiation-paysh-test"
db.collection("negotiations").document(negotiation_id).set({
    "negotiationId": negotiation_id,
    "matchRunId": match_run_id,
    "promotionId": "promotion-paysh-test",
    "brandId": "brand-1",
    "brandAgentId": "agent-brand-1",
    "creatorId": creator_id,
    "creatorAgentId": creator_agent_id,
    "matchCandidateId": candidate_id,
    "status": "AGREED",
    "agreementId": "agreement-paysh-test",
    "promotionTitle": "pay.sh 검증 테스트 캠페인",
    "productName": "뷰티 세럼 신제품",
    "creatorDisplayName": "민지의 뷰티룸",
    "taskId": "task-paysh-test",
    "contextId": "context-paysh-test",
    "initialAmountUsdc": 500,
    "currentAmountUsdc": 600,
    "currentRound": 3,
    "maxRounds": 5,
    "deliverableSummary": "릴스 1개",
    "workItems": [{
        "format": "reel",
        "count": 1,
        "description": "뷰티 세럼 사용 후기 릴스",
        "dueDate": "2026-08-25",
    }],
    "currentTerms": {
        "compensation": {
            "structure": "flat",
            "baseAmountUsdc": 600,
            "performancePct": 0,
        },
        "deliverables": [{
            "format": "reel",
            "count": 1,
            "postWindow": {"start": "2026-08-20", "end": "2026-08-25"},
            "revisionRounds": 1,
        }],
        "usageRights": "organicOnly",
        "milestones": [
            {"id": "content-post", "trigger": "POST_VERIFIED", "releasePct": 100}
        ],
        "constraints": {
            "requiredDisclosures": ["#ad", "#sponsored"],
            "prohibitedClaims": ["의학적 효과"],
            "exclusivityDays": 0,
        },
    },
    "createdAt": now,
    "updatedAt": now,
})
print(f"✅ Negotiation: {negotiation_id}")

# 4. Negotiation Messages
messages = [
    {
        "messageId": "msg-paysh-test-001",
        "negotiationId": negotiation_id,
        "role": "brand_agent",
        "sequence": 1,
        "payload": {
            "type": "OFFER",
            "summary": "뷰티 세럼 신제품 릴스 1개를 $500에 제안드립니다.",
            "deliverables": [{"format": "reel", "count": 1}],
            "amountUsdc": 500,
        },
        "createdAt": now,
    },
    {
        "messageId": "msg-paysh-test-002",
        "negotiationId": negotiation_id,
        "role": "creator_agent",
        "sequence": 2,
        "payload": {
            "type": "COUNTER",
            "summary": "릴스 제작이 가능하지만 $600로 조정 부탁드립니다.",
            "requestedChanges": ["보상 금액 상향"],
            "amountUsdc": 600,
        },
        "createdAt": now,
    },
    {
        "messageId": "msg-paysh-test-003",
        "negotiationId": negotiation_id,
        "role": "brand_agent",
        "sequence": 3,
        "payload": {
            "type": "ACCEPT",
            "summary": "$600 조건으로 수락합니다.",
            "agreementId": "agreement-paysh-test",
            "termsHash": "sha256:test123",
        },
        "createdAt": now,
    },
]

for msg in messages:
    msg_id = msg["messageId"]
    db.collection("negotiations").document(negotiation_id).collection("negotiation_messages").document(msg_id).set(msg)

print(f"✅ Created {len(messages)} negotiation messages")

# 5. Agreement
agreement_id = "agreement-paysh-test"
db.collection("agreements").document(agreement_id).set({
    "agreementId": agreement_id,
    "negotiationId": negotiation_id,
    "promotionId": "promotion-paysh-test",
    "brandId": "brand-1",
    "creatorId": creator_id,
    "status": "FUNDED",
    "terms": {
        "compensation": {
            "structure": "flat",
            "baseAmountUsdc": 600,
            "performancePct": 0,
        },
        "deliverables": [{
            "format": "reel",
            "count": 1,
            "postWindow": {"start": "2026-08-20", "end": "2026-08-25"},
            "revisionRounds": 1,
        }],
        "usageRights": "organicOnly",
        "milestones": [
            {"id": "content-post", "trigger": "POST_VERIFIED", "releasePct": 100}
        ],
        "constraints": {
            "requiredDisclosures": ["#ad", "#sponsored"],
            "prohibitedClaims": ["의학적 효과"],
            "exclusivityDays": 0,
        },
    },
    "termsHash": "sha256:test123",
    "escrowId": "escrow-paysh-test",
    "totalAmountUsdc": 600,
    "createdAt": now,
    "updatedAt": now,
})
print(f"✅ Agreement: {agreement_id}")

# 6. Evidence with content verification receipt
evidence_id = "evidence-paysh-test-001"
db.collection("evidence").document(evidence_id).set({
    "evidenceId": evidence_id,
    "agreementId": agreement_id,
    "promotionId": "promotion-paysh-test",
    "milestoneId": "content-post",
    "submittedByAgentId": creator_agent_id,
    "url": "https://instagram.com/p/test-paysh-content",
    "sourceDigest": "sha256:content123",
    "status": "PASSED",
    "outcome": "APPROVED",
    "outcomeReasonCodes": [],
    "revisionCount": 0,
    "revisionsRemaining": 1,
    "observations": {
        "urlReachable": True,
        "brandMentioned": True,
        "disclosurePresent": True,
        "prohibitedClaimsFound": [],
    },
    "policyDecision": {
        "compliant": True,
        "violations": [],
        "warnings": [],
    },
    "contentVerificationReceipt": {
        "receiptId": "paysh-content-receipt-001",
        "provider": "brandwatch",
        "costUsdc": 0.50,
        "network": "SANDBOX",
        "verificationResult": {
            "brand_mention_found": True,
            "sentiment_score": 0.88,
            "quality_score": 0.94,
        },
    },
    "createdAt": now,
    "verifiedAt": now,
    "updatedAt": now,
})
print(f"✅ Evidence with content verification receipt: {evidence_id}")

print("\n🎉 Test campaign created successfully!")
print(f"\n📊 Summary:")
print(f"   Match Run: {match_run_id}")
print(f"   Negotiation: {negotiation_id}")
print(f"   Agreement: {agreement_id}")
print(f"   Evidence: {evidence_id}")
print(f"\n🔗 Test URLs:")
print(f"   Messages API: https://knot-api-260001601654.us-central1.run.app/api/v1/negotiations/{negotiation_id}/messages")
print(f"   Web UI: https://knot-web-7k3walthgq-uc.a.run.app")
