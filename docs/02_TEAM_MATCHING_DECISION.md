# 팀 공유용 — KNOT 매칭 로직 최종 정리

## 먼저 결론

현재 기획은 아래처럼 고정한다.

> **브랜드가 에이전트를 한 번 실행하면, 한 명과 한 번만 대화하는 것이 아니라 ‘최종 합의 1건’을 만들기 위한 Match Run이 시작된다.**

> **크리에이터 에이전트는 사용자가 같은 시간에 켜야 하는 실시간 채팅 참여자가 아니라, 공개해 두면 브랜드의 요청을 비동기로 받을 수 있는 대리인이다.**

> **전체 크리에이터를 매번 읽지 않는다. 온보딩 때 만들어 둔 탐색 전용 인덱스에서 필터링과 벡터 검색으로 Top K만 가져온다.**

---

## 1. 에이전트 한 번 실행의 단위

### 확정안

```text
Brand Agent 1회 실행
= Agreement 1건을 만들기 위한 Match Run 1건
```

`Match Run 1건 = Negotiation 1건`은 아니다.

MVP 흐름:

```text
후보 탐색·순위화
→ 1순위 Creator Agent와 협상
→ 결렬/만료 시 2순위
→ 다시 결렬 시 3순위
→ 최초 합의 시 실행 종료
→ 모든 후보 실패 시 EXHAUSTED
```

기본 제한:

| 항목 | MVP 값 |
|---|---:|
| 목표 Agreement 수 | 1건 |
| 한 Run의 최대 후보 | 3명 |
| 후보별 최대 협상 라운드 | 3회 |
| 협상 방식 | 순차 협상 |
| Promotion별 활성 Match Run | 최대 1개 |

### 순차 협상을 선택하는 이유

- 여러 후보와 동시에 합의되어 예산이 중복 집행되는 문제를 막는다.
- 크리에이터의 일정/수용량을 안전하게 예약할 수 있다.
- 해커톤에서 한 거래의 흐름을 명확히 보여줄 수 있다.
- Agreement와 escrow를 exactly-once로 연결하기 쉽다.

### 예외

- Agreement가 생성된 뒤 escrow가 실패한 경우 다음 후보로 자동 이동하지 않는다.
- 이미 합의가 존재하므로 해당 Agreement의 escrow를 재시도하거나 실패 상태를 해결한다.
- 사용자 취소는 아직 Agreement가 없는 단계에서만 즉시 다음 상태로 전이한다.

---

## 2. Creator Agent의 상태

Creator와 Brand가 동시에 웹사이트를 열어 둘 필요가 없다.

Creator가 온보딩 마지막에 `제안 받기 시작`을 선택하면:

```text
agentStatus      = PUBLISHED
acceptingOffers  = true
availability     = AVAILABLE
```

평상시 Gemini가 계속 실행되는 것은 아니다.

```text
평상시
→ Profile / Policy / Authority만 저장

A2A 제안 도착
→ 공용 Creator Agent Runtime 호출
→ 해당 creator의 policy 로드
→ Gemini + deterministic Policy Engine 실행
→ A2A 응답 저장
→ 다시 유휴 상태
```

브라우저가 닫혀 있어도 동일하게 동작해야 한다.

MVP 수용량:

```text
동시 활성 협상 1건
동시 진행 협업 1건
```

향후에는 `maxConcurrentNegotiations`, `maxActiveCollaborations`로 확장한다.

---

## 3. 매칭 대상

초기 KNOT의 탐색 대상은 Instagram 전체가 아니다.

```text
KNOT 온보딩 완료
+ 공개 Profile 확인 완료
+ Creator Agent PUBLISHED
+ acceptingOffers=true
+ capacity available
```

외부 크리에이터 발견/초대는 후속 기능이다. 실제 A2A 자율 협상은 크리에이터가 KNOT에 들어와 자신의 비공개 정책과 권한을 설정한 이후에만 가능하다.

---

## 4. 매칭 기준

### 4.1 하드 필터 — 하나라도 위반하면 제외

| 기준 | 처리 방식 |
|---|---|
| Agent 공개/제안 수신 | `PUBLISHED`, `acceptingOffers=true` |
| 수용량 | 활성 협상/협업 슬롯 확인 |
| 콘텐츠 포맷 | Reel/Feed/Short 지원 여부 |
| 카테고리 | 공개 카테고리 + private blocked category를 서버에서 검사 |
| 일정 | `nextAvailableAt`, private `minimumLeadDays`, deadline 비교 |
| 언어/지역 | Promotion이 요구할 때만 적용 |
| 계정 상태 | suspended/invalid profile 제외 |
| 대략적 예산대 | Creator가 공개를 허용한 rate band만 사용 |

정확한 최저 단가와 금지 조건은 Brand에게 공개하지 않는다. Platform Policy Engine이 후보 가능 여부만 판정한다.

### 4.2 의미 적합도 — 키워드만 보지 않는다

온보딩 때 양측에서 공통 taxonomy를 만든다.

- category keys
- content format keys
- mood IDs
- audience tags
- language/region
- product/content profile embedding

키워드는 정확한 필터에 쓰고, 문맥과 분위기는 embedding 유사도로 찾는다.

### 4.3 최종 점수 — 코드로 계산

하드 필터 통과 후보만 다음 점수를 계산한다.

| 점수 요소 | 가중치 |
|---|---:|
| 제품·콘텐츠 의미/무드 적합도 | 35 |
| 카테고리·오디언스 적합도 | 20 |
| 콘텐츠 포맷 적합도 | 15 |
| 일정 적합도 | 10 |
| 공개된 대략적 예산대 적합도 | 10 |
| 완료율·기한 준수 등 신뢰도 | 10 |

```text
finalScore = weighted sum, 0..100
```

Gemini 역할:

- URL에서 mood/category/audience를 구조화한다.
- embedding 입력을 만든다.
- 최종 선정 이유를 사용자 문장으로 설명한다.

Gemini가 하면 안 되는 것:

- DB 전체를 읽고 마음대로 후보를 고르는 것.
- 하드 필터를 위반한 후보를 다시 올리는 것.
- 정확한 private policy를 상대에게 설명하는 것.
- 결제 승인 여부를 결정하는 것.

---

## 5. 탐색 파이프라인

```text
1. Promotion query 생성
2. 탐색 인덱스 하드 필터
3. embedding Top 100 검색
4. deterministic score로 Top 20 재정렬
5. 필요하면 Top 3 유료 검증
6. 1순위 availability 재확인 및 reservation
7. AgentCard 조회
8. A2A OFFER
9. 결렬 시 다음 후보
```

유료 검증은 무조건 호출하지 않는다.

```text
verificationSpendCap > 0
AND 후보 간 점수 차이가 작음 또는 신뢰도가 낮음
AND 예상 비용이 남은 한도 이내
```

이 조건일 때만 Agent가 pay.sh/x402 API를 호출하고 영수증을 저장한다.

---

## 6. DB 저장 구조

### 원본 Profile

```text
creatorProfiles/{creatorId}
```

사용자가 확인한 프로필의 source of truth다.

### 비공개 정책

```text
agentPolicies/{creatorAgentId}
agentAuthorities/{creatorAgentId}
```

정확한 최저 단가, 금지 카테고리, 최소 준비 기간, 사용권, 수정 횟수, 실행 권한을 저장한다.

### 탐색 전용 인덱스

```text
creatorDiscoveryProfiles/{creatorId}
```

검색에 필요한 작은 projection만 저장한다.

```json
{
  "creatorId": "creator-001",
  "creatorAgentId": "agent-001",
  "agentStatus": "PUBLISHED",
  "acceptingOffers": true,
  "availability": "AVAILABLE",
  "capacityAvailable": true,
  "categoryKeys": ["beauty", "lifestyle"],
  "formatKeys": ["reel", "feed"],
  "moodIds": ["clean_minimal", "authentic_review"],
  "audienceTags": ["skincare", "20s_30s"],
  "languageKeys": ["ko"],
  "countryCode": "KR",
  "publicRateBand": "250_400",
  "nextAvailableAt": "timestamp",
  "reliabilitySummary": {
    "verifiedDeals": 8,
    "completionRate": 0.96,
    "onTimeRate": 0.92
  },
  "profileEmbedding": "vector",
  "profileVersion": 3,
  "embeddingVersion": 2,
  "indexVersion": 4
}
```

넣지 않는 것:

- 정확한 minimum rate;
- blocked categories 전체;
- private notes;
- raw Gemini output;
- 게시물 원문 전체;
- 협상 전체 이력;
- wallet secret.

### 실행과 후보 snapshot

```text
matchRuns/{matchRunId}
matchRuns/{matchRunId}/candidates/{candidateId}
```

각 후보의 점수, 사용된 profile/index version, 검증 결과, reservation, negotiation ID, 최종 outcome을 저장한다.

---

## 7. 데이터가 많아져도 전체를 읽지 않는 구조

예시:

```text
전체 1,000,000명
→ Firestore/검색 인덱스 조건 필터
→ vector Top 100
→ 상세 Profile Top 20만 read
→ 유료 검증 Top 3
→ 협상 1명씩
```

원본을 저장하는 것과 전체를 스캔하는 것은 다르다. 문제는 저장량이 아니라 쿼리 방식이다.

MVP:

```text
Firestore source of truth
+ Firestore read-optimized discovery collection
+ Firestore vector query/index
```

확장:

```text
Firestore source of truth
+ Vertex AI Vector Search discovery index
+ BigQuery offline analytics
```

애플리케이션의 `CreatorDiscoveryRepository` 인터페이스를 분리해 두면 검색 엔진만 교체할 수 있다.

---

## 8. 동시성 처리

Brand Agent가 A2A를 시작하기 전 후보를 짧게 예약한다.

```text
reservationOwner = negotiationId
reservationExpiresAt = now + 5 minutes
```

- Firestore transaction으로 capacity와 lease를 함께 검사한다.
- 결렬/만료/오류 시 lease를 해제한다.
- Agreement + escrow 성공 시 collaboration capacity로 전환한다.
- lease가 이미 있으면 다음 후보로 진행한다.

정책은 협상 시작 시 snapshot을 저장한다. 진행 중 사용자가 정책을 바꾸더라도 해당 협상에는 기존 snapshot을 적용한다.

---

## 9. 아직 구현 과정에서 검증할 항목

아래는 제품 결정을 다시 논의하는 항목이 아니라, Codex가 코드 감사 후 실제 구현과 맞춰야 하는 기술 항목이다.

- 기존 API에서 Promotion/Negotiation/Agent 상태 필드명이 무엇인지.
- 현재 Firestore에 vector field와 index가 이미 있는지.
- 현재 비동기 worker가 Pub/Sub, Cloud Tasks, Workflows 중 무엇을 사용하는지.
- 현재 escrow 권한이 pre-funded agent wallet인지 사용자 지갑 승인형인지.
- 현재 A2A SDK가 문서의 HTTP+JSON v1.0 객체와 정확히 일치하는지.
- 기존 frontend route와 component를 어디까지 그대로 재사용할 수 있는지.

이 항목은 기존 동작을 깨지 않도록 Adapter, alias, dual-read migration으로 맞춘다.
