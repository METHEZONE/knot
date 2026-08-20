# KNOT Final Presentation Handoff

Purpose: 발표자료 담당자가 이 문서 하나로 슬라이드, 발표 멘트, 데모 흐름을 만들 수 있게 정리한 최종 자료.

Live URL: `https://knot-web-7k3walthgq-uc.a.run.app`

Demo accounts:

- Brand: `t1@knot.com / 000000`
- Creator: `c1@knot.com / 000000`

Current demo data:

- Brand demo user: 1
- Creator demo user: 1
- Promotion: `promotion-xexymix-devnet` 1개
- Creator candidate pool: 30명
- Initial operational records: `matchRuns=0`, `negotiations=0`, `agreements=0`
- Contract amount: `2 devnet USDC`
- Initial offer: `1 devnet USDC`
- pay.sh candidate verification: sandbox, expected `0.02 USDC`

## One-Line Pitch

KNOT은 브랜드와 크리에이터의 협찬 거래를 AI 에이전트가 대신 탐색·검증·협상하고, 합의된 조건은 Solana devnet 에스크로와 증빙 기반 정산으로 연결하는 Agentic Commerce 플랫폼입니다.

Shorter:

> Agents negotiate. Creators create. Solana settles.

Korean version:

> 매니저가 협상하고, 크리에이터가 만들고, 예치금이 신뢰를 보장합니다.

## Problem

크리에이터 협찬은 아직도 DM, 스프레드시트, 수동 송금, 캡처 증빙으로 운영됩니다.

브랜드 문제:

- 후보를 많이 찾을수록 검토와 DM 협상 비용이 폭증합니다.
- 팔로워 수만 보고 고르면 가짜 지표, 낮은 콘텐츠 적합도, 노쇼 리스크를 걸러내기 어렵습니다.
- 콘텐츠가 실제로 올라오기 전 전액 지급하기 부담스럽고, 게시 후 검증과 정산도 수동입니다.

크리에이터 문제:

- 브랜드마다 조건, 가격, 사용권을 매번 DM으로 협상해야 합니다.
- 작업했는데 정산이 늦어지거나, 브랜드가 사후에 조건을 바꾸는 리스크가 있습니다.
- 지갑, USDC, 온체인 같은 용어가 낯설면 Web3 정산의 장점을 써보기도 전에 이탈합니다.

Market wedge:

- 첫 타깃은 크리에이터 협찬/UGC 마케팅입니다.
- 이유: 거래 단가가 작고 반복적이며, 후보 검증·조건 협상·증빙 확인·정산이 모두 사람이 하던 반복 업무입니다.
- 이 영역은 AI 에이전트와 Web3 결제/정산의 가치가 동시에 보이는 좋은 시작점입니다.

## 현직 인터뷰 기반 메시지

발표 전 실제 인터뷰 대상의 실명/직함 공개 가능 여부는 별도 확인하세요. 슬라이드에는 익명으로 `브랜드 마케터`, `인플루언서/UGC 대행사`, `크리에이터 운영자` 정도로 표기하는 편이 안전합니다.

인터뷰에서 어필할 핵심 문장:

- "현업자들이 공통적으로 말한 병목은 매칭 자체보다 후보 검증, 조건 조율, 정산 신뢰였습니다."
- "브랜드는 많은 후보를 빠르게 보고 싶지만, 최종 선택은 브랜드 정책과 예산 한도 안에서 설명 가능해야 한다고 했습니다."
- "크리에이터 쪽에서는 조건이 불명확한 DM 제안, 늦은 정산, 사용권 범위 불명확성이 반복 문제였습니다."
- "그래서 KNOT은 단순 추천 서비스가 아니라 후보 검증 → 에이전트 협상 → 계약 → 에스크로/정산까지 하나의 거래 흐름으로 설계했습니다."

문제와 반영 결과:

| 현업 피드백 | 제품 반영 |
|---|---|
| 후보가 많아도 실제로 맞는 사람을 고르기 어렵다 | 30명 후보 풀 → 공개 조건 필터 → Top 20 상세 검토 → deterministic ranking |
| AI가 돈을 쓰거나 계약을 결정하면 불안하다 | Gemini는 제안/요약, deterministic policy가 최종 승인 |
| 가짜 지표/품질 낮은 계정을 걸러야 한다 | pay.sh/x402로 후보 검증 API를 Agent가 구매하고 영수증 기록 |
| 협찬 조건은 DM으로 하면 누락이 많다 | A2A 협상 메시지와 Agreement terms/hash로 조건 고정 |
| Web3 지갑은 일반 유저에게 어렵다 | UI는 `예치 지갑`, `정산 받을 지갑`, `계약`, `정산` 중심으로 표현 |
| 금액이 크면 완전 자동화가 위험하다 | demo는 소액 devnet USDC, 정책 한도·권한·idempotency 적용 |

## Solution

KNOT은 협찬 거래를 네 단계로 바꿉니다.

1. Brand Manager가 제품/예산/조건을 입력합니다.
2. Brand Agent가 후보를 찾고, 필요하면 pay.sh로 유료 검증 API를 구매합니다.
3. Brand Agent와 Creator Agent가 HTTP A2A 경계를 넘어 조건을 협상합니다.
4. 합의는 Agreement로 고정되고, Solana devnet 에스크로/증빙/정산 흐름으로 이어집니다.

핵심 차별점:

- AI가 단순 추천을 넘어서 다단계 계획과 도구 선택을 수행합니다.
- Agent가 외부 유료 API 호출 비용을 pay.sh/x402로 지불합니다.
- Web3 진입 장벽을 지갑/프로토콜 설명이 아니라 협찬 업무 언어로 감춥니다.
- Solana는 "보여주기용 결제"가 아니라 협찬 거래의 예치/정산 신뢰 레이어로 사용됩니다.

## 심사 기준별 어필 포인트

### 1. AI 기술 자율성 30%

어필할 말:

> KNOT의 AI는 한 번 답변하고 끝나는 챗봇이 아니라, 후보 탐색, 유료 검증 도구 선택, 정책 검증, A2A 협상, 계약 생성을 이어가는 Agent workflow입니다.

구현 근거:

- Gemini/Vertex AI: 제품/크리에이터 콘텐츠 맥락 분석, 설명 생성, 협상 rationale 보조.
- Deterministic policy: 예산 한도, 금지 표현, 사용권, 크리에이터 최소 단가, 일정 조건 승인.
- A2A: Brand Agent와 Creator Agent가 실제 HTTP boundary를 넘어 메시지를 주고받음.
- Agent autonomy: 후보 검증이 필요하면 pay.sh 도구를 선택하고, 비용 한도 안에서 호출.
- Safety: LLM output은 결제/에스크로 권한을 직접 승인하지 않음.

슬라이드에 넣을 구조:

```text
Brand input
→ Agent planning
→ Candidate discovery
→ pay.sh verification
→ deterministic policy check
→ A2A negotiation
→ Agreement
→ Escrow/settlement
```

강조:

- "Gemini proposes; policy code authorizes."
- "프롬프트가 돈을 움직이지 않습니다."
- "비공개 정책은 상대방에게 노출되지 않습니다."

### 2. 비즈니스 가치 및 UX 30%

어필할 말:

> KNOT은 크리에이터 마케팅의 실제 운영 비용을 줄입니다. 후보 탐색, 검증, 협상, 계약, 정산을 한 흐름으로 묶어 브랜드와 크리에이터 모두의 신뢰 비용을 낮춥니다.

비즈니스 가치:

- 브랜드: 후보 탐색/검증/협상 시간을 줄임.
- 크리에이터: 합의 조건과 정산 경로가 명확해짐.
- 플랫폼: SaaS 구독, 검증 API 사용 수수료, 에스크로/정산 operation fee, premium compliance report 가능.

UX 가치:

- 사용자는 `협찬 프로젝트`, `매니저`, `계약`, `예치`, `정산`만 보면 됩니다.
- Passkey/MPC/embedded wallet은 후속으로 지갑 복잡도를 더 낮추는 방향입니다.
- 현재 데모는 Phantom/devnet을 쓰되, 지갑은 돈을 예치하거나 받을 때만 등장합니다.
- YouTube 링크 하나로 크리에이터 공개 지표와 콘텐츠 스타일을 분석합니다.

YouTube onboarding 어필:

- Instagram scraping은 로그인 장벽이 커서 MVP 기본값에서 제외했습니다.
- YouTube는 공개 메타데이터와 YouTube Data API v3로 조회수/좋아요/댓글/구독자 수를 안정적으로 가져옵니다.
- Gemini는 숫자를 만들지 않고, 제목/채널/콘텐츠 맥락을 분석합니다.
- 공개 지표가 없으면 fake하지 않고 `확인 필요`로 남깁니다.

현재 검증된 YouTube Shorts 분석 예:

- Channel: `젝시믹스 xexymix`
- Handle: `@xexymix_official`
- Subscriber count: `6,680`
- Video views: `102,490`
- Likes: `247`
- Comments: `15`
- Channel views: `116,226,700`
- Video count: `471`

### 3. GCP 인프라 확장성 15%

어필할 말:

> KNOT은 데모용 단일 서버가 아니라 Cloud Run 기반의 서비스 경계를 갖고 있습니다. 프론트, API, Creator Agent, Web3 Gateway가 분리되어 있고 Firestore가 business-state source of truth입니다.

사용 중인 GCP:

- Cloud Run
  - `knot-web`: Next.js frontend
  - `knot-api`: Product API, auth, onboarding, dashboard, match/negotiation orchestration
  - `knot-creator-agent`: Creator Agent A2A endpoint
  - `knot-web3`: Solana devnet gateway
- Firestore
  - user/profile/promotion/matchRun/negotiation/agreement/escrow/evidence state
  - creatorDiscoveryProfiles read model
- Firebase Auth
  - Brand/Creator real login
- Vertex AI / Gemini
  - structured analysis and agent reasoning support
- Secret Manager
  - A2A service token
  - settlement signer secret
  - YouTube API key
- YouTube Data API v3
  - Creator onboarding public metrics
- Cloud Build / Artifact Registry
  - image build and deploy path

Current deployed state:

- `knot-web-00023-fqg`
- `knot-api-00027-qlq`
- `knot-web3-00014-hkr`
- `knot-creator-agent-00017-zqc`

확장성 포인트:

- Stateless Cloud Run services, min instances for demo reliability.
- Firestore stores durable business state, so browser refresh does not lose the flow.
- Agent boundaries are HTTP based, so future agents/tools can be separated.
- Secrets are injected through Secret Manager, not committed.
- No browser direct write to canonical business state.

### 4. Solana 온체인 결제 15%

어필할 말:

> Solana는 토큰 전송을 보여주기 위해 붙인 것이 아니라, 협찬 거래의 조건부 예치와 정산 신뢰를 담당합니다.

구현/데모 포인트:

- Agreement terms are hashed.
- Brand funds devnet USDC escrow.
- Evidence verification determines settlement eligibility.
- Release/refund paths are explicit.
- Demo amount is intentionally small: `2 devnet USDC` to avoid faucet constraints.

주의해서 말할 것:

- Demo에서 실제 on-chain funding/release를 수행할 때만 signature/explorer proof를 보여주세요.
- Funding or release를 실행하지 않았다면 "가능한 경로"라고 말하고 성공처럼 말하지 마세요.
- pay.sh는 Creator 보상금이 아니라 Agent 운영비/검증 API 구매 비용입니다.

### 5. 발표력 10%

권장 서사:

1. "협찬은 추천 문제가 아니라 거래 문제입니다."
2. "현업자는 후보 검증, 조건 조율, 정산 신뢰를 병목으로 봤습니다."
3. "KNOT은 이 병목을 Agent workflow로 자동화합니다."
4. "AI는 제안하고, 정책 코드는 승인합니다."
5. "pay.sh는 Agent가 외부 검증 API를 구매하는 증거입니다."
6. "GCP는 실제 서비스 운영 경계와 상태 저장을 담당합니다."
7. "Solana는 조건부 예치와 정산 증명을 담당합니다."

## pay.sh 사용 방안

슬라이드 제목 추천:

> Agent가 직접 유료 검증 API를 구매하는 결제 레일

한 줄 정의:

> pay.sh는 크리에이터에게 돈을 주는 레일이 아니라, AI Agent가 업무 수행 중 필요한 외부 유료 도구를 즉시 구매하는 machine-to-machine 결제 레일입니다.

왜 필요한가:

- Agent가 자율적으로 일하려면 무료 데이터만으로는 부족합니다.
- 후보 진위, 콘텐츠 품질, 브랜드 언급 여부 같은 검증은 외부 유료 API가 필요합니다.
- 사람이 API 키를 발급하고 결제하는 구조는 Agentic Commerce와 맞지 않습니다.
- Agent가 도구를 고르고 실행한다면, 그 도구 사용 비용도 Agent workflow 안에서 통제되고 기록되어야 합니다.

KNOT에서의 역할:

- Brand Agent가 후보 검증 단계에서 pay.sh/x402로 검증 API 호출.
- 결제액, 목적, receipt, result digest를 MatchRun/Negotiation timeline에 기록.
- UI에는 `검증 영수증`으로 표시.
- 검증 결과는 후보 ranking signal이지만, 최종 선택은 deterministic policy가 다시 검증.

사용 가능한 paid verification 예시:

| 단계 | pay.sh로 살 수 있는 도구 | 제품 가치 |
|---|---|---|
| 후보 탐색 | creator quality score, fake follower risk, audience fit | 브랜드가 후보를 빠르게 줄임 |
| 후보 검증 | 공개 지표 cross-check, 콘텐츠 적합도 검증 | AI 추천의 신뢰도 보강 |
| 협상 전 | 예상 단가 벤치마크, 유사 캠페인 성과 데이터 | 제안가가 설명 가능해짐 |
| 계약 후 | 게시물 존재 확인, 브랜드 언급 확인, 금지 표현 감지 | 정산 조건 판단에 사용 |
| 리포트 | 캠페인 proof report, receipt bundle | 브랜드 내부 정산/감사용 자료 |

실행 흐름:

```text
Agent decides verification is needed
→ tool quote received
→ spend cap / allowlist / policy check
→ pay.sh/x402 payment
→ API result received
→ receipt + result digest stored
→ ranking or settlement policy consumes the verified signal
```

권한 통제:

- 브랜드가 Agent budget cap을 설정합니다.
- LLM은 결제를 승인하지 않습니다.
- deterministic policy가 허용 도구, 금액 한도, 목적, 중복 호출 여부를 검사합니다.
- 동일 후보/동일 검증 요청은 idempotency key로 중복 결제를 막습니다.
- 실패한 결제나 불완전한 검증은 성공처럼 표시하지 않고 `확인 필요`로 남깁니다.
- receipt와 result digest는 UI timeline과 내부 cost ledger에 남깁니다.

말해야 하는 분리:

```text
pay.sh = Agent operating expense / paid verification
Solana escrow = Creator compensation
```

BM 연결:

- pay.sh 비용은 브랜드의 Agent 운영 예산에서 차감됩니다.
- KNOT은 paid verification을 묶어서 `검증 크레딧`, `도구 사용 수수료`, `리포트 패키지`로 과금할 수 있습니다.
- 장기적으로 KNOT은 여러 검증 API를 연결하는 Agent tool marketplace/router가 될 수 있습니다.
- Solana escrow 수수료와 pay.sh 검증 수수료는 성격이 다릅니다.
  - pay.sh: 거래 전후의 검증/분석 도구 비용.
  - Solana escrow fee: 합의된 크리에이터 보상금의 예치/정산 운영 수수료.

누가 돈을 내는가:

| 비용 | 부담 주체 | 이유 |
|---|---|---|
| 후보 검증 API | 브랜드 또는 대행사 | 더 좋은 후보를 고르는 비용 |
| 콘텐츠/증빙 검증 API | 브랜드 또는 캠페인 예산 | 정산 조건 확인 비용 |
| Solana escrow funding | 브랜드 | 크리에이터 보상금 예치 |
| 정산 수수료 | 브랜드 또는 양측 계약 조건 | 플랫폼 운영/결제 처리 비용 |
| Creator Pro 기능 | 선택적으로 크리에이터 | 포트폴리오, 자동 견적, 정산 관리 등 |

데모 문장:

> 이 장면에서 Brand Agent는 후보를 고르기 전에 0.02 USDC짜리 검증 API를 pay.sh/x402로 호출합니다. 중요한 점은 이 결제가 크리에이터 보상이 아니라 Agent의 운영비라는 점입니다. 보상금은 별도의 Solana 에스크로로 관리됩니다.

심사위원에게 강조할 점:

- "Agentic Commerce에서 Agent가 진짜 일을 하려면 외부 도구를 구매할 수 있어야 합니다."
- "pay.sh는 그 도구 구매를 결제 영수증과 함께 workflow에 남기는 장치입니다."
- "KNOT은 AI 추천, 결제 영수증, 정책 승인, 온체인 정산을 한 거래 흐름으로 연결합니다."

말하면 안 되는 표현:

- "pay.sh가 크리에이터에게 정산합니다."
- "AI가 자유롭게 돈을 씁니다."
- "검증 API가 모든 리스크를 완전히 제거합니다."
- "Instagram/YouTube의 비공개 데이터를 구매합니다."

더 정확한 표현:

- "pay.sh는 Agent가 허용된 유료 검증 도구를 쓰기 위한 결제 레일입니다."
- "결제 전에는 정책 코드가 예산과 도구 권한을 확인합니다."
- "검증 결과는 의사결정 신호이고, 최종 승인과 정산은 별도 정책과 에스크로 흐름을 거칩니다."

## Business Model 상세

핵심 BM:

> 브랜드와 대행사가 협찬 거래를 더 빠르고 안전하게 운영하도록 Agent workflow 사용료, 검증 도구 사용료, 에스크로/정산 운영 수수료를 받습니다.

수익원:

| 수익원 | 과금 방식 | 대상 고객 | 설명 |
|---|---|---|---|
| SaaS 구독 | 월 구독료 | 브랜드, 대행사 | 프로젝트 수, 팀원 수, Agent run 수 기준 |
| Agent run fee | 실행당 과금 | 브랜드, 대행사 | 후보 탐색/협상 run 단위 |
| Verification markup | API 호출당 과금 | 브랜드, 대행사 | pay.sh로 구매한 검증 API에 플랫폼 수수료 부과 |
| Escrow operation fee | 거래금액의 일정 비율 또는 고정 수수료 | 브랜드 중심 | 계약 생성, 예치, 증빙, 정산 운영 |
| Compliance report | 리포트당 과금 | 브랜드, 대행사 | 영수증, 검증 결과, Agreement hash, settlement proof 묶음 |
| Creator Pro | 선택 구독 | 크리에이터 | 자동 견적, 포트폴리오, 정산 관리, 우선 노출 |
| Tool marketplace | revenue share | API provider | 검증 API provider와 사용량 기반 정산 |

초기 가격 가설:

| 플랜 | 대상 | 구성 | 가격 가설 |
|---|---|---|---|
| Starter | 소형 브랜드 | 월 3개 프로젝트, 기본 후보 추천, 제한된 Agent run | 월 9만~19만원 |
| Growth | D2C/커머스 브랜드 | 월 10~30개 프로젝트, paid verification credit, 협상 자동화 | 월 29만~79만원 |
| Agency | 마케팅 대행사 | 다중 브랜드, 팀 권한, 리포트 export, 대량 후보 검증 | 월 100만원 이상 |
| Enterprise | 대형 브랜드 | 커스텀 정책, 감사 로그, 전용 검증 API, SLA | 별도 계약 |

거래당 과금 예시:

```text
브랜드가 1개 협찬 프로젝트 생성
→ SaaS 구독에 포함된 Agent run 사용
→ 후보 검증 API 5회 사용: pay.sh 결제 + KNOT markup
→ 협상 성사
→ 브랜드가 크리에이터 보상금 에스크로 예치
→ 정산 완료 시 escrow operation fee 또는 report fee 과금
```

단위 경제성 가설:

- 검증 API 원가는 작고 반복 호출됩니다.
- 브랜드는 후보 1명을 잘못 고르는 비용이 검증 API 비용보다 큽니다.
- Agent run과 검증 비용을 캠페인 예산 안에 포함시키면 구매 저항이 낮습니다.
- 거래가 커질수록 에스크로/리포트의 가치가 커집니다.
- 대행사는 여러 브랜드를 반복 운영하므로 SaaS와 usage fee 모두 적합합니다.

왜 pay.sh가 BM에 중요한가:

- KNOT이 직접 모든 검증 데이터를 만들 필요가 없습니다.
- 외부 검증 API를 Agent tool로 붙일수록 제품 가치가 커집니다.
- 사용량 기반 수수료를 만들 수 있습니다.
- Agent가 구매한 도구와 결과가 receipt로 남기 때문에 브랜드에 비용 설명이 쉽습니다.
- 장기적으로 "AI Agent가 업무 중 유료 도구를 구매하는 commerce layer"로 확장할 수 있습니다.

발표용 BM 문장:

> KNOT의 BM은 단순 매칭 수수료가 아닙니다. 브랜드는 Agent workflow 사용료를 내고, Agent가 필요한 검증 API를 pay.sh로 구매하며, 성사된 협찬은 에스크로와 증빙 리포트로 운영됩니다. 즉 SaaS, usage fee, settlement operation fee가 함께 쌓이는 구조입니다.

## GCP 사용 방안

슬라이드 제목 추천:

> GCP는 Agentic Commerce의 운영 계층

각 서비스 역할:

| GCP component | KNOT role |
|---|---|
| Cloud Run | Web/API/Creator Agent/Web3 Gateway 배포 |
| Firestore | durable business state, demo reset/seed, replay |
| Firebase Auth | Brand/Creator 실사용자 로그인 |
| Vertex AI Gemini | 분석/요약/협상 보조 reasoning |
| Secret Manager | A2A token, signer secret, YouTube API key |
| Cloud Build | reproducible container build |
| YouTube Data API v3 | Creator onboarding public metrics |

YouTube API를 꼭 어필해야 하는 이유:

- Instagram scraping은 로그인/차단 때문에 데모 신뢰성이 낮습니다.
- YouTube Data API는 공식 API라 공개 조회수/좋아요/댓글/구독자 수를 안정적으로 가져옵니다.
- Gemini가 지표를 추측하지 않고, 공식 API 숫자와 공개 메타데이터를 기반으로 스타일 분석만 합니다.
- "AI가 지어낸 데이터"라는 리스크를 줄입니다.

발표 문장:

> GCP는 단순 호스팅이 아니라 신뢰 경계입니다. 사용자 인증은 Firebase Auth, 상태는 Firestore, AI reasoning은 Vertex AI, 비밀값은 Secret Manager, 서비스는 Cloud Run으로 분리했습니다. YouTube Data API도 공식 공개 지표 수집 경로로 붙여서 크리에이터 분석이 scraping이나 mock에 의존하지 않게 했습니다.

## Web3를 모르는 사용자에게 편한 이유

질문 예상:

> 사용자가 지갑이나 USDC를 모르면 어떻게 쓰나요?

답변:

- 사용자는 처음부터 블록체인 용어를 배우지 않습니다.
- 브랜드는 협찬 조건과 예산을 입력합니다.
- 지갑은 돈을 실제로 예치할 때만 `예치 지갑`으로 등장합니다.
- 크리에이터는 정산 받을 주소만 관리하면 됩니다.
- UI는 `계약`, `예치`, `정산`, `영수증` 중심으로 설명합니다.
- Passkey/MPC/embedded wallet은 후속 UX로 seed phrase 부담을 줄이는 방향입니다.

중요한 포지셔닝:

- Web3를 숨기는 것이 아니라, 사용자가 이해해야 하는 순간까지 미룹니다.
- 블록체인은 협찬 업무에서 필요한 `돈이 잠겨 있음`, `조건 충족 시 지급`, `영수증`만 보여줍니다.

## Slide Outline

### Slide 1. Title

KNOT

Subtitle: AI agents negotiate creator sponsorships, pay for verification, and settle through Solana escrow.

Visual: Brand Agent → Creator Agent → Agreement → Escrow.

### Slide 2. Problem

Title: 협찬은 아직도 DM과 수동 송금으로 굴러갑니다

Bullets:

- 후보 검증이 어렵다.
- 조건 협상이 느리다.
- 콘텐츠 이행 전 지급은 불안하다.
- 정산/증빙은 수동이다.

### Slide 3. Interview Insight

Title: 현업자가 말한 병목은 "추천"보다 "거래 신뢰"

Bullets:

- 브랜드/대행사: 후보 검증과 조건 조율이 반복 비용.
- 크리에이터: 조건 불명확성과 정산 지연이 리스크.
- 공통: 자동화는 좋지만 돈/계약은 설명 가능해야 함.

Speaker note:

> 그래서 우리는 챗봇이 아니라, 정책과 영수증을 가진 Agent workflow로 접근했습니다.

### Slide 4. Solution

Title: KNOT = Agentic sponsorship transaction layer

Flow:

```text
제품/예산 입력
→ 후보 탐색
→ pay.sh 검증
→ A2A 협상
→ Agreement
→ Solana escrow
→ Evidence settlement
```

### Slide 5. AI Autonomy

Title: Gemini proposes, policy authorizes

Bullets:

- Gemini/Vertex AI: 맥락 분석, 스타일/카테고리 추출, 설명 생성.
- Policy engine: 예산, 금지 조건, 일정, 사용권, 결제 한도 승인.
- A2A: Brand Agent와 Creator Agent가 실제 HTTP boundary에서 협상.
- No chain-of-thought or private policy exposure.

### Slide 6. pay.sh

Title: Agent-paid verification with pay.sh/x402

Bullets:

- Agent가 후보 검증 API를 직접 구매.
- `0.02 USDC` sandbox receipt.
- Timeline에 검증 영수증 표시.
- Creator compensation과 분리.

Visual:

```text
Candidate confidence low
→ quote
→ spend cap policy
→ pay.sh/x402 receipt
→ ranking signal
```

### Slide 7. GCP

Title: Cloud-native Agent workflow

Bullets:

- Cloud Run: Web/API/Agent/Web3 services.
- Firestore: durable state and replay.
- Firebase Auth: real user login.
- Vertex AI Gemini: structured analysis.
- Secret Manager: API keys and service tokens.
- YouTube Data API: public creator metrics.

### Slide 8. Solana

Title: Escrow turns promises into verifiable settlement

Bullets:

- Agreement terms hash.
- Devnet USDC escrow.
- Evidence-based milestone release.
- Explorer/signature proof when executed.

Do not overclaim:

- If no live transaction is run during presentation, say "implemented path / prepared path" instead of "completed".

### Slide 9. Live Demo

Title: XEXYMIX sponsorship simulation

Show:

- 30 creators.
- Top 20 detail review.
- Selected creator `민지핏로그`.
- pay.sh verification event.
- Offer `1 USDC`.
- Counter `2 USDC`.
- Agreement creation.

### Slide 10. Business Model

Title: SaaS + Usage + Settlement

Bullets:

- Brands and agencies pay for Agent workflow automation.
- pay.sh enables usage-based paid verification.
- Solana escrow enables settlement operation fees.
- Compliance reports turn receipts, agreement hashes, and settlement proofs into paid deliverables.
- Long-term: KNOT becomes an Agent tool marketplace for creator commerce.

### Slide 11. Why Now

Bullets:

- AI agents can plan and negotiate.
- pay.sh/x402 makes machine-paid APIs practical.
- Solana devnet shows fast, low-cost programmable settlement.
- GCP makes this deployable as real services, not a mock.

### Slide 12. Closing

KNOT fills the missing layer for human-service transactions in agentic commerce.

## Live Demo Script

### Preflight

- URL: `https://knot-web-7k3walthgq-uc.a.run.app`
- Login starts logged out.
- Use one browser profile.
- If showing Phantom funding, Phantom network must be Devnet.

### Step 1. Brand login

Login:

- `t1@knot.com`
- `000000`

Go to:

- `/brand/promotions/promotion-xexymix-devnet`

Say:

> 브랜드는 XEXYMIX 제품과 협찬 조건을 이미 입력해 둔 상태입니다. 지금부터 Brand Agent가 후보를 찾고 협상합니다.

### Step 2. Run Brand Agent

Click Brand Agent run entry point.

Expected story:

- 30 creator discovery profiles.
- 20 detailed eligible candidates.
- Top candidate: `민지핏로그`.

Say:

> 여기서 Gemini는 콘텐츠 맥락을 돕고, 실제 선택은 정책 코드가 예산·카테고리·일정·사용권 조건을 다시 검증합니다.

### Step 3. Show pay.sh event

Open negotiation detail.

Show:

- System verification event.
- Verification receipt.
- `0.02 USDC`.

Say:

> 이 결제는 크리에이터 보상금이 아닙니다. Agent가 후보 검증 API를 구매한 운영비이고, pay.sh/x402 영수증으로 남습니다.

### Step 4. Show negotiation

Expected messages:

- Brand Agent: offer `1 USDC`.
- Creator Agent: counter `2 USDC`.
- Brand Agent: accept.
- Creator Agent: final accept.
- Agreement created.

Say:

> 두 에이전트가 HTTP A2A 경계를 넘어 협상합니다. 사람은 채팅을 이어가지 않아도 되고, 각자의 비공개 정책은 상대방에게 노출되지 않습니다.

### Step 5. Creator side

Logout.

Login:

- `c1@knot.com`
- `000000`

Open Creator offers or Agreement page after negotiation exists.

Say:

> 같은 거래를 크리에이터 관점에서 보면, 제안 조건과 정산 경로가 명확하게 보입니다.

### Step 6. YouTube onboarding optional demo

Go to:

- `/creator/connect`

Input example:

```text
https://youtube.com/shorts/clgsVltRPyU?si=NxP6nqRp68mxRDnH
```

Expected:

- Channel: `젝시믹스 xexymix`
- Handle: `@xexymix_official`
- Subscriber/video/like/comment metrics shown.

Say:

> 크리에이터 분석은 scraping이 아니라 YouTube Data API와 공개 메타데이터를 씁니다. Gemini는 숫자를 만들지 않고, 공개 지표와 콘텐츠 맥락을 바탕으로 스타일을 분석합니다.

### Step 7. Escrow note

If on-chain demo is ready:

- Brand wallet signs funding.
- Show devnet signature.
- Evidence submission and settlement if configured.

If not running on-chain live:

Say:

> 오늘 데모 금액은 faucet 제한 때문에 2 devnet USDC로 작게 설정했습니다. 온체인 funding/release는 준비된 경로가 있고, 실제 서명이 발생한 경우에만 Explorer proof를 보여드립니다.

## Judge Q&A

### Q. AI가 결제를 마음대로 하면 위험하지 않나요?

A. Gemini는 결제 권한이 없습니다. Gemini는 분석과 제안을 하고, deterministic policy가 예산 한도, 허용 도구, 금액 cap, idempotency를 검사한 뒤에만 결제/협상 상태가 진행됩니다.

### Q. pay.sh는 정확히 어디에 쓰나요?

A. Creator 보상금이 아니라 Agent 운영비입니다. 후보 검증이나 콘텐츠 검증 같은 유료 API를 Agent가 구매할 때 pay.sh/x402를 쓰고, 영수증을 timeline에 남깁니다.

### Q. pay.sh 비용은 누가 내나요?

A. 기본적으로 브랜드나 대행사가 설정한 Agent 운영 예산에서 나갑니다. 후보를 더 정확히 고르고 정산 조건을 검증하기 위한 비용이기 때문입니다. KNOT은 이 비용을 검증 크레딧, API usage fee, 리포트 패키지로 과금할 수 있습니다.

### Q. KNOT은 어디서 돈을 버나요?

A. 초기에는 브랜드/대행사 SaaS 구독료와 Agent run 사용료가 기본입니다. 이후 pay.sh 기반 paid verification markup, Solana escrow operation fee, compliance report fee, API provider revenue share로 확장할 수 있습니다.

### Q. 왜 Solana가 필요한가요?

A. 협찬은 조건부 이행 거래입니다. 브랜드는 콘텐츠가 올라오기 전 전액 지급이 불안하고, 크리에이터는 미수금이 불안합니다. Solana 에스크로는 돈이 잠겼다는 사실과 조건 충족 시 지급되는 과정을 검증 가능하게 만듭니다.

### Q. GCP는 그냥 배포만 한 건가요?

A. 아닙니다. Cloud Run 서비스 분리, Firestore durable state, Firebase Auth, Vertex AI Gemini, Secret Manager, YouTube Data API까지 실제 운영 경계로 구성했습니다.

### Q. YouTube 지표는 AI가 만든 건가요?

A. 아닙니다. 조회수/좋아요/댓글/구독자 수는 YouTube Data API v3에서 가져오고, Gemini는 공개 메타데이터 기반의 스타일/카테고리 분석만 합니다.

### Q. Web3를 모르는 사용자는 어떻게 쓰나요?

A. 제품 언어는 지갑/토큰보다 협찬 업무 중심입니다. 사용자는 협찬 조건, 계약, 예치, 정산을 봅니다. 지갑은 예치나 수령처럼 필요한 순간에만 등장하고, 후속으로 Passkey/MPC 기반 UX를 붙일 수 있습니다.

### Q. 이게 mock 아닌가요?

A. 현재 데모는 Firebase Auth, Cloud Run, Firestore, Vertex AI, YouTube Data API, HTTP A2A, pay.sh sandbox, Solana devnet 경로를 사용합니다. 실패를 성공처럼 보이게 하는 mock fallback은 쓰지 않습니다.

## Must-Say / Must-Not-Say

Must say:

- "Gemini proposes; deterministic policy authorizes."
- "pay.sh is for Agent-paid verification, not Creator payout."
- "YouTube metrics come from YouTube Data API, not AI hallucination."
- "Firestore keeps durable business state."
- "Solana escrow is devnet for MVP."

Do not say unless demonstrated live:

- "Mainnet."
- "실제 USDC mainnet 정산."
- "모든 정산이 완전 자동으로 끝났다."
- "pay.sh가 크리에이터에게 보상금을 지급한다."
- "AI가 결제를 승인한다."
- "YouTube/Instagram 비공개 데이터를 가져온다."

## Visual Suggestions

Architecture visual:

```text
Browser
  ↓
Cloud Run Web
  ↓
Cloud Run API ── Firestore
  ↓              ↓
Vertex AI       Creator Discovery Index
  ↓
pay.sh/x402
  ↓
Creator Agent Cloud Run
  ↓
Web3 Gateway Cloud Run
  ↓
Solana Devnet
```

Agent decision visual:

```text
LLM suggestion
→ structured output validation
→ policy code
→ spend cap
→ idempotent write
→ receipt/timeline
```

Demo data visual:

```text
30 candidates
→ 30 public-filter matches
→ Top 20 detailed review
→ 1 selected creator
→ 1 negotiation
→ 1 agreement
```

## Final 30-Second Closing

KNOT은 크리에이터 협찬을 단순 추천 문제가 아니라 Agent가 실행할 수 있는 거래 문제로 봅니다. 현업에서 반복되는 후보 검증, 조건 협상, 정산 신뢰 문제를 Agent workflow로 묶었고, GCP 위에서 실제 서비스 경계로 배포했습니다. pay.sh는 Agent가 필요한 외부 검증 API를 구매하는 레일이고, Solana devnet 에스크로는 합의된 조건과 정산을 검증 가능하게 만듭니다. 그래서 KNOT은 Agentic Commerce에서 사람 서비스 거래를 자동화하기 위한 missing layer입니다.
