# Final Demo Scenario And Seed

This document is the active runbook for the XEXYMIX final demo data. It is
scoped to devnet/test data only.

## Reset And Seed

Dry-run locally:

```bash
PYTHONPATH=backend python scripts/seed_xexymix_final_demo.py --target memory --reset-demo
```

Reset the scoped Firestore demo data and install the baseline again:

```bash
ALLOW_DEVNET_DEMO_SEED=true \
PYTHONPATH=backend \
python scripts/seed_xexymix_final_demo.py \
  --target firestore \
  --project knot-dev-503505 \
  --reset-demo \
  --confirm=SEED_KNOT_XEXYMIX_FINAL_DEMO
```

The reset is intentionally bounded. It deletes and recreates:

- XEXYMIX promotion operational documents for `promotion-xexymix-devnet`
  in `matchRuns`, `negotiations`, `agreements`, `agentPaymentEvents`,
  `paymentOperations`, and promotion events.
- Demo creator documents with prefix `creator-xexymix-demo-*`.
- Demo creator agent documents with prefix `agent-creator-xexymix-demo-*`.

It does not delete Firebase Auth users, wallet secrets, Secret Manager secrets,
program accounts, or on-chain transactions.

## Demo Accounts

- Brand: `t1@knot.com` / `000000`
- Creator: `c1@knot.com` / `000000`
- Brand ID: `brand-devnet-phantom`
- Brand Agent: `agent-brand-devnet-phantom`
- Creator ID: `creator-devnet-phantom`
- Creator Agent: `agent-creator-devnet-phantom`
- Brand wallet: `8keJx2mcKFENHcUs4ti79aUurAHrWt8Z4XcQTnKGKks6`
- Creator wallet: `63T8p6c4p1fFC7HmYDEqNtyheqMxnYKmiGqTafpzh8zJ`

## Onboarding Values

If the judges ask to see manual onboarding values, use these exact values.
The seeded accounts are already completed, so this is for replay or explanation.

### Brand

- Brand name: `젝시믹스 XEXYMIX`
- Website: `https://www.xexymix.com`
- Product URL:
  `https://www.xexymix.com/m/product.html?branduid=2067442&xcode=062&mcode=005&scode=002&type=Y&sort=manual&current_category=062005002&search=&GfDT=aGl3UQ%3D%3D`
- Product: `XEXYMIX 애슬레저 퍼포먼스 레깅스`
- Category: `fitness`
- Audience:
  `20-34 여성, 필라테스/러닝/헬스 입문자, 애슬레저 데일리룩 관심 고객`
- Brand restrictions:
  `체형 교정 효과 단정`, `의학적 효능 표현`, `비교 비방`

### Creator

- Creator display name: `민지핏로그`
- Categories: `fitness`, `fashion`, `lifestyle`
- Formats: `reel`, `short`, `post`
- Usage rights accepted: `organicOnly`, `paidBoost30d`
- Minimum lead time: `5 days`
- Monthly capacity: `5`
- Completed deals: `28`
- Minimum/maximum demo rate: `1 USDC`
- Social URL: `https://www.instagram.com/minji.fitlog`
- Blocked industries: `tobacco`, `gambling`, `alcohol`

## Promotion Values

- Promotion ID: `promotion-xexymix-devnet`
- Title: `XEXYMIX 애슬레저 퍼포먼스 레깅스 협찬`
- Objective:
  `필라테스/러닝 루틴에서 제품 착용감, 핏, 움직임을 자연스럽게 보여주는 인스타그램 릴스 1개를 제작한다.`
- Category: `fitness`
- Deliverable: `Instagram reel`, count `1`
- Posting window: `2026-09-01` to `2026-09-08`
- Usage rights: `organicOnly`
- Required disclosures: `#ad`, `#sponsored`
- Prohibited claims: `체형 교정 효과 단정`, `의학적 효능 표현`, `비교 비방`
- Contract amount: `1 devnet USDC`
- Initial offer: `1 devnet USDC`
- Max per creator: `1 devnet USDC`
- Total seeded budget: `30 devnet USDC`
- Agent max rounds: `5`
- Auto escrow: `false` for the demo seed; Phantom/on-chain funding is a separate
  approved action.
- Auto release: `true`
- pay.sh verification: sandbox quote, expected `0.02 USDC`

## Candidate Pool

The seed creates 30 discovery profiles:

- 1 real demo creator linked to `c1@knot.com`: `민지핏로그`.
- 29 additional scoped demo creators: `creator-xexymix-demo-02` through
  `creator-xexymix-demo-30`.

Expected matching shape:

- Discovery profiles: `30`
- Public filter matched: `30`
- Format matched: `30`
- Deterministic ranked: `30`
- Detail reads: `20`
- Detailed eligible candidates: `20`
- Top candidate: `creator-devnet-phantom / agent-creator-devnet-phantom`

The extra candidates are intentionally varied by primary format, reliability,
category ordering, schedule, and private rate. This makes ranking look real
while keeping the selected creator tied to the live Creator demo account.

## Ideal Demo Flow

1. Log in as Brand `t1@knot.com`.
2. Open Brand dashboard and promotion detail for `promotion-xexymix-devnet`.
3. Click the Brand Agent run entry point.
4. Narrate:
   `30명 후보 탐색 → 공개 조건 필터 → Top 20 상세 검토 → deterministic policy ranking → pay.sh/x402 후보 검증 → A2A 협상`.
5. Confirm the selected creator is `민지핏로그`.
6. Open the negotiation detail and show:
   - System pay.sh verification event.
   - Brand Agent offer.
   - Creator Agent acceptance/counter flow.
   - Generated Agreement.
7. Log in as Creator `c1@knot.com`.
8. Open Creator offers and show the same negotiation from the creator side.
9. Open Agreement/settlement view. Explain that contract amount is only
   `1 devnet USDC` to stay within faucet limits.
10. Only run Phantom escrow funding/release if separate on-chain approval and
    test wallet balances are ready.

## Judging Narrative

- Gemini/Vertex proposes explanations and content context.
- Deterministic policy code decides eligibility, ranking, private constraints,
  and payment authorization.
- pay.sh is visible as an agent-paid verification event, not a hidden backend
  fixture.
- Creator private policy remains server-side and is not exposed to the Brand.
- The demo uses real Cloud Run, Firestore, Firebase Auth, HTTP A2A, pay.sh
  sandbox, and Solana devnet proof.
