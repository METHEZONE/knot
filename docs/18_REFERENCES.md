# References

## 1. 제공 자료

### Google × Solana AI Agentic Hackathon Intro Deck

반영:
- 혁신성·UX
- Gemini/Google Cloud
- USDC/Solana/pay.sh
- 실제 트랜잭션과 로그
- Mock 제외

### Why Solana for Agentic Commerce

반영:
- Agent가 정책 범위에서 직접 결제
- wallet/stablecoin/smart contract
- 실제 온체인 결제
- localnet → devnet
- mainnet은 MVP 대상 아님

### The Agentic Commerce Stack: x402 & mpp

반영:
- Agentic Commerce
- A2A와 MCP 역할 분리
- pay.sh/x402와 Promotion Escrow 구분
- 기술 선택의 당위성

### Vibe Coding on Google Cloud

반영:
- Cloud Run
- Firestore
- Agent development
- UI reference를 실제 backend에 연결하는 구조

### KNOT_A2A_ARCHITECTURE.md

반영:
- HTTP+JSON
- A2A v1.0
- AgentCard
- tenant
- Message/Task/Artifact
- official state
- one-task multi-turn
- protocol invariants

---

## 2. UI Source

```text
origin/feat/two-user-session
knot/frontend/src/features/onboard
knot/frontend/src/features/settings/SettingsScreen.tsx
```

Agent 대화, onboarding, Settings 디자인은 branch source를 우선한다.

---

## 3. 공식 링크

- A2A Specification  
  https://a2a-protocol.org/latest/specification/

- A2A Definitions  
  https://a2a-protocol.org/latest/definitions/

- A2A Key Concepts  
  https://a2a-protocol.org/latest/topics/key-concepts/

- x402  
  https://x402.org/

- Solana Docs  
  https://solana.com/docs

- Firebase Auth Web  
  https://firebase.google.com/docs/auth/web/start

- Cloud Run  
  https://cloud.google.com/run/docs

- Firestore  
  https://cloud.google.com/firestore/docs

---

## 4. 문서와 공식 규격 충돌

- A2A field와 enum은 공식 규격 우선
- 실제 SDK/프로그램 API는 설치된 버전의 공식 문서 우선
- 제품 용어와 UI는 본 문서 세트 우선
- 실제 배포 기능은 `IMPLEMENTATION_STATUS.md`에 증거와 함께 기록
