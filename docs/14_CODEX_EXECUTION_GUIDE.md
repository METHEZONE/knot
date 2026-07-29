# Codex Execution Guide

## 1. 목표

two-window UI를 frontend 기준으로 사용하고 기존 실제 API·A2A·Web3를 연결한다.

---

## 2. 시작 Prompt

```text
docs/KNOT_PRODUCT_MASTER_SPEC_V2.md와 docs/00_DOCUMENT_INDEX.md를 최우선 source of truth로 사용하라.
docs/archive 또는 git history의 구버전 기획을 구현 요구사항으로 사용하지 마라.
Frontend UI/UX는 origin/feat/two-user-session을 기준으로 하고,
Backend/API/Web3는 실제 기능이 동작하는 안정 브랜치를 유지하라.
Phase별로 조사, 구현, 테스트, 커밋, 상태 문서 갱신을 수행하라.
main에 직접 push하지 마라.
```

---

## 3. 작업 준비

```bash
git fetch --all --prune
git status --short
git branch -a
```

- 미커밋 WIP 보존
- backup branch
- UI branch 기반 worktree
- stable backend base 결정

---

## 4. 조사

필수 검색:

```bash
git grep -n "제품 링크만 주세요" origin/feat/two-user-session
git grep -n "인스타그램만 연결하면 돼요" origin/feat/two-user-session
git grep -n "Mina Agent" origin/feat/two-user-session
git grep -n "Glow Agent" origin/feat/two-user-session
git grep -n "에이전트끼리 대화" origin/feat/two-user-session
```

Backend:
- auth
- API
- Firestore
- A2A
- Agreement
- escrow
- settlement

결과:
- `docs/V2_BRANCH_AND_API_AUDIT.md`

---

## 5. Phase

### 1 Reference
- UI run
- screenshots
- no redesign

### 2 Auth/Onboarding
- Firebase
- role
- two-window onboarding
- actual persistence
- Manager semantics

### 3 MyPage
- SettingsScreen
- redirects
- duplicate removal

### 4 Dashboard
- live role view
- activation
- history/summary

### 5 Promotion/Negotiation List
- DRAFT
- candidates
- multiple negotiations
- rejection

### 6 A2A Detail
- actual HTTP
- multi-turn
- timeline

### 7 Agreement/Web3
- termsHash
- devnet
- evidence
- release

### 8 Cleanup/Deploy
- mock removal
- tests
- Cloud Run

---

## 6. 금지

- full merge first
- old/new UI mixture
- mock fallback
- timer success
- fake metrics/hash/signature
- private policy exposure
- mainnet
- main direct push
- destructive migration

---

## 7. Commit Plan

```text
docs: establish KNOT v2 source of truth
chore: freeze two-window reference
feat: connect auth and onboarding
refactor: unify mypage settings
feat: build live dashboards
feat: add promotion candidates and history
feat: connect real A2A conversation
feat: connect agreement escrow settlement
test: add E2E visual and security coverage
chore: deploy KNOT v2
```

---

## 8. 매 Phase 완료 조건

- relevant tests
- screenshots if UI
- `IMPLEMENTATION_STATUS.md`
- no silent limitation
- commit

---

## 9. 최종 보고

- base branches
- files reused
- files removed
- migrations
- endpoints
- A2A proof
- signatures
- screenshots
- tests
- deploy
- blockers
- commits
