# KNOT v2 Implementation Status

> 이 문서는 **코드·테스트·배포 증거를 확인한 뒤 갱신**한다.  
> 이전 대화나 오래된 배포 상태를 현재 사실로 간주하지 않는다.

## Status Legend

- `NOT_STARTED`
- `IN_PROGRESS`
- `BLOCKED`
- `IMPLEMENTED`
- `VERIFIED`
- `DEPLOYED`

---

## 1. Baseline Audit

| 영역 | 상태 | 증거 | 비고 |
|---|---|---|---|
| UI branch runs | NOT_STARTED | | |
| Stable backend identified | NOT_STARTED | | |
| Auth | NOT_STARTED | | |
| Firestore | NOT_STARTED | | |
| A2A | NOT_STARTED | | |
| Agreement | NOT_STARTED | | |
| Escrow | NOT_STARTED | | |
| Settlement | NOT_STARTED | | |
| Cloud Run | NOT_STARTED | | |

---

## 2. v2 Feature Matrix

| Feature | Status | Test/Commit/URL |
|---|---|---|
| Firebase per-tab login | NOT_STARTED | |
| Brand onboarding | NOT_STARTED | |
| Creator onboarding | NOT_STARTED | |
| Manager connect | NOT_STARTED | |
| MyPage unified | NOT_STARTED | |
| Creator dashboard | NOT_STARTED | |
| Brand dashboard | NOT_STARTED | |
| Creator availability | NOT_STARTED | |
| Brand proposal run | NOT_STARTED | |
| Candidate list | NOT_STARTED | |
| Negotiation history | NOT_STARTED | |
| Rejected negotiation | NOT_STARTED | |
| Real A2A counter | NOT_STARTED | |
| Human approval | NOT_STARTED | |
| Agreement Artifact | NOT_STARTED | |
| termsHash | NOT_STARTED | |
| Devnet escrow lock | NOT_STARTED | |
| Evidence URL | NOT_STARTED | |
| Milestone release | NOT_STARTED | |
| Explorer receipt | NOT_STARTED | |
| E2E | NOT_STARTED | |
| Deployment | NOT_STARTED | |

---

## 3. Known Blockers

코드 감사 후 작성한다.

Template:

```text
BLOCKER:
IMPACT:
EVIDENCE:
OWNER:
NEXT ACTION:
```

---

## 4. Latest Verified Build

```text
Commit:
Frontend revision:
Backend revision:
Web3 version:
URL:
Verified at:
Verifier:
```

---

## 5. Update Rule

각 Phase:
1. code audit
2. implementation
3. tests
4. screenshots
5. commit
6. status update

`IMPLEMENTED`는 코드 존재, `VERIFIED`는 test 통과, `DEPLOYED`는 live smoke 통과를 뜻한다.
