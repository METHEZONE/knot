# Migration & Cutover

## 1. 전략

```text
Frontend source
= origin/feat/two-user-session

Backend/API/Web3 source
= stable branch
```

기존 엉킨 통합 브랜치를 계속 patch하지 않는다.

---

## 2. Git

1. 현재 변경 커밋
2. backup branch
3. `feat/two-user-session` 기반 worktree
4. backend/web3와 frontend infrastructure만 선택 port
5. 새 branch `feat/knot-v2-product-flow`
6. main direct push 금지

---

## 3. Docs

기존 docs:
- backup tag 또는 branch에 보존
- 현재 docs 폴더는 본 세트로 교체
- old docs를 같은 루트에 남기지 않음
- `00_DOCUMENT_INDEX.md` 갱신
- `AGENTS.md`를 `19_AGENT_RULES.md`에 맞춤

---

## 4. Frontend

유지:
- onboard UI
- SettingsScreen
- Agent chat visual
- styles/assets

가져오기:
- Firebase init/auth
- API client
- wallet
- realtime
- error utilities

제거:
- old onboarding
- duplicate dashboards
- duplicate settings
- mock role production path
- timer business success

---

## 5. Data Migration

Additive:
- onboardingVersion
- onboardingStep
- onboardingCompleted
- Agent availability/acceptingOffers
- source snapshots
- quick policy fields
- Promotion DRAFT from Brand onboarding

Lazy migration:
- 기존 profile/Agent/policy로 완료 step 추론
- duplicate Agent 방지

Backfill:
- dry-run
- counts
- no overwrite
- idempotent

---

## 6. Route Cutover

- new routes deployed
- legacy redirects
- direct URL tests
- old navigation removed
- bookmarked ID handling

---

## 7. Feature Flags

```text
KNOT_V2_UI=true
DEMO_MODE=false in production
DEV_ADMIN=false or protected
ESCROW_NETWORK=devnet
```

Silent fallback 금지.

---

## 8. Phases

1. UI reference screenshots
2. Auth
3. Onboarding
4. MyPage
5. Dashboard
6. Promotion/Candidates
7. A2A
8. Agreement/Escrow/Settlement
9. cleanup/test/deploy

각 phase:
- commit
- test
- status doc update

---

## 9. Cutover Checklist

- backup complete
- migration dry-run
- Firebase domains
- env/secrets
- index deployment
- frontend build
- backend tests
- A2A test
- devnet test
- preview smoke
- production Cloud Run revision
- rollback revision retained

---

## 10. Rollback

Frontend:
- traffic to prior revision

Backend:
- prior revision
- additive schema remains compatible

Data:
- no destructive field removal
- new objects can remain unused

Web3:
- confirmed transaction cannot roll back
- reconciliation and UI visibility required

---

## 11. Stale Reference Search

```bash
rg "01_PRODUCT_PRD|04_AUTH_ONBOARDING|05_PAGE_SPEC|Do not implement onboarding" .
rg "campaign|dealBrief|0x" knot/frontend knot/backend docs
rg "SIMULATED|mock|setTimeout" knot/frontend
```

Each result reviewed.
