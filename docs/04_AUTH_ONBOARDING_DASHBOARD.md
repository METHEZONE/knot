# Auth, Onboarding & Dashboard

## 1. Firebase Authentication

- 실제 Firebase email/password 인증
- Firebase ID Token을 Product API에 전달
- `browserSessionPersistence` 사용
- 같은 브라우저의 서로 다른 탭에서 Brand/Creator를 각각 로그인 가능
- role은 backend source of truth
- role card 클릭만으로 production user를 만들지 않는다

```ts
await setPersistence(auth, browserSessionPersistence);
await signInWithEmailAndPassword(auth, email, password);
```

---

## 2. Onboarding 공통 원칙

- `feat/two-user-session/knot/frontend/src/features/onboard`를 UI 기준으로 사용
- 긴 문장형 form을 제거
- URL 또는 username → 분석 → 최소 기준 → Manager
- `매니저 붙이기` 후 Dashboard
- Manager 연결 직후 협상 시작 금지
- API가 분석하지 못한 값을 fake로 표시하지 않는다
- 기존 사용자는 완료한 단계를 다시 입력하지 않는다

---

## 3. Brand Onboarding

### Step 1 — 제품 링크만 주세요

카피:

```text
제품 링크만 주세요
붙여넣으면 나머지는 매니저가 읽어옵니다.
```

입력:
- Product URL

표시/수정:
- 제품명
- 가격
- 카테고리
- 설명
- 이미지

CTA:
- `읽어오기`
- `무드 고르러 가기`

저장:
- Brand source/profile
- Product snapshot

### Step 2-A — 어떤 무드가 좋으세요?

카피:

```text
어떤 무드가 좋으세요?
1 / 10 · ← → 키로도 넘길 수 있어요
```

Interaction:
- image card
- `✕ 아니야`
- `♡ 이런 느낌`

출력:
- moodTags

### Step 2-B — 한도만 정하면 끝이에요

입력:
- 총 예산
- 딜당 한도

설명:

> 매니저가 한 건에 딜당 한도까지는 물어보지 않고 씁니다.

CTA:
- `매니저 붙이기`

저장:
- first Promotion `DRAFT`
- totalBudgetUsdc
- perDealCapUsdc
- Brand Agent Policy
- Brand Agent

완료:
- `availability=OFFLINE`
- `/brand`

---

## 4. Creator Onboarding

### Step 1 — 인스타그램만 연결하면 돼요

카피:

```text
인스타그램만 연결하면 돼요
사용자이름만 알려주세요. 나머지는 매니저가 알아서 봅니다.
```

입력:
- `@username` 또는 Instagram URL

표시:
- handle
- collectedAt
- follower count
- average views
- engagement rate
- reels ratio
- style tags

실제 수집이 없으면 지표를 표시하지 않고 user-confirmed state를 사용한다.

CTA:
- `분석`
- `맞아요, 계속`

### Step 2 — 두 개만 정하면 끝이에요

입력:
1. 마지노선 `minimumBaseUsdc`
2. 안 하는 카테고리 `blockedCategories`

설명:

```text
이 밑으로 들어오는 제안은 매니저가 알아서 거절해요.
돈은 협상해도, 이건 협상하지 않아요.
```

CTA:
- `매니저 붙이기`

저장:
- Creator Profile
- Social Snapshot
- Style Tags
- Creator Agent Policy
- Creator Agent

완료:
- `availability=OFFLINE`
- `acceptingOffers=false`
- `/creator`

---

## 5. Manager 연결과 활성화

### Manager 연결

```text
Agent create/update
→ profileRef
→ policyRef
→ status=ACTIVE
→ availability=OFFLINE
→ acceptingOffers=false
→ onboardingCompleted=true
```

### Creator `협찬 받기`

ON:
- `acceptingOffers=true`
- `availability=AVAILABLE`
- 신규 매칭 대상이 됨

OFF:
- 신규 OFFER를 받지 않음
- 기존 Agreement/Escrow/Settlement는 유지
- 진행 중 Negotiation은 명시적 취소 없이는 계속

대기 문구:

> Mina Agent가 새로운 제안을 기다리고 있어요.

### Brand `협찬 제안하기`

- Draft Promotion 선택 또는 새 Promotion 생성
- Match Run
- 후보 페이지
- 선택된 Creator와 Negotiation 시작

---

## 6. Creator Dashboard

### Manager Card

- Agent name/avatar
- `협찬 받는 중 / 일시 중지`
- baseline
- blocked category count
- recent status
- `/mypage?tab=manager`

Primary:
- `협찬 받기`
- ON 상태에서는 `협찬 받기 중지`

### Settlement Card

- claimable
- pending
- released
- wallet
- `정산 받기`

### Action Required

우선순위:
1. 사용자 승인
2. 게시물 링크 제출
3. wallet 연결
4. 정산
5. 오류 재시도

### Active Sponsorships

- Brand/Product
- stage
- amount
- milestone
- next action

### Sponsorship/Escrow History

- 협상 중
- 합의
- 진행 중
- 완료
- 거절
- 만료

### Recent Agent Activity

최근 3~5개만 표시. 전체는 `/creator/negotiations`.

---

## 7. Brand Dashboard

### Manager Card

- Agent name/avatar
- Draft/Active Promotion
- total budget
- per-deal cap
- recent status

Primary:
- `협찬 제안하기`

### Action Required

- 승인 필요
- Escrow funding 필요
- 콘텐츠 검수
- transaction retry

### Promotions

- Draft
- Matching
- Negotiating
- Active
- Completed

### Active Negotiations

- Creator
- round
- public offer
- status
- next action

### Escrow Summary

- locked
- released
- pending
- failed

### Recent Activity

후보, OFFER, COUNTER, Agreement, Escrow, Evidence, Release.

---

## 8. MyPage

Route:
- `/mypage`

Design:
- `features/settings/SettingsScreen.tsx`

Tabs:
1. 프로필
2. 매니저 기준
3. 지갑·정산
4. 계정

중복 설정 route와 버튼은 제거한다.

---

## 9. Onboarding Migration

추가 필드:

```text
onboardingVersion=2
onboardingStep
onboardingCompleted
managerConnectedAt
```

기존 데이터 매핑:
- source/profile 존재 → source step 완료
- quick policy 존재 → policy 완료
- active Agent 존재 → manager 완료

기존 값을 초기화하지 않는다.
