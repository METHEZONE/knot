# Information Architecture & Routes

## 1. Navigation 원칙

- 사용자 업무의 중심은 Promotion/협찬 기록이다.
- Agent는 별도 복잡한 Control Center가 아니라 Dashboard와 협상 상세에서 보인다.
- A2A protocol 데이터는 `/dev/admin`에서만 기본 노출한다.
- `/mypage` 하나로 프로필·설정·지갑을 통합한다.

---

## 2. Public Routes

```text
/
 /login
 /signup
 /onboarding/brand
 /onboarding/creator
```

`/onboarding/*`는 내부 step state를 가진다. 새로고침하면 서버의 onboarding state로 복원한다.

---

## 3. Brand Routes

```text
/brand
/brand/promotions
/brand/promotions/new
/brand/promotions/[promotionId]
/brand/promotions/[promotionId]/candidates
/brand/negotiations
/brand/negotiations/[negotiationId]
/brand/agreements/[agreementId]
/brand/escrows
/brand/escrows/[escrowId]
/brand/settlements
```

Brand 메뉴:

```text
홈
Promotions
협상 내역
정산
```

Global header:
- KNOT logo
- 알림
- 사용자 avatar/name → `/mypage`

---

## 4. Creator Routes

```text
/creator
/creator/offers
/creator/negotiations
/creator/negotiations/[negotiationId]
/creator/sponsorships
/creator/sponsorships/[agreementId]
/creator/escrows
/creator/escrows/[escrowId]
/creator/settlements
```

Creator 메뉴:

```text
홈
제안
진행 중 협찬
정산
```

---

## 5. Common / Dev

```text
/mypage
/dev/admin
/dev/a2a
```

`/dev/*`는 개발 환경 또는 ADMIN role만 접근한다.

---

## 6. 핵심 전환

### Creator

```text
/login
→ /onboarding/creator
→ /creator
→ 협찬 받기 ON
→ /creator/negotiations/[id]
→ /creator/sponsorships/[agreementId]
→ /creator/settlements
```

### Brand

```text
/login
→ /onboarding/brand
→ /brand
→ 협찬 제안하기
→ /brand/promotions/[id]/candidates
→ /brand/negotiations/[id]
→ /brand/agreements/[id]
→ /brand/escrows/[id]
```

---

## 7. Route Guard

Resolution 순서:

```text
Auth loading
→ signed out
→ role missing
→ onboarding incomplete
→ wrong role
→ allowed
```

```ts
type EntryResolution =
  | { kind: "LOADING" }
  | { kind: "SIGNED_OUT"; to: "/login" }
  | { kind: "ROLE_REQUIRED"; to: "/signup" }
  | { kind: "ONBOARDING_REQUIRED"; to: "/onboarding/brand" | "/onboarding/creator" }
  | { kind: "WRONG_ROLE"; to: "/brand" | "/creator" }
  | { kind: "READY" };
```

---

## 8. Legacy Redirect

| 기존 | 새 Route |
|---|---|
| `/brand/me` | `/mypage` |
| `/brand/settings` | `/mypage` |
| `/creator/me` | `/mypage` |
| `/creator/settings` | `/mypage` |
| `/brand/negotiate` | 관련 Negotiation |
| `/brand/result` | 관련 Agreement |
| `/creator/result` | `/creator/negotiations` |
| `/brand/settlement` | `/brand/settlements` |
| `/creator/settlement` | `/creator/settlements` |

Legacy route는 데이터가 없으면 역할 Dashboard로 안전하게 이동한다.

---

## 9. Direct URL / Refresh

- 모든 detail route는 URL parameter로 canonical 데이터를 다시 조회한다.
- 메모리 state만으로 페이지를 구성하지 않는다.
- 권한 없는 ID는 403, 존재하지 않는 ID는 404.
- 마지막으로 생성된 객체를 global query로 찾지 않는다.
- route loader가 현재 사용자와 owner relation을 검증한다.

---

## 10. 알림 진입

알림 유형:
- 신규 제안
- 승인 필요
- 협상 완료
- Escrow funding 필요
- 게시물 제출 필요
- Evidence 검증 결과
- 정산 가능
- Transaction 실패

각 알림은 canonical detail route로 이동한다.
