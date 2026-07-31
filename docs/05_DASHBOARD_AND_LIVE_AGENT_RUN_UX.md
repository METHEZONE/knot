# Dashboard and Live Agent Run UX

## 1. Core principle

The Dashboard is an Agent Control Room, not a generic analytics page and not the full chat transcript.

It must communicate:

```text
agent availability
current work
latest result
money state
true human action
```

## 2. Brand Dashboard

### Agent control card

#### Ready

```text
Brand Agent
준비 완료

{productName}
{moods}
{format}
목표 {target} · 최대 {max} USDC
{deadline}

조건에 맞는 크리에이터를 찾고,
합의 한 건이 만들어질 때까지 순서대로 협상합니다.

[탐색·협상 시작]
```

#### Running

Show real current state:

- current phase;
- candidate count;
- selected creator when available;
- negotiation round;
- last event time;
- `실시간으로 보기`.

#### Completed

Show:

- creator;
- agreed amount;
- escrow state;
- `협업 보기`;
- `협상 다시보기`.

#### Exhausted

Show:

- number of attempted candidates;
- sanitized failure distribution;
- `조건 수정`;
- `다시 실행`.

### Other Brand sections

- 진행 중 협업;
- escrow locked/released totals;
- latest Agent activity 3–5 items;
- previous Match Runs;
- only genuine action-required items.

## 3. Creator Dashboard

### Agent availability card

#### Published and available

```text
Creator Agent
제안 받는 중

최소 기준과 일정은 비공개로 지켜집니다.
브랜드의 제안이 오면 사이트를 닫아도 협상합니다.

[제안 받기 ON]
```

Owner-only summary may show exact private policy values. Counterparty views never do.

#### Negotiating

Show:

- Brand/product public identity;
- current public offer;
- current round;
- `실시간으로 보기`;
- “사이트를 나가도 협상은 계속됩니다.”

#### At capacity

Explain whether new proposals are paused because one collaboration is active.

### Other Creator sections

- funded collaborations;
- escrow-secured amount;
- evidence tasks;
- settlement history;
- previous accepted/rejected negotiations;
- recent Agent activity.

## 4. Match Run detail

The Brand run detail begins before a candidate is selected.

### Phase A — discovery

User-visible events:

```text
조건을 검색 기준으로 바꿨어요.
제안 가능한 Creator Agent를 찾았어요.
제품 분위기와 가까운 후보를 비교했어요.
```

Cards may pass through the screen, but each displayed candidate must correspond to a real stored candidate snapshot. The user cannot select a card.

### Phase B — paid verification

When used:

```text
후보 검증 API 사용
0.02 USDC · 결제 완료
```

The receipt opens in Technical Proof.

### Phase C — selected candidate

```text
@moodbyanna를 선택했어요.

선정 이유
· 무드 적합도 94
· Beauty Reel 가능
· 마감 일정 충족
· Agent 수용 가능
```

Use only safe public reasons. Never reveal that a creator’s private minimum barely passed.

### Phase D — A2A connection

Show the two existing Agent visual cards connecting. This animation begins when the actual A2A initial message has been submitted, not on an arbitrary timer.

### Phase E — negotiation chat

Each bubble is a projection of one persisted A2A Message or decision event.

Example:

```text
Brand Agent
Reel 1개 · 250 USDC · 8월 10일 · Organic only
첫 조건을 제안했어요.
```

```text
Creator Agent
Reel 1개 · 320 USDC · 8월 10일 · Organic only
작업 조건을 기준으로 금액을 조정했어요.
```

Policy/system events appear as a distinct neutral card:

```text
정책 확인
현재 제안은 브랜드의 위임 범위 안입니다.
```

The public rationale is sanitized. Raw prompts, private thresholds, and chain-of-thought are not displayed or stored as UI content.

### Phase F — agreement and knot motion

The knot animation occurs only after the final Artifact and Agreement are persisted.

```text
매듭이 지어졌어요.
```

Then show escrow operation states from real receipts:

```text
에스크로 준비 중
→ 전송됨
→ 확인 완료
```

## 5. Creator run perspective

Creator sees:

- that it was selected;
- public product/Brand information;
- incoming and outgoing public terms;
- its own private policy indicators;
- the same canonical A2A messages;
- Agreement and escrow result.

Creator does not see other candidates or Brand maximum budget.

## 6. Replay

Replay is deterministic:

```text
stored event sequence
→ same timestamps/order
→ same public messages
→ same receipts
```

Never call Gemini to recreate the conversation for replay. A generated summary may be added separately and labeled as a summary.

## 7. Technical Proof panel

Collapsed by default. Content:

- Match Run ID;
- candidate and score snapshot version;
- Gemini job/model/prompt version without raw secret context;
- A2A context ID, Task ID, Message IDs and Task states;
- pay.sh/x402 receipt where present;
- Agreement ID and terms hash;
- escrow and release operation IDs;
- network, signature and Explorer link;
- correlation IDs and timestamps.

Normal users see only their authorized projection. `/dev/admin` may show sanitized raw protocol payloads.

## 8. Data source badge

Internal/debug builds may show:

```text
LIVE
DEMO FIXTURE
SIMULATED WEB3
```

The final judged happy path must be LIVE with actual devnet signatures. A simulated signature is forbidden.

## 9. Real-time behavior

Preferred:

- SSE or existing real-time channel from Product API;
- Firestore listener only through an existing authorized projection if already used safely.

Fallback:

- polling real API state with backoff.

Not allowed:

- fixed timer that advances business state;
- client-generated success events;
- replay that differs from persisted Task state.

## 10. Two-window demo

Two windows are a demonstration technique, not a system requirement.

```text
Left: Brand Dashboard / Match Run
Right: Creator Dashboard / Negotiation
```

Closing the right window does not stop the Creator Agent. Reopening it loads the same Task and event history.
