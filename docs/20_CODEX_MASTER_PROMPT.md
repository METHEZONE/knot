# Codex Master Prompt — KNOT Final Agentic Matching Refactor

저장소를 직접 감사하고 수정하라. 이 작업은 새 프로젝트 생성이 아니라, **현재 동작 중인 KNOT 코드의 안전한 리팩터링 및 실기능 연결**이다.

---

## 0. 최종 목표

KNOT은 다음 문제를 해결한다.

> **KNOT fills the missing layer for human-service transactions in agentic commerce.**

해커톤 MVP에서 실제로 증명해야 하는 흐름:

```text
Creator가 URL 기반 카드 온보딩을 완료하고 Agent를 공개한다.
→ Creator가 브라우저를 닫아도 Agent는 제안을 받을 수 있다.
→ Brand가 제품 URL 기반 카드 온보딩을 완료한다.
→ Brand Dashboard에서 탐색·협상 시작을 누른다.
→ Match Run이 indexed discovery로 후보를 찾고 순위를 매긴다.
→ 최대 3명의 후보와 한 명씩 순차 협상한다.
→ 실제 A2A OFFER → COUNTER → ACCEPT/REJECT가 발생한다.
→ 최초 합의 1건에서 Agreement와 deterministic termsHash가 생성된다.
→ 정책·권한 범위 안에서 Solana devnet escrow가 실제로 lock된다.
→ Creator가 콘텐츠 URL을 제출한다.
→ Gemini observation + deterministic verification을 통과한다.
→ escrow 100%가 Creator wallet로 release된다.
→ 두 Dashboard와 replay가 같은 canonical event/receipt를 보여준다.
```

---

## 1. 반드시 먼저 읽을 문서

아래 순서로 읽고 source of truth로 사용한다.

```text
docs/KNOT_PRODUCT_MASTER_SPEC_FINAL.md
또는 저장소 루트에 설치된 KNOT_PRODUCT_MASTER_SPEC_FINAL.md

docs/00_DOCUMENT_INDEX.md
docs/02_TEAM_MATCHING_DECISION.md
docs/03_USER_FLOWS_AND_INFORMATION_ARCHITECTURE.md
docs/04_CARD_DECK_ONBOARDING_UX.md
docs/05_DASHBOARD_AND_LIVE_AGENT_RUN_UX.md
docs/06_MATCHING_DISCOVERY_AND_RANKING.md
docs/07_AGENT_RUNTIME_AND_MATCH_RUN_STATE_MACHINE.md
docs/08_DATA_MODEL_FIRESTORE_AND_INDEXES.md
docs/09_A2A_NEGOTIATION_PROTOCOL.md
docs/10_API_CONTRACTS_AND_BACKWARD_COMPATIBILITY.md
docs/11_GEMINI_ANALYSIS_AND_POLICY_ENGINE.md
docs/12_PAYSH_X402_PAID_VERIFICATION.md
docs/13_AGREEMENT_ESCROW_EVIDENCE_SETTLEMENT.md
docs/14_SECURITY_PRIVACY_AUTHORITY_AND_CONCURRENCY.md
docs/15_GCP_ARCHITECTURE_DEPLOYMENT_OBSERVABILITY.md
docs/16_TEST_ACCEPTANCE_AND_DEMO.md
docs/17_WBS_AND_IMPLEMENTATION_PLAN.md
docs/18_UI_COPY_AND_STATE_DICTIONARY.md
docs/19_REPOSITORY_MIGRATION_CONFLICT_AVOIDANCE.md
```

기존 v1/v2 문서는 역사 참고용이다. 현재 최종안과 충돌하면 이 문서 세트를 따른다. 다만 설치된 공식 SDK/프로토콜 필드가 문서와 다르면 실제 공식 계약을 확인하고 문서·테스트를 함께 갱신한다.

---

## 2. 절대 지켜야 할 제약

### 디자인

- 현재 KNOT의 기존 디자인을 유지한다.
- 기존 카드, 종이 질감, 폰트, 버튼, Agent 카드, 채팅, 매듭 애니메이션, 레이아웃, 반응형 스타일을 재사용한다.
- 일반적인 SaaS 폼이나 새 디자인 시스템으로 갈아엎지 않는다.
- UI reference branch/commit이 존재하면 컴포넌트를 선별적으로 가져오되 전체 merge하지 않는다.
- 먼저 screenshot baseline을 만든다.

### 기존 서버/API

- 현재 실제로 동작하는 인증, Product API, Firestore, A2A, Agreement, Web3, 배포 설정을 보존한다.
- working endpoint를 삭제하거나 이름을 바꾸지 않는다.
- 필요한 변화는 additive endpoint/optional field/adapter/alias/dual-read migration으로 만든다.
- 기존 코드와 충돌하면 UI를 기존 API에 맞추는 ViewModel/Adapter를 우선한다.
- 관련 없는 대규모 리팩터링을 하지 않는다.

### 실제 Agent

- live/API mode에서 fake 성공, silent mock fallback, timer-driven business state를 금지한다.
- Match Run은 durable backend workflow여야 하며 브라우저가 닫혀도 진행된다.
- 후보 선정은 실제 indexed data와 deterministic ranking에서 나온다.
- 협상 채팅은 실제 A2A Message/Task/Artifact/event에서 나온다.
- replay는 저장된 이벤트를 재생한다. Gemini로 대화를 재생성하지 않는다.
- Gemini는 extraction/proposal/explanation/observation을 담당한다.
- deterministic Policy Engine이 hard filter, 금액, 일정, 권리, 권한, 결제를 결정한다.
- LLM output이 직접 결제를 승인하지 않는다.

### 보안/결제

- private key, seed, mnemonic, service-account JSON, token, cookie, secret을 코드/로그/테스트/문서에 넣지 않는다.
- 상대방의 exact minimum/max, blocked categories, internal policy를 노출하지 않는다.
- Web3 Gateway는 arbitrary transaction payload를 받지 않고 domain operation만 수행한다.
- localnet test + devnet final path를 사용한다. mainnet은 금지한다.
- fake Solana signature/Explorer URL은 금지한다.
- Agreement/escrow/release는 idempotent/exactly-once여야 한다.

### Git

- main에 직접 push하지 않는다.
- 기존 working tree를 덮어쓰지 않는다.
- 별도 branch/worktree를 사용한다.
- phase별로 테스트 가능한 커밋을 만든다.

---

## 3. Git과 기준 브랜치 감사

먼저 아래를 실행한다.

```bash
git fetch --all --prune
git status --short
git branch -a
git remote -v
git log --oneline --decorate --graph --all -n 120
```

아래 값을 실제 증거로 결정한다.

```text
STABLE_BASE             = 현재 안정/배포 backend/API/Web3가 있는 commit/branch
DEPLOYED_COMMIT         = 실제 배포에 사용된 commit
UI_REFERENCE            = 현재 사용자가 유지하길 원하는 디자인 branch/commit/component
```

우선 탐색 후보는 참고일 뿐 강제하지 않는다.

```text
origin/main
origin/master
integration/frontend-backend-api
origin/feat/two-user-session
```

새 branch 이름:

```text
feat/final-agentic-matching-flow
```

이미 있으면 상태를 확인하고 덮어쓰지 말고 suffix를 붙인다.

가능하면:

```bash
git branch backup/pre-final-knot-$(date +%Y%m%d) <STABLE_BASE>
git worktree add ../knot-final -b feat/final-agentic-matching-flow <STABLE_BASE>
cd ../knot-final
```

**절대로 UI reference branch를 통째로 merge하는 것부터 시작하지 마라.**

---

## 4. 코드를 바꾸기 전 감사 산출물

아래 파일을 만든다.

```text
docs/INTEGRATION_AUDIT.md
docs/API_COMPATIBILITY_MATRIX.md
docs/FIRESTORE_MIGRATION_PLAN.md
PLANS.md
```

### INTEGRATION_AUDIT에 포함

- framework, package manager, repo layout;
- current routes and navigation;
- current card onboarding components;
- current Brand/Creator Dashboard;
- Agent/chat/knot animation components;
- authentication init, persistence, role resolution;
- Product API client/proxy;
- OpenAPI/routes/schemas;
- Firestore collections/indexes/rules;
- current mock/fixture/live modes;
- Gemini integration;
- creator matching implementation;
- async worker/queue/PubSub/Cloud Tasks/Workflows 여부;
- A2A SDK, endpoints, AgentCard, Message/Task/Event/Artifact;
- Agreement/termsHash;
- Web3 Gateway/Anchor/escrow/release;
- infra/deploy workflows, Cloud Run services/revisions;
- environment variables and feature flags;
- tests and current failures;
- deployed URLs and health/readiness.

### baseline 실행

실제 repo에 있는 명령을 확인하여 실행한다.

- frontend typecheck/lint/unit/build;
- backend lint/type/test;
- Web3 gateway/Anchor build/test;
- emulator/integration;
- `healthz/readyz`;
- live URL smoke if credentials and network allow.

기존 실패와 새 실패를 구분해 기록한다.

---

## 5. 제품 결정 — 임의 변경 금지

### Match Run 의미

```text
Brand Agent 1회 실행
= funded Agreement 1건을 만들기 위한 Match Run 1건
```

MVP 기본값:

```text
targetAgreementCount = 1
maxCandidates = 3
maxRoundsPerCandidate = 3
mode = SEQUENTIAL
```

- 후보 1 결렬 → 후보 2 → 후보 3.
- 최초 Agreement에서 탐색 종료.
- 세 후보 모두 실패하면 `EXHAUSTED`.
- Agreement 후 escrow 실패 시 다음 후보로 넘어가지 않는다. 기존 Agreement/escrow를 복구한다.
- Promotion당 활성 Match Run 1건.

### Creator Agent

- Creator owner가 동시에 온라인일 필요가 없다.
- `PUBLISHED`, `acceptingOffers`, `availability`, capacity를 분리한다.
- request-driven shared runtime을 사용한다.
- MVP 동시 협상 1, 동시 협업 1.

### 후보 선정

- 사용자는 후보를 수동 선택하지 않는다.
- Agent가 검색/평가/선택한다.
- UI는 선택 결과와 safe reason만 보여준다.

### 매칭

```text
indexed hard filter
→ vector Top 100
→ deterministic Top 20
→ optional paid verification Top 3
→ reservation
→ A2A
```

점수:

```text
semanticMoodFit      35
categoryAudienceFit  20
formatFit            15
scheduleFit          10
coarseBudgetFit      10
reliabilityFit       10
```

Gemini가 final ranking을 임의로 변경하면 안 된다.

### MVP settlement

- 콘텐츠 1개;
- milestone 1개;
- verification 후 100% release;
- legacy 30/70 UI/로직을 실제 계약과 다르게 유지하지 않는다.

---

## 6. 문서/도메인 설치

현재 docs를 무조건 삭제하기 전에 운영 runbook 여부를 감사한다.

- 최종 docs를 source of truth로 설치한다.
- 루트 `AGENTS.md`를 `AGENTS_PATCH.md` 규칙에 맞게 갱신한다.
- 오래된 `Do not implement onboarding`, legacy flow 지침을 제거한다.
- 새 canonical code/DB 용어는 `Promotion`, `MatchRun`, `MatchCandidate`, `Negotiation`, `Agreement`, `Escrow`, `Evidence`, `Settlement`다.
- legacy `campaign`, `deal`, `dealBrief`는 migration adapter 안에서만 읽을 수 있다.

---

## 7. 구현 구조 — 기존 코드에 맞춰 최소 변경

권장 논리 계층:

```text
Product API
├─ Analysis Service
├─ Creator Discovery Repository
├─ Matching/Ranking Service
├─ Reservation Service
├─ Match Run Orchestrator
├─ Brand Agent Runtime
├─ Creator A2A Server/Runtime
├─ Policy Engine
├─ Agreement Service
├─ Evidence Verification Service
└─ Web3 Gateway client
```

기존 monolith/module이 이미 이 역할을 하면 분리 배포하지 말고 interface만 명확히 한다.

Frontend:

```text
Existing visual component
→ ViewModel hook
→ live adapter
→ existing/additive API client
```

mock type에 UI를 직접 묶지 않는다.

---

## 8. Phase별 구현

각 Phase 끝에 관련 테스트, screenshot/evidence, status update, commit을 수행하고 다음으로 넘어간다.

### Phase 1 — compatibility/domain

- final docs/AGENTS 설치;
- canonical enums/types 추가;
- legacy field/route adapter;
- API compatibility tests;
- existing UI/API build 유지.

Commit:

```text
docs: adopt final KNOT agentic matching specification
```

### Phase 2 — live card-deck onboarding

기존 디자인을 그대로 사용하여:

Brand cards:

```text
product URL
→ analysis
→ product confirm
→ mood
→ format
→ target/max budget
→ deadline
→ rights
→ verification spend cap
→ wallet/authority
→ summary
```

Creator cards:

```text
profile URL
→ analysis
→ profile confirm
→ mood
→ formats
→ target/min rate
→ lead time
→ rights
→ blocked categories
→ settlement wallet
→ publish summary
```

요구:

- server-side secure URL fetch;
- Gemini structured output;
- unknown/confidence;
- user edits/confirmation;
- card state backend resume;
- no fabricated metrics;
- embedding generation only after confirmation;
- completion idempotent;
- Brand completion does not start run;
- Creator completion can publish Agent.

Commit:

```text
feat: connect existing card onboarding to live agent profiles
```

### Phase 3 — Creator Agent publication/index

- publication status, acceptingOffers, availability, capacities 분리;
- publish/pause/resume API;
- `creatorDiscoveryProfiles` read-optimized projection;
- no private minimum/blocked policy in index;
- projection update jobs;
- vector/composite index config;
- idempotent backfill script;
- owner/privacy tests.

Commit:

```text
feat: publish creator agents and maintain discovery projections
```

### Phase 4 — scalable matching

- `CreatorDiscoveryRepository` interface;
- no unbounded collection read;
- indexed hard filters;
- private eligibility server check;
- vector Top 100;
- detailed reads Top 20;
- deterministic score/tie-break;
- safe explanation;
- candidate snapshot with version/score components;
- no-scan guard test.

Commit:

```text
feat: rank creator agents with bounded indexed discovery
```

### Phase 5 — durable Match Run

- start/get/cancel/timeline/events APIs;
- HTTP 202 for async start if compatible;
- reuse current durable mechanism;
- if none, introduce `AgentRunDispatcher` and managed authenticated worker adapter;
- browser closure safe;
- worker lease/idempotency/retry/reconciliation;
- max three sequential candidates;
- one active run per Promotion;
- persisted canonical events.

Commit:

```text
feat: orchestrate durable one-agreement match runs
```

### Phase 6 — reservation/concurrency

- Firestore transaction lease;
- five-minute default TTL, extension on progress;
- one active negotiation/collaboration capacity in MVP;
- release on reject/expire/error;
- convert after funded Agreement;
- two-brand race test;
- policy/profile/authority snapshots.

이 기능은 Phase 5와 한 커밋으로 합쳐도 되지만 테스트는 분리한다.

### Phase 7 — actual A2A

기존 A2A implementation/SDK를 보존하고 실제로 연결한다.

- selected candidate AgentCard lookup;
- service auth/tenant validation;
- initial OFFER;
- same Task/context multi-turn COUNTER;
- ACCEPT/REJECT;
- final Artifact;
- Message ID dedupe;
- terminal immutability;
- persisted Task/events/artifact;
- private policy absent;
- Creator browser offline E2E.

Installed official SDK가 문서 구조와 다르면 공식 contract에 맞추고 문서/contract test를 갱신한다.

Commit:

```text
feat: execute real asynchronous A2A negotiations
```

### Phase 8 — existing-design Dashboard/live/replay

Brand:

- `탐색·협상 시작`;
- current run/result;
- collaborations/money/activity/history.

Creator:

- `제안 받기` persistent state;
- current negotiation/funded collaboration;
- evidence/settlement/history.

Live Run:

- real candidate snapshot events;
- optional paid verification event;
- actual A2A chat bubbles;
- knot motion only after Artifact/Agreement;
- real escrow operation states;
- close/reopen/reconnect;
- deterministic replay;
- Technical Proof panel.

금지:

- `setTimeout`으로 business status 변경;
- client에서 success event 생성;
- mock fallback.

Commit:

```text
feat: render canonical agent runs in existing KNOT experience
```

### Phase 9 — pay.sh/x402

현재 integration을 감사한 뒤:

- allowlisted tool;
- quote;
- per-call/run/daily cap;
- conditional trigger only;
- idempotent payment;
- receipt/result digest/score impact;
- explicit failure and free-signal continuation policy;
- sandbox/local and configured real smoke.

pay.sh failure를 fake success로 바꾸지 않는다. Core matching은 internal confirmed data로 동작해야 한다.

Commit:

```text
feat: purchase bounded candidate verification when needed
```

### Phase 10 — Agreement and escrow

- final Artifact canonicalization;
- deterministic JSON and `termsHash`;
- Agreement exactly once;
- actual current wallet architecture를 문서화;
- autonomous delegated/pre-funded authority가 없으면 UI에 human approval truthfully 표시;
- Web3 Gateway allowlist/spend/idempotency;
- local validator tests;
- devnet lock;
- real signature/Explorer;
- Match Run `COMPLETED` only after configured funded target.

Commit:

```text
feat: bind A2A agreements to devnet escrow
```

### Phase 11 — evidence and release

- creator-owned URL submission;
- secure normalized fetch;
- Gemini observation;
- deterministic verification;
- ambiguous → manual review, no payment;
- one 100% release;
- idempotency/reconciliation;
- real devnet signature;
- both Dashboard projections update.

Commit:

```text
feat: verify creator evidence and release escrow
```

### Phase 12 — final QA/deploy

- all tests;
- query-bound proof;
- security/secret scan;
- two-window E2E;
- creator-offline E2E;
- candidate fallback E2E;
- concurrency race E2E;
- Cloud Run deploy;
- live smoke;
- actual transaction proof;
- README and demo script;
- status final update.

Commit:

```text
release: deploy final KNOT agentic commerce demo
```

---

## 9. Firestore/data 요구

기존 collection을 먼저 매핑한다. Canonical target은 다음을 포함해야 한다.

```text
creatorProfiles
agentPolicies
agentAuthorities
agents / agentRegistry
creatorDiscoveryProfiles
productProfiles
promotions
matchRuns/{run}/candidates
matchRuns/{run}/events
reservations
negotiations/{id}/messages
negotiations/{id}/decisions
a2aTasks/{id}/events
a2aTasks/{id}/artifacts
agreements
escrows/{id}/operations
evidence
verificationResults
settlements
paymentReceipts
```

새로 중복 collection을 만들지 말고 기존 구조와 mapping/adapter를 결정한다.

Discovery index에는 exact private minimum, blocked categories, private notes, raw Gemini output, wallet secret을 넣지 않는다.

모든 query는 bounded limit/index를 사용한다. `stream()` 또는 전체 collection load 후 app filter를 금지한다.

---

## 10. 상태와 이벤트

Canonical Match Run:

```text
READY
QUEUED
DISCOVERING
RANKING
VERIFYING
SELECTING
NEGOTIATING
AGREED
ESCROW_PREPARING
ESCROW_SUBMITTED
ESCROW_CONFIRMED
COMPLETED
EXHAUSTED
CANCELED
FAILED
```

각 transition은 immutable ordered event를 저장한다.

Frontend timeline은 server-safe event projection을 사용한다. raw private snapshot을 frontend에 내려 숨기지 않는다.

---

## 11. API 규칙

- 먼저 existing endpoint matrix를 작성한다.
- working endpoint 삭제/rename 금지.
- new mutating API는 idempotency key를 지원한다.
- long run start는 202 + runId.
- role/ownership checked server-side.
- Dashboard/detail DTO는 safe ViewModel.
- live event sequence/reconnect contract를 테스트한다.
- legacy route/API는 alias/adapter로 유지한다.
- error response에 private policy reason을 leak하지 않는다.

---

## 12. 테스트 필수 목록

### Frontend

- typecheck;
- lint;
- unit;
- production build;
- card keyboard/swipe/back/refresh;
- Dashboard states;
- live reconnect/replay;
- responsive/reduced motion;
- duplicate click.

### Backend

- lint/type/test;
- profile analysis schema;
- matching hard filters/score/tie;
- no-scan/read bounds;
- reservation race;
- Match Run candidate fallback/exhausted;
- idempotency;
- ownership/privacy;
- SSRF/prompt injection;
- reconciliation.

### A2A

- AgentCard contract;
- auth/tenant;
- initial Task;
- same Task multi-turn;
- Message dedupe;
- Artifact;
- terminal immutable;
- private policy absent.

### Web3

- local validator/program;
- termsHash/amount/owner;
- duplicate lock/release;
- unauthorized operation;
- 100% release;
- devnet lock/release signatures.

### E2E

1. Happy path with actual counter and devnet lock/release.
2. Candidate 1 rejects, candidate 2 agrees.
3. All three exhausted.
4. Creator publishes, closes browser, later sees completed result.
5. Two Brands race; one reservation wins.
6. Transaction submitted then API interruption; reconciliation prevents duplicate.

---

## 13. Mock/fixture 규칙

허용:

- unit/integration fixtures;
- Storybook;
- explicit `DEMO_MODE`;
- pay.sh sandbox/local mode with accurate labeling;
- local validator.

금지:

- live API error → fixture success;
- fake social metrics;
- fake A2A Message/Task IDs;
- fake Agreement hash;
- fake Solana signature/Explorer;
- timer-driven success;
- current transaction 실패를 과거 transaction으로 가장.

과거 confirmed transaction을 backup proof로 보여줄 경우 `이전 확인 거래`라고 명시하고 현재 run과 섞지 않는다.

---

## 14. 완료 보고 형식

마지막 응답과 repository status 문서에 다음을 제공한다.

### Git

```text
Working branch:
Stable base:
UI reference:
Commits:
```

### Preserved

```text
Existing auth:
Existing public APIs:
Existing server/deploy services:
Existing Web3/A2A modules:
```

### Added/changed

```text
Routes/components:
API operations/schemas:
Firestore collections/fields/indexes:
Worker/queue:
A2A behavior:
Agreement/Web3:
Migration/backfill:
```

### Verification

```text
Frontend commands/results:
Backend commands/results:
A2A contract results:
Web3 local results:
E2E results:
Cloud Run revisions/URLs:
Match Run ID:
Negotiation/A2A Task ID:
Agreement ID/termsHash:
Escrow signature:
Release signature:
```

### Blockers

실제 credential/permission/external outage 때문에 못한 것만 증거와 함께 `BLOCKED`로 남긴다. 구현하지 않은 것을 완료처럼 말하지 않는다.

### Rollback

- previous branch/tag/revision;
- migration version;
- rollback command/steps;
- irreversible change 여부.
