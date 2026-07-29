# Security & Authorization

## 1. Threat Model

- 사용자 간 데이터 접근
- role spoofing
- Firebase token misuse
- SSRF in URL analysis
- prompt injection from product/social content
- private policy leakage
- duplicate Agreement/Escrow/Release
- wallet secret exposure
- fake receipt
- dev admin exposure
- replayed A2A messages
- malicious evidence URL

---

## 2. Authentication

- Firebase ID Token verify
- audience/project check
- expired/revoked token handling
- service-to-service identity for internal A2A/Web3
- no shared static bearer in frontend

---

## 3. Authorization

모든 resource:
- owner relation
- role
- current state
- action permission

Examples:
- Brand만 자신의 Promotion 실행
- Creator만 자신의 Evidence 제출
- 상대는 public negotiation view만
- Admin route separately protected
- Web3 release는 eligible milestone만

---

## 4. Policy Privacy

Private:
- minimumBaseUsdc
- blockedCategories
- totalBudgetUsdc
- perDealCapUsdc
- internal approval rules
- prompts
- model output

Public projection:
- offer/counter
- sanitized reason
- terms
- state

Backend는 private document를 frontend response에 포함한 뒤 숨기는 방식이 아니라, 처음부터 safe DTO를 반환한다.

---

## 5. URL Analysis Security

- URL scheme allowlist
- no localhost/private IP/link-local
- DNS rebinding defense
- max redirects
- timeout
- content size
- MIME validation
- HTML sanitization
- no script execution
- Instagram domain validation
- rate limit

---

## 6. LLM Security

- external content is untrusted
- system instruction separation
- structured output schema
- prompt injection detection/ignore
- no credentials in prompt
- no chain-of-thought storage
- no LLM direct transaction authority
- deterministic policy revalidation
- model output audit summary only

---

## 7. A2A Security

- service auth
- AgentCard trusted registry
- tenant validation
- messageId dedupe
- taskId/context binding
- terminal state immutable
- body size/rate limit
- replay protection
- correlation IDs
- sanitized logs

---

## 8. Web3 Security

- devnet only
- allowlisted program/mint
- spend cap
- agreement ownership
- termsHash
- idempotency
- transaction simulation
- no secret logs
- no arbitrary transaction payload
- reconcile timeout
- finality policy

---

## 9. Frontend

- no secret env in `NEXT_PUBLIC_*`
- XSS escape user content
- safe external links
- tabnabbing protection
- no localStorage long-lived auth if session isolation required
- pending button disable
- CSRF considered for cookie endpoints
- CORS strict

---

## 10. Firestore

- API-only canonical write
- Security Rules deny broad client write
- least privilege service account
- indexes reviewed
- no global latest object query
- retention for audit/private policy

---

## 11. Logging

Log:
- correlation ID
- operation ID
- status
- latency
- safe identifiers

Redact:
- token
- wallet secret
- private policy values
- raw prompts
- sensitive social data
- transaction signing material

---

## 12. Security Acceptance

- cross-user ID access returns 403/404
- private policy absent from counterparty DTO
- duplicate lock/release returns same result
- SSRF tests
- prompt injection fixture
- Admin denied to normal user
- no secret grep result
- no mainnet configuration in demo
