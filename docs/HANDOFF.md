# KNOT v2 Handoff

## 1. 한 줄

KNOT은 two-window UI를 사용하는 Agentic Promotion 서비스이며, 실제 Firebase·A2A·Agreement·Solana Escrow를 연결한다.

---

## 2. Source of Truth

```text
docs/KNOT_PRODUCT_MASTER_SPEC_V2.md
docs/00_DOCUMENT_INDEX.md
```

UI:
```text
origin/feat/two-user-session
```

Backend:
```text
verified stable branch
```

---

## 3. 핵심 결정

- Manager 연결 후 Dashboard
- 바로 협상하지 않음
- Creator `협찬 받기`
- Brand `협찬 제안하기`
- Dashboard summary
- Negotiation full chat detail
- rejected history
- `/mypage` one settings
- actual devnet target

---

## 4. 개발 시작

1. `README_REPLACE_EXISTING_DOCS.md`
2. `14_CODEX_EXECUTION_GUIDE.md`
3. `12_MIGRATION_AND_CUTOVER.md`
4. `IMPLEMENTATION_STATUS.md`

---

## 5. 필수 경로

```text
knot/frontend/src/features/onboard
knot/frontend/src/features/settings/SettingsScreen.tsx
```

Agent chat component는 UI branch 전체 검색.

---

## 6. 환경

- Firebase
- GCP project/region
- Firestore
- Cloud Run
- Gemini
- Solana devnet
- wallet/test mint
- service auth
- secrets

실제 값은 Secret Manager/CI에 있다. 문서에 secret을 적지 않는다.

---

## 7. 데모

- Brand tab
- Creator tab
- 240 → 300
- Agreement
- 300 Escrow
- URL
- 30/70

---

## 8. 하지 말 것

- old/new UI mix
- duplicate settings
- timer success
- fake metrics/signature
- mainnet
- private policy leak
- direct main push

---

## 9. 완료 전 확인

- docs status
- tests
- screenshots
- live revisions
- actual signature
- README
- 3-minute video
