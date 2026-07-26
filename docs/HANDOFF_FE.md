# knot 프론트엔드/UX 세션 인계 (2026-07-25, 민성 라인)

새 세션(knot 터미널의 Claude 포함)이 이 문서 하나로 이어받을 수 있게 쓴다.
아키텍처·계약은 `docs/23_EXPERIENCE_PRD_v2.md`(경험 스펙)와 `docs/07_API_CONTRACTS.md`(API)가 원본. 2026-07-25 MVP scope update: 현재 프론트는 제품형 MVP로 리셋했다. `/login`과 `/signup`은 실제 계정 표면처럼 분리했고, 회원가입은 Brand/Creator 선택 후 각 역할 온보딩으로 이어진다. Brand는 `/brand/onboarding -> /brand/products/new -> /brand/negotiate -> /brand/result -> /brand/settlement`, Creator는 `/creator/onboarding -> /creator/criteria -> /creator/result -> /creator/brands/{brandId}`를 기본 흐름으로 둔다. 각 역할에는 `/me`, `/settings`가 있고 `/dev/admin`은 개발자/관리자 상태 확인용이다. 제안, 매칭, 협상은 A2A agent work로 보여주고 사용자는 진행 상태와 최종 결과만 본다.

## 무엇을 했나 (2026-07-25 완료분)

0. **제품형 MVP 리셋** — 너무 넓은 route pack을 버리고 실제 제품처럼 보이는 최소 플로우로 재구성. 숫자 stepper와 내부 sidebar를 제거했다. 온보딩 이후 Brand는 여러 Promotion을 만들 수 있고 Creator는 여러 agent-negotiated offer를 받을 수 있으므로, 전역 헤더는 broad navigation만 처리하고 각 페이지 상단에는 현재 항목 제목만 둔다. Brand: 브랜드 온보딩, 제품/제안서 추가, 크리에이터 매칭+A2A 협상, 협상 결과, escrow 정산. Creator: SNS 분석 온보딩, private 협상 기준, 브랜드별 협상 결과 리스트, 합의 브랜드 상세의 마일스톤/작업 진행/정산. `My`/`Settings`는 계정 route로 페이지 헤더의 작은 action에 둔다. `src/product/dataSource.ts`가 mock data source boundary이고 Firestore/API 구현체로 교체할 수 있다.
1. **API mode 연결** — `NEXT_PUBLIC_KNOT_DATA_MODE=api`와 `KNOT_API_BASE_URL`을 설정하면 `src/product/dataSource.ts`가 실제 Product API를 호출한다. 현재 연결된 backbone은 `GET /promotions` → `POST /promotions/{id}/matches:run` → `GET /match-runs/{id}/candidates` → `POST /match-runs/{id}:start-negotiation` → timeline/Agreement mapping, 그리고 `/brand/settlement`에서 evidence submit/verify, escrow lock, milestone release까지다. 브라우저는 A2A payload를 직접 만들지 않고 Product API projection만 읽는다. Login/signup/onboarding/Promotion creation forms는 Next `/api/v1/[...path]` proxy를 통해 Product API의 `users:bootstrap`, `brands:onboard`, `creators:onboard`, `creators/{id}/criteria`, `promotions`에 저장한다.

1. **PRD v2.1** — `docs/23_EXPERIENCE_PRD_v2.md`. 부화 온보딩(양쪽), Agent Workflow 실행 로그, 협상 시어터+공개 리플레이, 듀얼 대시보드/알림/마일스톤, Tier B(어필리에이트 `go.thezonebio.com/r/{code}`, 온체인 Reputation 리더보드). 8/3 하드 게이트(`17_DEMO_ACCEPTANCE.md`)는 불변. 결정사항: SNS 진단은 **사전 캐시+리플레이**(aside-browser 로컬 수집기, 클라우드는 절대 스크랩 안 함), 플랫폼 IG→YT→X→TikTok, 로그인 = 구글(Firebase)+솔라나 지갑(+데모 계정 유지).
2. **frontend/ 스캐폴드** — Next 16 + TS + Tailwind 4(다크 온리), App Router.
   - `src/lib/api/types.ts` + `client.ts`: 19개 라우트 전부 타입드, `{data,meta}` 언랩, RFC7807 `ProblemError`(violations 포함), 결제 POST에 Idempotency-Key 자동, `explorerLink()`는 signature null(SIMULATED)이면 null.
   - `src/lib/api/provider.ts`: `NEXT_PUBLIC_KNOT_DEMO=1` 또는 API 불가 시 픽스처 데모 모드(180-600ms 지연). API가 답한 ProblemError는 절대 마스킹 안 함.
   - `src/lib/fixtures/`: 시드 계약 그대로(brand-001, creator-001..003, 3라운드 협상 OFFER 500→COUNTER 650→ACCEPT+termsHash, 마일스톤 contract:30/content:70 = 195/455 USDC floor+마지막귀속).
   - 화면: `/`(랜딩 placeholder) · `/brand`(대시보드+KPI) · `/brand/promotions/new`(위저드, 현재 단일 스크롤 785줄) · `/promotions/[id]`(타임라인·후보 테이블·워크플로우 로그·계약/에스크로 카드·액션 레일) · `/creator`(딜 인박스·수익·태스크·진단카드 placeholder) · `/creator/deals/[id]`(증빙 제출→관찰 체크리스트) · `/negotiations/[id]`(협상 시어터: 말풍선/라운드/diff칩/rationale) · `/replay/[negotiationId]`(공개, 금액 블러 기본, X 공유) · NotificationBell(타임라인 이벤트 클라이언트 병합, 30s).
   - 검증: `npm run build`·`npx tsc --noEmit`·lint 전부 그린, 9 라우트 스모크 200. Next 15가 아니라 **16**(create-next-app latest) — params가 Promise인 점 주의.

## 지금 해야 하는 것 (우선순위)

1. **부화 세리머니 + Agent Workflow**:
   - `src/components/AgentAvatar.tsx`가 모노그램 placeholder → 파라메트릭 SVG 캐릭터(ARCA Spirit 방식: 진단 카테고리→팔레트/액세서리).
   - 온보딩 플로우 자체가 아직 없음: `/onboarding/creator`, `/onboarding/brand` 신규 — PRD §4/§5의 스텝(핸들 입력→진단 카드→레이트카드 확인→부화: 매니저가 문 두드리고 걸어와 인사+정책 계약 서명 연출→지갑). 게임 튜토리얼 페이싱, 한 화면 한 결정.
   - 워크플로우: `/brand/promotions/[promotionId]/workflow`에서 A2A, 정책 평가, **pay.sh/x402 API 지출**(심사 핵심 — 화면 시간 배정), evidence verification, devnet escrow/settlement 이벤트를 분리 표시. 이벤트 데이터만으로 구동 — 라운드/상태 발명 금지.
2. **리플레이 OG 이미지** (`/replay/*`): next/og로 에이전트 아바타 2개+"AGREED in N rounds" 카드. X 공유가 진짜 배포 채널.
3. `/brand/promotions/new` 스테퍼화, 랜딩 모션 내러티브.
4. **남은 백엔드 델타**: local-demo account/onboarding persistence는 구현됨. 아직 남은 것은 Firebase Auth 검증, `POST /creators/{id}/ingests`+`GET …/diagnosis`(diagnosis-v1, 결정론 수치+Gemini는 문장만), `GET /replays/{negotiationId}`(공개, 마스킹 기본), Tier B `GET /leaderboard`(온체인 Reputation), `POST /affiliate-links`다.
5. **효창님 확인 2건**: ① 수수료 — 온체인엔 fee bps 코드가 있는데 PRD 불변식은 fee=0: `initialize_config`를 0bps로 초기화(INTEGRATION_PLAN §4-C), UI는 수수료 표시 안 함. ② **지갑 발급/커스터디 인터페이스**(architecture.md §4) — 온보딩이 지갑 pubkey를 받아야 함. **7/28까지 미합의면 블로커.**
6. SNS 수집기: aside-browser 스크립트(로컬 실행)→`creatorIngests/{creatorId}` Firestore. 데모는 "captured {date}" 라벨의 캐시 리플레이(17 §3 정직성 규칙).

## 운영 노트

- 커밋 규칙(AGENTS.md): **유저 명시 승인 후에만 커밋**, 프리픽스 `frontend:`/`docs:`/…, 끝나면 `docs/20_IMPLEMENTATION_STATUS.md` 갱신.
- 용어: 유저 카피는 항상 **Promotion** (campaign 금지 — 온체인 명칭은 내부용).
- SIMULATED 영수증(signature null)은 시뮬레이션 상태로 정직하게 렌더 — explorer 링크 조작 금지.
- 실행: `cd frontend && npm run dev` (데모 강제: `NEXT_PUBLIC_KNOT_DEMO=1`).
- 일정: 제출 **8/3 23:59 KST** · 파이널리스트 8/7 · 데모데이 8/21. WBS(16) 기준 오늘 위치는 7/27-28 구간(맵/타임라인)보다 앞서 있음.
