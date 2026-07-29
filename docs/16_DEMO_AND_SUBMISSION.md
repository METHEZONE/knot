# Demo & Submission Plan

## 1. 3분 Storyboard

### 0:00–0:20 문제

- Brand는 DM·엑셀·계좌이체
- Creator는 낮은 제안과 정산 불안
- KNOT은 각자에게 Agent Manager를 붙인다

### 0:20–0:45 Creator onboarding

- Instagram
- 300 USDC
- blocked categories
- Mina Agent

### 0:45–1:10 Brand onboarding

- product URL
- mood
- 2,000 / 800
- Glow Agent

### 1:10–1:50 A2A

두 탭:
- 후보 3명
- 240 OFFER
- 300 COUNTER
- policy
- 300 ACCEPT

### 1:50–2:15 Agreement/Escrow

- Agreement
- termsHash
- actual devnet lock
- Explorer

### 2:15–2:40 Evidence/Release

- Reel URL
- verification
- 30/70
- release signature

### 2:40–3:00 결론

- 최소 입력
- private guardrails
- visible Agent action
- actual on-chain settlement

---

## 2. 데모 데이터

Brand:
- Glow
- Daily SPF Moisturizer
- total 2,000
- per-deal 800

Creator:
- Mina
- minimum 300
- blocked category fixture

Negotiation:
- 240 → 300 → ACCEPT

Escrow:
- 300 USDC
- 30/70

---

## 3. 데모 준비

- two tabs pre-open
- accounts pre-created
- devnet wallet funded
- backend warm
- Cloud Run health
- transaction explorer
- fallback recording
- no mainnet

---

## 4. 실패 대응

Social analysis unavailable:
- user-confirmed profile

A2A stream delay:
- polling with real task

Devnet slow:
- show SUBMITTED then receipt
- prior confirmed transaction as backup proof, clearly labeled

Never:
- fake current signature

---

## 5. 심사 기준 매핑

혁신 UX:
- Manager onboarding
- visual A2A

AI:
- product/profile extraction
- proposal
- evidence observations

Infrastructure:
- Cloud Run
- Firestore
- Firebase
- Gemini

Solana:
- USDC
- escrow
- lock/release
- Explorer

Actual:
- logs
- receipts
- deployment URL
- reproducible README

---

## 6. 제출

- PPT
- GitHub
- README
- 3분 video
- live URL
- architecture diagram
- actual transaction IDs
- test instructions
- environment setup
- known limitations

---

## 7. Final Checklist

- no `SIMULATED` in final happy path
- actual A2A boundary
- actual Agreement Artifact
- actual devnet lock/release
- no secrets
- source-of-truth docs
- build/test green
