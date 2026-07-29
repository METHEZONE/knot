# Test & Acceptance

## 1. Test Layers

- unit
- integration
- contract
- emulator
- E2E
- visual
- security
- Web3 localnet/devnet
- deploy smoke

---

## 2. Frontend Unit

- route resolver
- onboarding step resolver
- URL normalization
- quick policy validation
- A2A state → UI status
- Activity mapper
- currency display
- privacy projection
- CTA by next action
- legacy redirect

---

## 3. Backend Unit

- policy decisions
- Agreement canonicalization
- termsHash
- milestone rounding
- state transitions
- idempotency
- ownership
- reason sanitization

---

## 4. Integration

- Firebase token verify
- onboarding persistence
- Agent activate
- availability
- Promotion run
- candidate retrieval
- A2A HTTP
- Artifact → Agreement
- Agreement → Escrow
- Evidence → Release

---

## 5. A2A

Golden:
- OFFER without taskId
- server taskId
- COUNTER
- same context/task ACCEPT
- COMPLETED Artifact

Other:
- blocked category REJECT
- approval required
- duplicate message
- terminal follow-up rejected
- stream ordering
- reconnect
- downstream timeout

---

## 6. Web3

Local:
- escrow initialize
- lock
- partial release
- full release
- duplicate release
- wrong termsHash
- wrong owner
- wrong mint
- over-release

Devnet:
- actual lock signature
- actual release signature
- Explorer
- receipt confirmation

---

## 7. E2E

### Creator

- signup/login
- Instagram onboarding
- policy
- Manager
- Dashboard
- sponsorship ON
- inbound offer
- negotiation
- evidence
- settlement

### Brand

- signup/login
- product onboarding
- mood
- budget
- Manager
- Dashboard
- proposal
- candidates
- negotiation
- escrow
- evidence review
- settlement

### Two Tabs

- Brand/Creator different session
- one tab login does not replace other
- negotiation updates both

---

## 8. Visual Screenshots

```text
login
brand-source
brand-mood
brand-budget
brand-manager
creator-source
creator-policy
creator-manager
brand-dashboard
creator-dashboard
candidates
negotiation-working
negotiation-completed
agreement
escrow
evidence
settlement
mypage
two-tabs
```

Reference:
- two-window branch

---

## 9. Required Copy

Tests assert:
- 제품 링크만 주세요
- 어떤 무드가 좋으세요?
- 한도만 정하면 끝이에요
- 인스타그램만 연결하면 돼요
- 두 개만 정하면 끝이에요
- 매니저 붙이기
- 협찬 받기
- 협찬 제안하기
- 에이전트끼리 대화
- 게시물 올리고 링크만 주시면 나머지는 제가 합니다

Branch exact copy가 다르면 actual source copy 우선.

---

## 10. Security

- user A cannot fetch user B
- role mismatch
- private policy absent
- SSRF
- prompt injection
- duplicate mutation
- Admin protection
- secret scan
- no mainnet

---

## 11. Nonfunctional

- initial dashboard acceptable latency
- stream cleanup
- no infinite auth loading
- responsive
- keyboard mood selection
- reduced motion
- accessible labels
- error retry
- Cloud Run cold start handling

---

## 12. Acceptance Criteria

### Onboarding

- two-window UI
- actual auth
- truthful source analysis
- Agent created once
- Dashboard after Manager
- no auto negotiation

### Dashboard

- role-specific
- activation semantics
- action items
- history
- recent activity
- MyPage single link

### Negotiation

- actual A2A
- one counter
- policy
- privacy
- multiple list
- rejected history
- detail chat

### Escrow

- Agreement
- termsHash
- devnet lock
- evidence
- release
- receipts

### Deploy

- build/test green
- preview smoke
- live URL
- revision recorded

---

## 13. Severity

P0:
- auth bypass
- cross-user access
- fake transaction
- duplicate payment
- broken happy path

P1:
- wrong state/amount
- missing rejection
- broken refresh
- UI inconsistency

P2:
- copy/layout/accessibility defect
