# Token & Spend Budget Strategy

## 1. 목적

- Gemini 비용과 latency 통제
- Codex 작업 컨텍스트 오염 방지
- pay.sh API spend cap
- Brand의 Promotion budget과 Agent API budget 분리

---

## 2. Production Gemini

Use case:
- product/profile extraction
- candidate explanation
- negotiation proposal
- evidence observation

원칙:
- structured output
- 최소 context
- cached profile/policy summaries
- raw history 전체 대신 current terms + relevant last messages
- deterministic policy outside model
- retries limited
- model tier by task

권장:
- extraction: fast model
- negotiation: fast/medium
- complex fallback only when needed

---

## 3. Context

Negotiation prompt:
- Promotion public data
- own private policy
- counterparty public profile
- current terms
- last relevant turns
- max rounds
- output schema

제외:
- unrelated history
- counterparty private policy
- raw logs
- secrets
- entire Firestore documents

---

## 4. Limits

- max negotiation rounds: 5
- max model retry: 2
- max source content bytes
- max evidence content
- max candidates analyzed deeply
- timeout
- daily request quota

---

## 5. pay.sh/x402

Separate budget:

```text
agentApiSpendCapUsdc
```

Rules:
- API allowlist
- per-call max
- daily max
- receipt
- Promotion Escrow budget에서 차감하지 않음

---

## 6. Brand Budget

```text
totalBudgetUsdc
perDealCapUsdc
committedUsdc
lockedUsdc
releasedUsdc
remainingUsdc
```

Agent cannot:
- exceed per-deal cap
- exceed remaining budget
- use API spend as Creator compensation

---

## 7. Codex Development

- one phase per session when context grows
- read 00 index + relevant docs only
- do not repeatedly load all archived docs
- status and handoff at each phase
- commits as checkpoints
- visual tests before large refactor
- use subagents by bounded task

---

## 8. Observability

Track:
- tokens by task
- latency
- retry
- failure
- cost estimate
- API receipt
- model version
- prompt version

Do not log full sensitive prompts.
