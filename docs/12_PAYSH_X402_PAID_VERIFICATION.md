# pay.sh / x402 Paid Candidate Verification

## 1. Product purpose

pay.sh/x402 is used for an Agent to buy external analysis data during matching. It is not the creator compensation escrow.

```text
pay.sh/x402
= machine-to-machine API spend

Promotion Escrow
= human service compensation
```

The UI and code must keep these ledgers and terms separate.

## 2. Trigger

The Brand Agent considers a paid tool only when:

- the Brand enabled paid verification;
- the quoted price is within remaining spend cap;
- the tool is allowlisted;
- the current evidence is insufficient or top candidates are close;
- the data is relevant to a documented ranking component;
- authority permits autonomous API payment.

## 3. Reasoning loop

```text
candidate scores are close / confidence low
→ inspect allowlisted tool catalog
→ get quote/payment requirement
→ Policy Engine checks per-run and daily spend caps
→ Agent wallet pays
→ API result returned
→ structured result mapped to candidate score/evidence
→ receipt and effect recorded
```

## 4. Receipt

```json
{
  "receiptId": "receipt-001",
  "matchRunId": "run-001",
  "candidateId": "creator-001",
  "purpose": "CANDIDATE_VERIFICATION",
  "provider": "...",
  "toolId": "...",
  "protocol": "X402",
  "network": "SOLANA_DEVNET_OR_SANDBOX",
  "amountUsdc": 0.02,
  "status": "CONFIRMED",
  "paymentReference": "...",
  "resultDigest": "sha256:...",
  "scoreImpact": {
    "reliabilityFitBefore": 0.7,
    "reliabilityFitAfter": 0.82
  },
  "createdAt": "timestamp"
}
```

Do not display a blockchain transaction if the used mode/protocol produces a different receipt type. Reflect the actual implementation.

## 5. UI events

Success:

```text
후보 검증 API를 사용했어요.
0.02 USDC · 결제 완료
```

Skipped:

```text
무료 정보만으로 후보를 결정했어요.
```

Failure with permitted continuation:

```text
유료 검증을 완료하지 못해 공개 정보만 사용했어요.
```

No silent fallback.

## 6. Security and authority

- allowlisted providers and endpoints;
- fixed maximum response size/time;
- no arbitrary URL/tool selected from model output;
- quote validation;
- per-call, per-run and daily caps;
- idempotency;
- no key/token in prompt or logs;
- sandbox/local mode for development;
- actual configured mode clearly shown.

## 7. P0/P1 treatment

The core product must work without paid verification using confirmed internal data. For hackathon scoring, one real paid verification call is strongly preferred when the current pay.sh environment is stable. It must not block the entire creator negotiation demo if the external provider is unavailable; the fallback policy must be explicit and visible.

## 8. Tests

- cap exceeded blocks payment;
- duplicate request does not double pay;
- tool quote changes are revalidated;
- external failure follows configured continue/stop policy;
- receipt belongs to current Match Run;
- result cannot inject arbitrary ranking weight;
- fake receipt is impossible in live mode.
