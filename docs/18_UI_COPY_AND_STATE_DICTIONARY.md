# UI Copy and State Dictionary

## 1. Product language

Core:

```text
KNOT은 Agentic Commerce에서
‘인간 서비스 거래의 빈 레이어’를 해결합니다.
```

Tagline:

```text
에이전트가 협상하고,
크리에이터가 만들고,
Solana가 정산합니다.
```

Avoid overusing technical terms in normal user copy. Use Agent/A2A/Task in Technical Proof or developer views.

## 2. Brand onboarding

```text
제품 링크만 주세요
붙여넣으면 나머지는 매니저가 읽어옵니다.

읽어오기

제품을 읽고 있어요

이 제품이 맞나요?

맞아요
조금 고칠래요

어떤 무드로 소개할까요?

어떤 콘텐츠가 필요하세요?

어느 범위에서 협상할까요?
원하는 금액
최대 금액

언제까지 필요하세요?

콘텐츠를 어디까지 사용할까요?

후보를 더 정확히 검증할까요?

에이전트가 사용할 지갑과 한도예요

에이전트가 이렇게 움직여요

에이전트 준비 완료
```

## 3. Creator onboarding

```text
인스타그램 링크만 주세요

콘텐츠를 살펴보고 있어요

이 프로필이 맞나요?

당신의 콘텐츠는 이런 분위기예요

어떤 콘텐츠를 맡을 수 있나요?

어느 범위에서 협상할까요?
절대 최저
원하는 금액

제작에 최소 며칠이 필요해요?

콘텐츠 활용은 어디까지 괜찮아요?

이런 제안은 받지 않을게요

어디로 정산받을까요?

에이전트가 이렇게 협상해요

제안 받기 시작
```

## 4. Brand Dashboard

```text
Brand Agent
준비 완료

조건에 맞는 크리에이터를 찾고,
합의 한 건이 만들어질 때까지 협상합니다.

탐색·협상 시작

에이전트가 파트너를 찾고 있어요.

실시간으로 보기

매듭이 만들어졌어요.

협업 보기
협상 다시보기

이번 실행에서는 합의되지 않았어요.

조건 수정
다시 실행

진행 중 협업
에스크로 현황
최근 매니저 활동
지난 매듭
```

## 5. Creator Dashboard

```text
Creator Agent
제안 받는 중

조건에 맞는 제안이 오면
사이트를 닫아도 에이전트가 협상합니다.

제안 받기 ON
제안 받기 일시 중지

브랜드 에이전트가 당신을 선택했어요.

사이트를 나가도 협상은 계속됩니다.

협업이 확정됐어요.

{amount} USDC가 에스크로에 확보되어 있습니다.

진행 중 협업
제출할 콘텐츠
정산 예정
정산 완료
지난 매듭
```

## 6. Discovery and negotiation

```text
당신의 에이전트가
어울리는 크리에이터를 찾고 있어요.

제안 가능한 Creator Agent를 찾았어요.

제품 분위기와 가까운 후보를 비교했어요.

후보 검증 API 사용
{amount} USDC · 결제 완료

{handle}를 선택했어요.

선정 이유

A2A 연결 중

협상 채널이 열렸어요.

첫 조건을 제안했어요.

작업 조건을 기준으로 금액을 조정했어요.

정책 확인
현재 제안은 위임 범위 안입니다.

조건을 수락했어요.

매듭이 지어졌어요.
```

## 7. Agreement, escrow and settlement

```text
계약이 만들어졌어요.

에스크로를 준비하고 있어요.
에스크로 전송이 제출됐어요.
에스크로가 확인됐어요.

{amount} USDC 에스크로 확보 완료

콘텐츠 URL 제출
검증 요청하기

결과물을 확인하고 있어요.

검증 완료
보완이 필요해요.
확인이 필요해요.

정산을 전송했어요.
정산이 완료됐어요.
```

## 8. Status labels

### Creator Agent publication

| Code | Label |
|---|---|
| DRAFT | 준비 중 |
| PUBLISHED | 공개됨 |
| PAUSED | 제안 일시 중지 |
| SUSPENDED | 사용 중지 |

### Availability

| Code | Label |
|---|---|
| AVAILABLE | 제안 가능 |
| RESERVED | 협상 준비 중 |
| NEGOTIATING | 협상 중 |
| AT_CAPACITY | 현재 일정 가득 참 |
| UNAVAILABLE | 제안 불가 |

### Match Run

| Code | Label |
|---|---|
| READY | 실행 준비 |
| QUEUED | 시작 대기 |
| DISCOVERING | 후보 찾는 중 |
| RANKING | 후보 비교 중 |
| VERIFYING | 후보 검증 중 |
| SELECTING | 협상 상대 확인 중 |
| NEGOTIATING | 협상 중 |
| AGREED | 합의 완료 |
| ESCROW_PREPARING | 에스크로 준비 중 |
| ESCROW_SUBMITTED | 에스크로 전송 중 |
| ESCROW_CONFIRMED | 에스크로 완료 |
| COMPLETED | 실행 완료 |
| EXHAUSTED | 합의 가능한 후보 없음 |
| CANCELED | 취소됨 |
| FAILED | 실행 오류 |

### Negotiation

| Code | Label |
|---|---|
| CREATED | 제안 준비 |
| OFFERED | 제안 전달 |
| COUNTERED | 조건 조율 중 |
| AGREED | 합의 |
| REJECTED | 거절 |
| EXPIRED | 만료 |
| CANCELED | 취소 |
| FAILED | 오류 |

### Evidence

| Code | Label |
|---|---|
| REQUIRED | 제출 필요 |
| SUBMITTED | 제출 완료 |
| VERIFYING | 검증 중 |
| VERIFIED | 검증 완료 |
| REVISION_REQUIRED | 보완 필요 |
| MANUAL_REVIEW | 확인 필요 |
| REJECTED | 검증 실패 |

### Escrow/settlement

| Code | Label |
|---|---|
| NOT_STARTED | 준비 전 |
| PREPARING | 준비 중 |
| SUBMITTED | 전송 중 |
| CONFIRMED | 잠금 완료 |
| RELEASE_SUBMITTED | 정산 전송 중 |
| RELEASED | 정산 완료 |
| FAILED | 처리 실패 |
| CANCELED | 취소됨 |

## 9. Empty and error copy

```text
연결할 수 없어요. 주소를 다시 확인해 주세요.

공개적으로 확인 가능한 정보가 적어요.
아는 내용만 만들었으니 나머지는 직접 확인해 주세요.

제품을 분석하지 못했어요. 다시 시도하거나 직접 입력해 주세요.

아직 제안 가능한 크리에이터를 찾지 못했어요.

이미 실행 중인 매칭이 있어요.

후보가 다른 협상을 시작해 다음 후보를 확인하고 있어요.

이번 실행에서는 합의 범위를 찾지 못했어요.

사이트를 닫아도 실행은 계속됩니다.

제안을 불러오지 못했어요. 상태를 다시 확인해 주세요.

에스크로 전송을 확인하고 있어요.

트랜잭션이 제출됐지만 확인이 지연되고 있어요.
중복 전송하지 않고 기존 거래를 확인합니다.

검증 결과가 애매해 직접 확인이 필요해요.

이 기록을 볼 권한이 없어요.
```

## 10. Technical Proof copy

```text
Technical Proof

Match Run
Candidate snapshot
Gemini analysis
A2A Task
A2A Messages
Agreement Artifact
Terms hash
Paid API receipt
Escrow transaction
Settlement transaction

LIVE
DEMO FIXTURE
SIMULATED · 서명 없음
```

Only show a mode badge when it is accurate.
