# KNOT Final Implementation Status

> Update this document after every phase. Do not mark a capability verified without evidence.

## Status legend

- `NOT_STARTED`
- `IN_PROGRESS`
- `BLOCKED`
- `IMPLEMENTED`
- `VERIFIED`
- `DEPLOYED`

## 1. Baseline audit

| Area | Status | Existing source | Evidence | Notes |
|---|---|---|---|---|
| Stable/deployed base identified | NOT_STARTED | | | |
| Existing design reference captured | NOT_STARTED | | | |
| Auth | NOT_STARTED | | | |
| Product API | NOT_STARTED | | | |
| Firestore/indexes | NOT_STARTED | | | |
| Async worker | NOT_STARTED | | | |
| Gemini analysis | NOT_STARTED | | | |
| Matching | NOT_STARTED | | | |
| A2A | NOT_STARTED | | | |
| Agreement | NOT_STARTED | | | |
| Escrow/release | NOT_STARTED | | | |
| Cloud Run | NOT_STARTED | | | |

## 2. Capability matrix

| Capability | UI | API | Firestore | External/A2A/On-chain | E2E | Evidence |
|---|---|---|---|---|---|---|
| Brand card onboarding | IMPLEMENTED | IMPLEMENTED | NOT_STARTED | N/A | IN_PROGRESS | two-user-session UI ported; completion calls authenticated Product API profile create |
| Creator card onboarding | IMPLEMENTED | IMPLEMENTED | NOT_STARTED | N/A | IN_PROGRESS | two-user-session UI ported; completion calls authenticated Product API profile create |
| Creator Agent publish/pause | IMPLEMENTED | IMPLEMENTED | NOT_STARTED | N/A | IN_PROGRESS | `/creator` dashboard uses owner-scoped publish/pause/resume API |
| Discovery projection/index | N/A | NOT_STARTED | NOT_STARTED | NOT_STARTED | NOT_STARTED | |
| Deterministic ranking | N/A | NOT_STARTED | NOT_STARTED | NOT_STARTED | NOT_STARTED | |
| Match Run orchestration | NOT_STARTED | NOT_STARTED | NOT_STARTED | NOT_STARTED | NOT_STARTED | |
| Candidate reservation | N/A | NOT_STARTED | NOT_STARTED | N/A | NOT_STARTED | |
| A2A counteroffer | IMPLEMENTED | IMPLEMENTED | NOT_STARTED | IMPLEMENTED | IN_PROGRESS | Brand dashboard run entry calls Product API promotion creation and `runAgentForPromotion`; persisted messages rendered |
| Agreement Artifact/hash | NOT_STARTED | NOT_STARTED | NOT_STARTED | NOT_STARTED | NOT_STARTED | |
| pay.sh verification | NOT_STARTED | NOT_STARTED | NOT_STARTED | NOT_STARTED | NOT_STARTED | |
| Devnet escrow | NOT_STARTED | NOT_STARTED | NOT_STARTED | NOT_STARTED | NOT_STARTED | |
| Evidence verification | NOT_STARTED | NOT_STARTED | NOT_STARTED | NOT_STARTED | NOT_STARTED | |
| Settlement release | NOT_STARTED | NOT_STARTED | NOT_STARTED | NOT_STARTED | NOT_STARTED | |
| Dashboard live/replay | IMPLEMENTED | IMPLEMENTED | NOT_STARTED | IMPLEMENTED | IN_PROGRESS | Dashboard now shows aggregate summaries and record lists; actual A2A messages moved to negotiation detail pages |
| Technical Proof | NOT_STARTED | NOT_STARTED | NOT_STARTED | NOT_STARTED | NOT_STARTED | |
| Deployment | N/A | N/A | N/A | N/A | NOT_STARTED | |

## 3. Query-bound proof

```text
Discovery implementation:
Public hard-filter query:
Vector index:
Top K:
Maximum detailed profile reads:
Maximum paid tool calls:
Test proving no unbounded scan:
```

## 4. Latest verified E2E

```text
Commit:
Frontend revision:
Product API revision:
A2A revision:
Web3 revision:
Live URL:
Verified at:
Verifier:
Brand test account:
Creator test account:
Match Run ID:
Negotiation ID:
A2A Task ID:
Agreement ID:
Escrow lock signature:
Settlement release signature:
```

Never put passwords, tokens, private keys or seed phrases here.

## 5. Known blockers

Template:

```text
BLOCKER:
IMPACT:
EVIDENCE:
OWNER:
NEXT ACTION:
WORKAROUND FOR DEMO (truthfully labeled):
```

## 6. Test evidence

| Command/suite | Result | Commit | Date | Artifact/log |
|---|---|---|---|---|
| Frontend typecheck | Passed | working tree | 2026-07-31 | `cd frontend && npm run typecheck` |
| Frontend lint | Passed | working tree | 2026-07-31 | `cd frontend && npm run lint` |
| Frontend unit | Passed | working tree | 2026-07-31 | `cd frontend && npm test` (19 passed) |
| Frontend build | Passed | working tree | 2026-07-31 | `cd frontend && npm run build` |
| Backend lint/type | | | | |
| Backend pytest | Passed | working tree | 2026-07-31 | `.venv/bin/python -m pytest backend/tests/test_api_a2a_http_integration.py backend/tests/test_api_escrow.py backend/tests/test_escrow_devnet.py -q` (15 passed, 1 skipped devnet) |
| Firestore integration | | | | |
| A2A contract | Passed | working tree | 2026-07-31 | HTTP boundary test starts separate Creator Agent uvicorn server and Product API calls it |
| Matching no-scan | | | | |
| Reservation race | | | | |
| Web3 local validator | Skipped | working tree | 2026-07-31 | `test_escrow_devnet.py` requires `KNOT_RUN_LOCALNET=1` |
| Devnet smoke | Skipped | working tree | 2026-07-31 | `test_escrow_devnet.py` requires `KNOT_RUN_DEVNET=1`; no on-chain tx executed |
| Two-window E2E | | | | |
| Live URL smoke | | | | |
| Secret scan | | | | |

## 7. Update rule

For each phase:

1. audit or plan;
2. implement;
3. run checks;
4. capture evidence/screenshots/IDs;
5. commit;
6. update this file;
7. deploy only from verified commit.
