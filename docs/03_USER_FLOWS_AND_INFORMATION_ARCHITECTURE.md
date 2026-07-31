# User Flows and Information Architecture

## 1. UX model

KNOT is organized around four experience types:

```text
Story Card Deck
→ Agent Control Room
→ Live Agent Run / Replay
→ Collaboration and Settlement Room
```

The frontend must preserve the current KNOT visual implementation. This document defines behavior and information, not a redesign.

## 2. Common entry

```text
/
→ /login or /signup
→ role resolution
→ incomplete role onboarding
→ role Dashboard
```

Route guards must resolve state from the authenticated backend user, not only local browser state.

## 3. Brand flow

```text
Login
→ Brand card deck
   1. product URL
   2. Gemini loading
   3. product confirmation
   4. mood confirmation
   5. content format
   6. target/max budget
   7. deadline
   8. usage rights
   9. paid verification cap
  10. wallet/authority
  11. summary
→ Brand Dashboard
→ 탐색·협상 시작
→ Match Run created
→ Live Run
   discovery
   ranking
   optional paid verification
   candidate reservation
   A2A negotiation
   Agreement
   escrow
→ Dashboard result card
→ Collaboration room
→ evidence observation
→ settlement
```

The Brand never sees a manual candidate-selection marketplace in the MVP.

## 4. Creator flow

```text
Login
→ Creator card deck
   1. public/Instagram profile URL
   2. Gemini loading
   3. profile confirmation
   4. mood confirmation
   5. supported formats
   6. target/minimum rate
   7. minimum lead time
   8. usage rights
   9. blocked categories
  10. settlement wallet
  11. publish Agent summary
→ Creator Dashboard
→ 제안 받기 ON
→ browser may close
→ A2A proposal arrives asynchronously
→ Creator Agent negotiates
→ Creator later sees live state or replay
→ funded collaboration
→ content URL submission
→ verification
→ automatic settlement
```

## 5. Dashboard responsibility

Dashboard answers:

1. Is my agent available or running?
2. What is it doing now?
3. What result did the latest run produce?
4. Where is the money?
5. What human action is truly required?

Dashboard does not contain the full negotiation transcript. It links to the run/negotiation detail.

## 6. Recommended canonical routes

The exact path may be adapted to the existing router. Existing external paths must remain compatible through redirects or aliases.

### Public

```text
/
/login
/signup
/onboarding/brand
/onboarding/creator
/mypage
```

### Brand

```text
/brand
/brand/promotions
/brand/promotions/new
/brand/promotions/[promotionId]
/brand/runs/[matchRunId]
/brand/negotiations/[negotiationId]
/brand/agreements/[agreementId]
/brand/collaborations/[agreementId]
```

### Creator

```text
/creator
/creator/runs/[matchRunId]
/creator/negotiations/[negotiationId]
/creator/agreements/[agreementId]
/creator/collaborations/[agreementId]
```

### Internal

```text
/dev/admin
/dev/a2a
```

## 7. Route compatibility

Codex must inventory current routes before changing them. Legacy routes should map to canonical resources, not parallel implementations.

Example pattern:

```text
/brand/negotiate
→ current active Match Run or Brand Dashboard

/brand/result
→ most recently referenced Agreement from explicit route state, not a global latest query

/creator/result
→ relevant Negotiation/Agreement based on stored ID
```

Never use “latest object globally” to resolve a route.

## 8. Resource navigation

### Brand navigation

- 홈
- 협찬 프로젝트
- 협상 내역
- 계약/정산
- 사용자 avatar → 마이페이지

Primary CTA:

```text
탐색·협상 시작
```

### Creator navigation

- 홈
- 제안/협상
- 진행 중 협업
- 정산 내역
- 사용자 avatar → 마이페이지

Primary state control:

```text
제안 받기 ON / 일시 중지
```

## 9. Direct URL and refresh

Every detail page reloads canonical data by route ID.

- no memory-only route state;
- 403/404 on unauthorized/not found;
- role-safe projection from the API;
- replay loads persisted events;
- a refresh during a run reconnects to current Task state.

## 10. Notifications

Notification types:

- Match Run started/completed/exhausted;
- selected as a candidate;
- negotiation started/countered/agreed/rejected;
- escrow confirmed/failed;
- evidence required/submitted/verified/revision required;
- settlement confirmed/failed;
- wallet or authority action required.

Every notification links to a canonical resource route.
