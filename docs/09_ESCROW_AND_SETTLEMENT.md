# Escrow & Settlement

## 1. 목표

Agreement에서 합의된 조건과 동일한 `termsHash`로 자금을 Solana devnet에 잠그고, Evidence와 milestone에 따라 중복 없이 지급한다.

---

## 2. 결제 구분

### Agent API Spend

- pay.sh/x402
- 검색·분석·검증 API 호출 비용
- 작은 receipt
- Promotion 보수와 별도

### Promotion Escrow

- Brand → Creator 보수
- Agreement 기반
- milestone release
- Solana USDC

---

## 3. Architecture

```text
Frontend Wallet / Agent Authority
→ Product API
→ Agreement/Policy Validation
→ Private Web3 Gateway
→ Solana devnet
→ Receipt
→ Firestore
→ UI
```

Frontend가 transaction authority를 임의로 생성하지 않는다.

---

## 4. Canonical Terms

Agreement terms를 다음 규칙으로 canonical JSON으로 만든다.

- key 정렬
- amount는 base unit 또는 정규화 decimal
- timestamp ISO UTC
- optional undefined 제거
- array 순서 의미 고정
- UTF-8

```text
termsHash = SHA-256(canonicalTermsJson)
```

Artifact, Agreement, Escrow instruction에 동일 hash를 쓴다.

---

## 5. Escrow Lock Validation

필수:
- authenticated Brand owner
- Agreement FINALIZED
- no existing confirmed escrow
- asset/mint allowlist
- amount equals Agreement
- creator wallet valid
- termsHash match
- network DEVNET
- idempotency key
- spend authority/cap

Operation:

```text
PREPARING
→ SUBMITTED
→ CONFIRMED
```

실패:
- FAILED
- retryable/non-retryable 분리

---

## 6. Milestone

MVP:

```text
AGREEMENT 30%
POST_VERIFIED 70%
```

일반 규칙:
- sum = 100
- amount rounding deterministic
- 마지막 milestone이 remainder 흡수
- already released milestone 재지급 금지
- total release <= locked
- Agreement state 검증

---

## 7. Evidence

Creator input:
- Instagram URL

Validation:
- supported domain
- normalized URL
- duplicate
- agreement owner
- deadline

Gemini observations:
- URL 접근 여부
- brand/product mention
- required disclosure
- prohibited claims
- content type

Deterministic decision:
- required fields 충족
- manual review rule
- model confidence만으로 지급 금지

---

## 8. Release

```text
Evidence VERIFIED
→ eligible milestone
→ release operation
→ transaction submitted
→ confirmed
→ Settlement + Receipt
→ Dashboard amounts update
```

Agent 자동 release는 authority와 policy가 실제 구현된 경우만 사용한다. 아니면 Brand confirmation 또는 system rule을 명확히 한다.

---

## 9. Creator `정산 받기`

두 architecture 중 실제 구현 하나를 선택한다.

### Automatic transfer

- release transaction이 Creator wallet로 직접 보냄
- CTA는 `지급 완료`
- `정산 받기` 버튼 없음

### Claim

- release 후 claimable 상태
- Creator가 wallet transaction 승인
- `정산 받기` CTA

UI는 실제 architecture와 일치해야 한다.

---

## 10. Receipt

```json
{
  "operationType": "ESCROW_LOCK",
  "network": "SOLANA_DEVNET",
  "status": "CONFIRMED",
  "signature": "...",
  "explorerUrl": "...",
  "blockTime": "...",
  "errorCode": null
}
```

`0x...`를 Solana signature로 표시하지 않는다.

---

## 11. Simulation

허용:
- local fixture
- Storybook
- explicit `NEXT_PUBLIC_DEMO_MODE=true`

표시:

```text
SIMULATED · 서명 없음
```

금지:
- API mode에서 silent mock
- fake Explorer link
- fake confirmed state

최종 해커톤 배포:
- actual devnet lock/release target

---

## 12. Localnet / Devnet

Localnet:
- contract/program tests
- resettable
- unlimited fixtures

Devnet:
- final smoke/demo
- actual signatures
- only test assets

Mainnet:
- MVP 금지

---

## 13. Web3 Gateway Security

- private Cloud Run
- service-to-service auth
- secret manager
- no key logs
- no client-supplied arbitrary program/mint
- allowlist
- transaction simulation
- commitment/confirmation policy
- timeout/retry
- idempotency
- audit
- balance/spend caps

---

## 14. Failure Recovery

Lock submitted but API timeout:
- query signature/operation id
- do not resubmit blindly

Receipt confirmed but Firestore update failed:
- reconciliation job

Release failed:
- retry operation
- milestone remains unreleased

Wrong evidence:
- rejected, resubmit allowed

Terms mismatch:
- hard fail, no transaction

---

## 15. UI

Negotiation timeline:
- Agreement card
- Escrow pending
- confirmed card
- milestone

Escrow detail:
- network
- asset
- locked
- released
- remaining
- receipts
- Explorer

Dashboard:
- summary only
- failure action item
