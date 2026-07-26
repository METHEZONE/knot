# Scope and Glossary

## Terms

- **Account:** Firebase Auth user identity.
- **Profile:** Brand Profile 또는 Creator Profile.
- **Agent:** `Profile + private Policy + shared Runtime`. 별도 학습 모델이나 사용자별 서버가 아니다.
- **Agent Policy:** 결정론적 검증에 사용하는 비공개 조건.
- **Promotion:** 브랜드의 반복 가능한 협찬 모집 단위. 제품명·예산·산출물·사용권·마감일은 여기에 속한다.
- **Offer:** Creator Agent가 받은 Promotion 제안.
- **Match Run:** 한 Promotion에 대한 후보 ranking 실행.
- **Negotiation:** Brand Agent와 Creator Agent의 multi-turn 상호작용.
- **Agreement:** Negotiation Artifact가 만든 최종 구조화 합의.
- **Escrow:** Agreement 금액을 잠그는 온체인 상태.
- **Evidence:** MVP 단일 milestone의 수행 증빙.
- **Dashboard:** 온보딩 후 현재 업무 상태를 보여주는 홈.

## Status

```text
User: ACTIVE | DISABLED | DELETION_PENDING | DELETED
Onboarding: ROLE_REQUIRED | PROFILE_REQUIRED | COMPLETED
Promotion: DRAFT | ACTIVE | MATCHING | NEGOTIATING | AGREED | ESCROW_LOCKED | IN_PROGRESS | COMPLETED | CANCELED | FAILED
Negotiation: CREATED | OFFERED | COUNTERED | ESCALATED | AGREED | REJECTED | EXPIRED | CANCELED | FAILED
Agreement: AWAITING_FUNDING | FUNDED | EVIDENCE_REQUIRED | VERIFICATION_PENDING | RELEASED | FAILED
Escrow: CREATED | LOCK_SUBMITTED | LOCKED | RELEASE_SUBMITTED | RELEASED | FAILED
```

## Deprecated terms

Do not introduce Campaign as the main object, Deal Brief, Society Map, “AI model training” for onboarding, A2A simulation presented as real A2A, or on-chain completion without a confirmed signature.
