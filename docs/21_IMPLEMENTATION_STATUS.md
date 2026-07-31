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
| Dashboard live/replay | IMPLEMENTED | IMPLEMENTED | NOT_STARTED | IMPLEMENTED | IN_PROGRESS | Dashboard now shows aggregate summaries and record lists; actual A2A messages moved to negotiation detail pages; records include connected Creator and agreed work summary |
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
Commit: working tree
Frontend revision: working tree
Product API revision: working tree
A2A revision: e123d02
Web3 revision:
Live URL: local only, http://localhost:3000
Verified at: 2026-07-31
Verifier: Codex local smoke
Brand test account: brand@knot.test
Creator test account: creator@knot.test
Brand ID: brand-e2502cdf-dccf-417e-bf66-7d4590bb87df
Creator ID: creator-d2f40859-7b9a-43b9-a903-eebac64e2499
Match Run ID: match-23618436-362d-4629-bf82-8a96ee3cbc58
Negotiation ID: negotiation-f87b9015-b2bb-4bc9-9698-e5d457e118bc
A2A Task ID: task-dc7ab3b1-16f6-4edc-9bd7-2ef5c2e8418a
Agreement ID: agreement-f3fcceec-9142-42d2-bdda-1ebbd137824d
Deliverables: 릴스 2개, 숏츠 1개, 게시글 1개
Escrow lock signature: not executed; requires explicit on-chain approval and configured signer/funding
Settlement release signature: not executed; requires explicit on-chain approval and configured signer/funding
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
| Backend pytest | Passed | working tree | 2026-07-31 | `.venv/bin/python -m pytest backend/tests/test_api_promotions.py::test_start_negotiation_persists_messages_events_and_agreement backend/tests/test_api_promotions.py::test_start_negotiation_uses_saved_initial_offer_for_counter_flow backend/tests/test_api_a2a_http_integration.py backend/tests/test_api_escrow.py backend/tests/test_escrow_devnet.py -q` (17 passed, 1 skipped devnet) |
| Firestore integration | | | | |
| A2A contract | Passed | working tree | 2026-07-31 | HTTP boundary test starts separate Creator Agent uvicorn server and Product API calls it; saved initialOffer now produces OFFER -> COUNTER -> ACCEPT -> ACCEPT when below Creator policy |
| Creator Agent Card | Passed | working tree | 2026-07-31 | `.venv/bin/python -m pytest backend/tests/test_health_apps.py backend/tests/test_api_a2a_http_integration.py backend/tests/test_api_promotions.py::test_start_negotiation_uses_creator_a2a_http_when_configured -q` (4 passed); public card no longer advertises fixture-only tenant |
| Dynamic account HTTP A2A | Passed | working tree | 2026-07-31 | `.venv/bin/python -m pytest backend/tests/test_a2a_negotiation.py backend/tests/test_health_apps.py backend/tests/test_api_a2a_http_integration.py backend/tests/test_api_promotions.py::test_start_negotiation_uses_creator_a2a_http_when_configured backend/tests/test_api_promotions.py::test_start_negotiation_uses_saved_initial_offer_for_counter_flow backend/tests/test_api_escrow.py backend/tests/test_escrow_devnet.py -q` (32 passed, 1 skipped devnet) |
| Matching no-scan | | | | |
| Reservation race | | | | |
| Web3 local validator | Skipped | working tree | 2026-07-31 | `test_escrow_devnet.py` requires `KNOT_RUN_LOCALNET=1` |
| Devnet smoke | Skipped | working tree | 2026-07-31 | `test_escrow_devnet.py` requires `KNOT_RUN_DEVNET=1`; no on-chain tx executed |
| Two-window E2E | Passed | e123d02 | 2026-07-31 | Local smoke used `brand@knot.test` and `creator@knot.test`; negotiation `negotiation-6264a765-6426-477a-839a-4f8388438f56` has A2A messages OFFER -> COUNTER -> ACCEPT -> ACCEPT with amounts 300 -> 650 -> 650 -> 650 |
| Agent work summary | Passed | working tree | 2026-07-31 | Local smoke created `promotion-d9769dbd-32aa-5623-8d0f-d6dd7e2ec77b`; A2A HTTP messages persisted as OFFER 300 -> COUNTER 650 -> ACCEPT 650 -> ACCEPT 650; negotiation/agreement/creator offer show `릴스 2개, 숏츠 1개, 게시글 1개` |
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
