# pay.sh를 KNOT에 제대로 엮는 방법 — 아이디어 노트

작성: 효창(블록체인 레인) / 2026-08-02
상태: **아이디어 / 미구현.** 결정되면 `docs/WALLET_LOGIN_FEE_AND_PAYSH_DECISION.md` §3을 갱신한다.
관련: `CLAUDE.md`(pay.sh 가산점), `backend/libs/payments/paysh.py`, `backend/apps/api/routes.py:4885~5053`

---

## 0. 한 줄 요약

**pay.sh는 사는 쪽과 파는 쪽이 둘 다 되는데, 우리는 사는 쪽만 쓰고 있다. 파는 쪽을 쓰면 "브랜드 AI가 크리에이터 AI에게 직접 돈을 낸다"가 되고, 그게 이 대회 주제 자체다.**

---

## 1. pay.sh가 할 수 있는 일

CLI(`pay` v0.26.0) 기준으로 크게 둘이다.

| | 명령 | 하는 일 |
|---|---|---|
| **① 사기** | `pay fetch`, `pay curl` | 내 프로그램이 남의 유료 API를 호출할 때 x402로 자동 결제 |
| **② 팔기** | `pay gate api <paywall.yml>` | **내 API 앞에 요금소를 세워 호출자에게 USDC를 받음** |
| 부가 | `pay catalog` | 내 API를 pay.sh 공개 스킬 카탈로그에 등록 → 외부 에이전트가 검색 가능 |
| 부가 | `pay skills search/show` | 다른 제공자의 유료 API를 검색·조회 |
| 부가 | `pay subscriptions` | MPP 구독 위임(반복 결제) |
| 부가 | `pay mcp` | 에이전트 클라이언트용 MCP 서버 (이미 `.mcp.json`에 등록돼 있음) |

---

## 2. 현재 상태 — ①만 쓰고 있고, 산 물건이 우리와 무관하다

```
KNOT Product API ──0.02 USDC──▶ https://debugger.pay.sh/mpp/quote/AAPL
                                 → {"symbol":"AAPL","price":"181.50"}
```

- 호출 지점: Match Run 중 후보 크리에이터 선정 직후 1회 (`routes.py:4885~5053`)
- 구현 품질은 높다 — allowlist, per-call/per-run/daily 상한, 멱등 operation ID, `paymentOperations`·`transactionReceipts` 기록, 실패 시 continuation 정책
- **2026-08-02 실호출 검증 완료**: `test_paysh_sandbox` skip→pass, Match Run 실결제 통합 테스트 추가(mock 없음)

### 그런데 두 가지 문제

**(a) 배포본에선 호출조차 안 되고 있을 가능성이 높다.**
`scripts/deploy_cloud_run_demo.sh`가 `PAYSH_RESOURCE_ID=${PAYSH_RESOURCE_ID:-replace-me}`를 넘긴다.
`replace-me`면 코드가 `PAYSH_RESOURCE_ID is not configured`로 **SKIPPED** 처리하고 지나간다.
→ 배포 시 실제 값 주입이 필요하다. **가장 먼저 확인할 항목.**

**(b) 사는 물건이 애플 주가다.**
pay.sh 데모 엔드포인트라 인플루언서 마케팅과 아무 관계가 없다.
배관은 완벽한데 파이프에 흐르는 게 더미 데이터다. 심사에서 "이 결제로 뭘 샀나"에 답이 궁색하다.

---

## 3. 아이디어 A — 호출 지점을 "정산 직전"으로 옮긴다 (작고 안전)

```
지금:  후보 선정 → 유료 호출 → (매칭 점수에 실질 반영 없음)
제안:  콘텐츠 게시 → evidence 제출 → 유료 호출로 사실 확인 → 통과 시 자동 정산
```

**왜 강해지는가**

- 돈이 실제로 움직이기 직전이라 **유료 검증의 필요성이 자명**하다.
- "에이전트가 스스로 비용을 지출해 리스크를 줄인다" = 에이전틱 커머스의 교과서적 사례.
- x402의 원래 용도(머신이 API에 종량 지불)와 정확히 맞는다.
- **자동 정산(`_try_auto_settlement`)과 이어져 하나의 장면이 된다** — "돈 내고 확인한 뒤, 사람 없이 지급".
  지금은 pay.sh와 정산이 따로 놀아서 서사가 두 동강이다.

**붙일 자리는 이미 파여 있다.** evidence 파이프라인이 provider / observations / policyDecision 구조를
갖고 있다(Phase 10). 검증 결과를 `verificationResults`에 쓰는 지점에 유료 호출 결과를 끼우면 된다.

**한계**: 게시 여부를 실제로 확인해주는 유료 API를 아직 못 찾았다. 시간이 없으면 debugger 엔드포인트를
그대로 쓰되 **호출 시점만 정산 직전으로** 옮겨도 서사 이득이 크다. 단 그 경우 "무엇을 검증했는지"를
과장하지 말 것 — 영수증에 실제 리소스 URL이 남는다.

**공수**: 1~2시간. **리스크**: 낮음.

---

## 4. 아이디어 B — 크리에이터 에이전트를 유료 API로 판다 (핵심)

### 지금

```
Brand Agent ──HTTP A2A (무료, 서비스 토큰, 무제한)──▶ Creator Agent
```

브랜드 에이전트가 공짜로 무한정 협상을 걸 수 있다. 그런데 크리에이터의 응답 capacity는
**실제로 희소 자원**이다 — `acceptingOffers`, `capacityAvailable` 필드가 이미 그걸 모델링하고 있다.

### 제안

```
Brand Agent ──x402: 0.05 USDC──▶ [pay gate] ──▶ Creator Agent
                                      │
                                수취인 = 크리에이터 지갑
```

`pay gate api --recipient <크리에이터 지갑>` 으로 **수취인을 크리에이터로** 지정한다.
협상 요청 한 건마다 크리에이터가 번다.

### 왜 억지가 아닌가 — 우리가 원래 풀던 문제다

| 문제 | 요금소가 푸는 방식 |
|---|---|
| 브랜드가 크리에이터 수백 명에게 스팸 제안 | 건당 과금 → 진짜 관심 있는 딜만 온다 |
| 협상이 무산되면 크리에이터는 시간만 날림 | 딜 성사 여부와 무관하게 협상 자체로 수익 |
| "자율 결제"의 증거가 애플 주가 | **브랜드 AI가 크리에이터 AI에게 직접 지불** |

마지막 줄이 핵심이다. 심사위원에게 하는 말이 이렇게 바뀐다.

> 지금: "저희 에이전트가 자율 결제합니다 — 애플 주가를 삽니다."
> 이후: "**브랜드의 AI가 크리에이터의 AI에게 직접 돈을 냅니다. 사람은 없습니다.**"

두 번째가 "Build the Future of Agentic Commerce" 주제 그 자체다.

### 실제 스펙 (`pay server scaffold` 출력 기준)

```yaml
name: knot-creator-agent
subdomain: knot
title: "KNOT Creator Agent"
description: "Negotiate a sponsorship deal with a creator's autonomous agent"
category: ai_ml
version: v1
forward_url: https://knot-creator-agent-xxxx.run.app   # 기존 Cloud Run
accounting: pooled

endpoints:
  # AgentCard 발견은 무료 — 유료로 막으면 아무도 못 찾는다
  - method: GET
    path: "a2a/v1/.well-known/agent-card.json"
    description: "AgentCard discovery"

  # 협상 개시는 유료
  - method: POST
    path: "a2a/v1/tasks"
    description: "Open a negotiation with this creator agent"
    metering:
      dimensions:
        - direction: usage
          unit: requests
          scale: 1
          tiers:
            - price_usd: 0.05
```

```bash
pay gate api knot-paywall.yml --recipient <크리에이터_지갑> --currency USDC
```

**우리 코드는 한 줄도 안 고친다.** 프록시가 앞에 서는 구조다.
`--openapi <path>`를 주면 `/openapi.json`을 프록시 주소로 리라이트해 내려주므로,
외부 에이전트가 우리 내부 URL을 몰라도 호출할 수 있다.

### 위험 — 반드시 병렬로 붙일 것

Creator A2A Service는 **데모의 심장부**다. Product API가 여기로 협상을 걸어야 전체 플로우가 돈다.
앞에 프록시를 끼웠다가 서비스 토큰 인증이나 AgentCard 검증이 깨지면 **데모 전체가 죽는다.**

그래서 기존 경로는 건드리지 말고 병렬로 둔다.

```
기존:  Product API ──직접 HTTP A2A──▶ Creator Agent      ← 데모 메인. 무변경
신규:  외부/시연    ──pay gate 통과──▶ Creator Agent      ← 별도 포트, 유료 시연 전용
```

발표 때 터미널 한 줄로 증명한다.

```bash
pay --sandbox curl https://knot.pay.sh/a2a/v1/tasks -d '{...}'
→ 0.05 USDC 지불 → 크리에이터 에이전트 응답
```

**메인 플로우 리스크 0, 증거는 확보.**

**공수**: 반나절. **리스크**: 병렬 배치 시 낮음.

---

## 5. 아이디어 C — `pay catalog`로 크리에이터를 공개 시장에 올린다

```bash
pay catalog scaffold   # OpenAPI → provider PAY.md 생성
pay catalog check      # 파싱 + frontmatter 검증 + probe + Solana verdict
pay catalog build      # 레지스트리 빌드
```

크리에이터 에이전트를 pay.sh 공개 스킬 카탈로그에 등록하면,
**KNOT UI를 거치지 않은 외부 에이전트도** `pay skills search "beauty creator korea"` 로
우리 크리에이터를 찾아 고용할 수 있다.

지금 우리 discovery는 Firestore `creatorDiscoveryProfiles` 안에 갇혀 있다.
카탈로그 등록은 그걸 열린 시장으로 꺼낸다.

> "KNOT은 닫힌 플랫폼이 아니라, 크리에이터가 에이전트 경제에 진입하는 온램프다."

**공수**: +반나절. **리스크**: 외부 레지스트리 PR/심사 절차가 필요할 수 있어 마감 내 확정 불가.

---

## 6. 아이디어 D — 구독형 (`pay subscriptions`, MPP 위임)

브랜드가 특정 크리에이터 에이전트에 **월 구독**을 걸어두고, 그 한도 안에서 에이전트가 반복 협상.
`pay server plans`로 온체인 `Plan` PDA를 파생할 수 있다.

우리 `auto_approve_cap` / 예산 모델과 개념이 정확히 겹친다.
**v2 후보.** 마감 내에는 범위 밖.

---

## 7. 우선순위와 결론

| 순위 | 항목 | 공수 | 서사 이득 | 마감 내 |
|---|---|---|---|---|
| **0** | 배포에 `PAYSH_RESOURCE_ID` 실제 값 주입 (§2-a) | 5분 | — (없으면 전부 무의미) | ✅ |
| **1** | A — 호출 지점을 정산 직전으로 이동 | 1~2h | 중 | ✅ |
| **2** | B — 크리에이터 에이전트 유료화 (병렬 시연) | 반나절 | **매우 큼** | ✅ 가능 |
| 3 | C — 공개 카탈로그 등록 | 반나절 | 큼 | △ |
| 4 | D — 구독형 | — | 중 | ✗ v2 |

**권장: 0 → A → B.**
0번을 안 하면 나머지가 전부 종이 위 이야기가 된다. B가 이 문서의 핵심 주장이다.

---

## 8. 열린 질문

1. 크리에이터 에이전트 유료화 시 **가격을 누가 정하나** — 플랫폼 고정(0.05)인가, 크리에이터가 설정하나?
   후자면 `creatorProfiles`에 필드가 하나 더 필요하고 paywall spec을 크리에이터별로 생성해야 한다.
2. 수취인이 크리에이터 지갑이면 **플랫폼 수수료는 어디서 떼나.** `accounting: pooled` 옵션 검토 필요.
3. 협상 요청 과금과 기존 **에스크로 정산의 관계** — 딜이 성사되면 협상비를 정산액에서 차감할 것인가?
4. evidence 검증용으로 쓸 **실제 유료 API**가 있는가 (§3의 한계).
5. 카탈로그 등록에 외부 승인 절차가 있는가, 있다면 리드타임은?
