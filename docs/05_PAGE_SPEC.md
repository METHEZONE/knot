# Page Specification

## 1. `/login`

목적:
- 실제 Firebase 로그인
- two-window 데모 안내

필수:
- email
- password
- 로그인
- 회원가입
- 오류 메시지
- 세션 확인 loading

카피:

> 창을 두 개 열어 한쪽은 브랜드, 다른 쪽은 크리에이터로 로그인하면 두 Agent의 협상을 나란히 볼 수 있어요.

API:
- Firebase
- `GET /api/v1/me`

완료:
- onboarding 또는 role dashboard

---

## 2. `/onboarding/brand`

### BrandSourceScreen

UI:
- 제품 URL
- 읽어오기
- product fields
- image
- edit

API:
- `POST /api/v1/brand-sources:analyze`
- fallback: URL 저장 + user edit

States:
- empty
- validating
- analyzing
- result
- partial
- error

### BrandMoodScreen

UI:
- 10개 카드
- keyboard
- dislike/like
- selected mood summary

데이터:
- local interaction
- confirmed moodTags 저장

### BrandBudgetScreen

UI:
- total budget
- per-deal cap
- selected mood
- Manager connect

Validation:
- positive amount
- cap <= total
- currency USDC

API:
- Brand onboarding
- Promotion DRAFT
- Agent policy
- Agent activate

---

## 3. `/onboarding/creator`

### InstagramSourceScreen

UI:
- username
- analyze
- metrics
- tags
- confirm

API:
- `POST /api/v1/creator-sources:analyze`

Truthful degraded state:
- 실제 지표 없음
- username/profile URL만 저장
- user-confirmed tags

### CreatorPolicyScreen

UI:
- minimumBaseUsdc
- blocked categories
- Manager connect

Validation:
- minimum >= 0
- blocked categories set
- custom sanitized

API:
- Creator onboarding
- criteria/policy
- Agent activate

---

## 4. `/brand`

Sections:
1. Manager Card
2. Action Required
3. Promotion Cards
4. Active Negotiations
5. Escrow Summary
6. Recent Activity

Primary:
- `협찬 제안하기`

Empty:
- Draft Promotion이 없으면 `첫 Promotion 만들기`

---

## 5. `/creator`

Sections:
1. Manager Card
2. Settlement Card
3. Action Required
4. Active Sponsorships
5. Sponsorship/Escrow History
6. Recent Activity

Primary:
- `협찬 받기`

ON state:
- toggle/status
- waiting animation
- `협찬 받기 중지`

---

## 6. `/brand/promotions/new`

가능하면 Brand onboarding의 compact flow를 재사용한다.

필수:
- product
- mood
- deliverable
- deadline
- budget
- milestone
- usage rights

MVP default:
- Reel 1
- 30/70
- organic-only
- 사용자가 review에서 수정

CTA:
- `Creator 찾기`

---

## 7. `/brand/promotions/[id]/candidates`

Card:
- handle/name
- score
- public reasons
- reels ratio
- mood match
- availability warning
- selected state

CTA:
- `에이전트 협상하기`

Privacy:
- minimumBaseUsdc 미표시
- blocked categories 상세 미표시
- private notes 미표시

---

## 8. Negotiation List

Routes:
- `/brand/negotiations`
- `/creator/negotiations`

Filters:
- 전체
- 진행 중
- 승인 필요
- 합의
- 거절
- 만료

Card:
- 상대
- product/promotion
- current amount
- status
- last public activity
- updatedAt

---

## 9. Negotiation Detail

Routes:
- `/brand/negotiations/[id]`
- `/creator/negotiations/[id]`

Header:
- Agent avatar/name
- state
- 상대/Promotion
- MyPage로 가는 중복 설정 버튼 없음

Timeline:
1. Manager intro
2. offer arrival/candidates
3. Agent-to-Agent conversation
4. policy result
5. approval
6. Agreement
7. Escrow
8. Evidence
9. next action
10. settlement

Agent exchange:
- actor
- amount badge
- message
- public rationale
- timestamp
- typing state

Approval panel:
- 승인
- 조건 수정
- 거절

Agreement card:
- deliverables
- amount
- split
- deadline
- termsHash

Escrow card:
- network
- amount
- status
- milestones
- signature/explorer

---

## 10. `/creator/sponsorships/[agreementId]`

목적:
- Agreement 이후 수행·정산 중심

표시:
- Brand/Product
- Agreement
- Escrow
- evidence form
- milestone
- receipts
- next action

Creator CTA:
- `게시물 링크 제출`
- `정산 받기`

---

## 11. Agreement Detail

- canonical terms
- parties
- amount
- rights
- deadline
- milestones
- Agreement ID
- termsHash
- related Negotiation
- Escrow state

Developer details는 접힌 영역.

---

## 12. Escrow Detail

- asset
- network
- locked
- released
- remaining
- milestones
- operation history
- transaction receipts
- Explorer
- error/retry if allowed

---

## 13. `/mypage`

Design:
- `SettingsScreen.tsx`

Tabs:
- 프로필
- 매니저 기준
- 지갑·정산
- 계정

Creator:
- Instagram
- style tags
- baseline
- blocked categories
- availability default
- payout wallet

Brand:
- brand/product
- total budget default
- per-deal cap
- approval defaults
- funding wallet

---

## 14. Error/Empty

404:
> 해당 기록을 찾을 수 없어요.

403:
> 이 기록을 볼 권한이 없어요.

API error:
> 잠시 문제가 생겼어요. 다시 시도해 주세요.

No offers:
> Mina Agent가 새로운 제안을 기다리고 있어요.

No Promotion:
> 제품을 연결하고 첫 협찬 프로젝트를 만들어보세요.

No settlement:
> 아직 정산 가능한 금액이 없어요.
