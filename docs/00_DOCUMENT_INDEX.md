# KNOT v2 문서 인덱스

> **문서 버전:** v2  
> **상태:** 구현 기준 확정  
> **UI/UX 기준:** `origin/feat/two-user-session`  
> **Backend/API/Web3 기준:** 현재 실제 기능이 동작하는 안정 브랜치  
> **충돌 시 최우선 문서:** `KNOT_PRODUCT_MASTER_SPEC_V2.md`

---

## 1. 이 문서 세트의 목적

이 폴더는 KNOT의 제품 기획, 페이지 플로우, 데이터 모델, API, A2A 협상, Solana 에스크로, 정산, 보안, 테스트, 배포 기준을 하나로 통일한다.

과거 문서와 새 문서가 충돌해 다음과 같은 문제가 다시 발생하지 않도록 한다.

- 기존 긴 온보딩과 two-window 온보딩이 동시에 남는 문제
- 마이페이지와 설정이 여러 위치에 중복되는 문제
- 대시보드와 Agent 채팅 UI가 서로 다른 제품처럼 보이는 문제
- Mock 협상과 실제 A2A가 구분되지 않는 문제
- `SIMULATED` 에스크로를 실제 온체인 결제로 오해하는 문제
- Campaign, Deal, Promotion 용어가 혼용되는 문제

---

## 2. Source of Truth 우선순위

1. `KNOT_PRODUCT_MASTER_SPEC_V2.md`
2. 역할별 전문 문서
   - `06_DATA_MODEL.md`
   - `07_API_CONTRACTS.md`
   - `08_A2A_AGENT_RUNTIME.md`
   - `09_ESCROW_AND_SETTLEMENT.md`
   - `11_SECURITY_AND_AUTHORIZATION.md`
   - `13_TEST_AND_ACCEPTANCE.md`
3. 운영 문서
   - `FIREBASE_AUTH_SETUP.md`
   - `IMPLEMENTATION_STATUS.md`
   - `HANDOFF.md`
4. 코드와 실제 배포 상태

문서와 코드가 다르면 임의로 어느 한쪽을 사실로 간주하지 않는다. `IMPLEMENTATION_STATUS.md`에 차이를 기록하고 코드 또는 문서를 명시적으로 갱신한다.

---

## 3. 문서 목록

| 문서 | 목적 |
|---|---|
| `KNOT_PRODUCT_MASTER_SPEC_V2.md` | 전체 제품·기술 결정 요약 |
| `01_PRODUCT_PRD.md` | 문제, 사용자, 가치, 목표, 성공 기준 |
| `02_SCOPE_AND_GLOSSARY.md` | MVP 범위와 용어 |
| `03_INFORMATION_ARCHITECTURE_AND_ROUTES.md` | 메뉴, Route, 전환, Guard |
| `04_AUTH_ONBOARDING_DASHBOARD.md` | 로그인, 온보딩, Manager 연결, 대시보드 |
| `05_PAGE_SPEC.md` | 페이지별 UI·CTA·데이터·상태 |
| `06_DATA_MODEL.md` | Firestore 모델, 관계, 불변조건 |
| `07_API_CONTRACTS.md` | 사용자 API·A2A 지원 API 계약 |
| `08_A2A_AGENT_RUNTIME.md` | Agent discovery, Task, multi-turn 협상 |
| `09_ESCROW_AND_SETTLEMENT.md` | Agreement, termsHash, escrow, evidence, release |
| `10_DEV_ADMIN.md` | 개발·운영 진단 화면 |
| `11_SECURITY_AND_AUTHORIZATION.md` | 인증, 권한, 개인정보, Web3 안전 |
| `12_MIGRATION_AND_CUTOVER.md` | 기존 브랜치·DB·Route 이전 |
| `13_TEST_AND_ACCEPTANCE.md` | 테스트와 완료 기준 |
| `14_CODEX_EXECUTION_GUIDE.md` | Codex 실행 절차와 제약 |
| `15_TOKEN_BUDGET_STRATEGY.md` | Gemini/Codex/pay.sh 비용·한도 |
| `16_DEMO_AND_SUBMISSION.md` | 3분 데모와 제출 체크리스트 |
| `17_UI_COPY_AND_STATES.md` | 확정 문구와 사용자 상태명 |
| `18_REFERENCES.md` | 제공 자료와 공식 참고 |
| `19_AGENT_RULES.md` | 루트 `AGENTS.md`에 반영할 규칙 |
| `FIREBASE_AUTH_SETUP.md` | Firebase 설정과 탭별 세션 |
| `IMPLEMENTATION_STATUS.md` | 실제 구현·검증 현황 |
| `HANDOFF.md` | 팀 인수인계와 실행법 |
| `README_REPLACE_EXISTING_DOCS.md` | 기존 docs 교체 방법 |

---

## 4. 권장 읽기 순서

### 기획·프론트

```text
KNOT_PRODUCT_MASTER_SPEC_V2
→ 01_PRODUCT_PRD
→ 03_INFORMATION_ARCHITECTURE_AND_ROUTES
→ 04_AUTH_ONBOARDING_DASHBOARD
→ 05_PAGE_SPEC
→ 17_UI_COPY_AND_STATES
```

### 백엔드·Agent

```text
06_DATA_MODEL
→ 07_API_CONTRACTS
→ 08_A2A_AGENT_RUNTIME
→ 11_SECURITY_AND_AUTHORIZATION
```

### Web3

```text
09_ESCROW_AND_SETTLEMENT
→ 11_SECURITY_AND_AUTHORIZATION
→ 13_TEST_AND_ACCEPTANCE
```

### Codex 작업

```text
14_CODEX_EXECUTION_GUIDE
→ 12_MIGRATION_AND_CUTOVER
→ IMPLEMENTATION_STATUS
```

---

## 5. 구현 결정 규칙

- 화면 순서·카피·시각 언어는 `feat/two-user-session`을 우선한다.
- 기존 실제 API와 A2A·Web3 코드는 최대한 유지한다.
- UI와 API 모델이 다르면 Adapter/ViewModel을 만든다.
- Mock 성공을 실제 성공처럼 표시하지 않는다.
- 모든 새 페이지와 API는 역할·소유권 검사를 통과해야 한다.
- `Promotion`이 사용자 업무의 중심이고 `Agent`는 실행 주체다.
- 전체 협상 대화는 Negotiation Detail에서 보여주며, Dashboard에는 요약만 둔다.
- `매니저 붙이기`는 Agent 생성이며 협상 시작이 아니다.
- Creator의 `협찬 받기`, Brand의 `협찬 제안하기`가 실제 Agent run의 시작점이다.
