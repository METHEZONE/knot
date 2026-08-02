# knot — 지갑 로그인 · 수수료 추상화 · pay.sh 활용 결정 문서 (v0.2)

작성: 효창(블록체인 레인) / 2026-08-02
기준 브랜치: **`origin/fix/payment-rails-escrow`** (= 현재 배포본, `bfc5497`). `main`(`a9202ab`)이 아니다 — 18커밋 / +5,210줄 차이가 있고, **결론을 바꾸는 차이다.**

대상 질문: ① 아예 지갑으로 로그인시킬지 ② 예치·정산에서 SOL 대신 USDC로 수수료를 내게 할지 ③ pay.sh를 어떻게 쓸지

관련: `docs/WALLET_AND_MONEY_FLOW.md`, `docs/IMPLEMENTATION_STATUS.md`, `CLAUDE.md`

> **시간 제약**: `CLAUDE.md` 기준 제출 마감 **2026-08-03**, 데모데이 **2026-08-07**. 아래는 "마감 내"와 "데모데이까지 stretch"로 분리했다. 날짜가 바뀌었다면 stretch를 본 범위로 올릴 수 있다.

---

## 0. 배포본이 실제로 하는 일 (코드에서 확인한 사실)

| # | 사실 | 근거 |
|---|---|---|
| A | 구글 로그인은 이미 있다 (Firebase `signInWithPopup`). | `frontend/src/auth/firebaseClient.ts:64,100` |
| B | **지갑 자동 생성은 없다.** `main`에는 역할 선택 시 에이전트 키페어를 Secret Manager에 저장하는 코드가 있었지만, 이 브랜치는 그 경로와 설정(`KNOT_AGENT_WALLET_PROVISION`)을 **모두 제거**했다. 지갑은 오직 Phantom 연결로만 생긴다. | `routes.py` `/me/role` 핸들러에 프로비저닝 호출 없음, `libs/settings/config.py`에 해당 설정 없음 |
| C | **에스크로 예치는 브랜드가 Phantom으로 직접 서명한다.** 게이트웨이가 미서명 tx를 만들어 주고(`prepare-funding`), FE가 Phantom으로 서명·브로드캐스트한 뒤 `confirm-funding`으로 온체인 검증한다. | `web3/gateway/src/funding.ts:172-263`, `frontend/.../NegotiationDetail.tsx:114-133` |
| D | **그 tx의 `feePayer`는 브랜드 지갑이다.** → 브랜드는 devnet SOL을 직접 보유해야 한다. | `funding.ts:236` |
| E | **정산 릴리즈도 Phantom 서명을 요구한다.** 게다가 FE는 **연결된 지갑이 `settlementAuthority`와 정확히 일치할 것**을 요구하고, 그 tx의 `feePayer`도 `settlementAuthority`다. | `funding.ts:498`, `NegotiationDetail.tsx:609`, commit `93ead9e` |
| F | `settlementAuthority`는 유저 지갑이 아니라 **환경변수로 고정된 플랫폼 pubkey**다(`KNOT_SETTLEMENT_AUTHORITY`). | `routes.py:5787-5794`, `libs/settings/config.py:61,107` |
| G | 온체인 프로그램에 **rail이 두 개**가 됐다. ⓐ legacy 캠페인 rail(`initialize_campaign`/`approve_and_release`) — 에이전트 서명, **수수료 bps 있음**. ⓑ 신규 Agreement rail(`initialize_escrow`/`fund_escrow`/`verify_milestone`/`release_milestone`) — Phantom 서명, **수수료 bps 없음**. | `programs/knot-escrow/src/lib.rs:30-241` vs `:271-523` |
| H | **legacy rail(=에이전트 자율 정산)은 유저 플로우에서 차단됐다.** | commit `3beca3f` "block legacy escrow lock in user flow" |
| I | pay.sh는 Match Run당 1회 유료 검증으로 붙어 있고 allowlist·3중 cap·멱등 operation까지 완비. **다만 실제 호출이 한 번도 성공한 적 없다**(sandbox 스모크 skipped). | `routes.py:4885-5053`, `IMPLEMENTATION_STATUS.md` Phase 8 |

### 이 표에서 나오는 결론

**배포본은 "진짜 온체인 UX"를 얻는 대신 해커톤의 핵심 주장을 내줬다.**

C~H를 합치면 지금 데모의 자금 흐름은 이렇다:

```
브랜드가 Phantom 열고 서명 (SOL 필요)
  → 에스크로 예치
  → 정산할 때 settlementAuthority 지갑을 브라우저에 연결하고 또 서명
```

즉 **돈이 움직이는 두 지점 모두에 사람의 클릭이 있다.** `CLAUDE.md`가 명시한 심사 포인트는 "에이전트가 **사람 개입 없이** x402로 자율 결제"인데, 정산 경로에서 그게 사라졌다. 이전 `main`에는 에이전트 자율 정산이 있었고 localnet 서명으로 증명까지 돼 있었다(`IMPLEMENTATION_STATUS.md` §16). 배포본은 그 rail을 **의도적으로 막았다**(H).

효창이 감지한 "해커톤 방향성이 안 맞는 것 같다"는 정확한 직감이고, 원인은 여기다. 세 질문은 사실 **하나의 질문**이다 — *돈이 움직일 때 사람을 다시 끼워 넣을 것인가, 빼낼 것인가.*

이 문서의 답: **빼낸다.** 아래 세 절은 그 방법이다.

---

## 1. 지갑 로그인 — "구글 로그인하면 지갑 주소까지 생긴다"

### 선택지

| | A. 지갑 로그인 전면 전환 (SIWS) | **B. 구글 로그인 + 플랫폼 임베디드 지갑** | C. Phantom Embedded SDK |
|---|---|---|---|
| 유저 경험 | Phantom 설치 필수 | 지갑 개념 없이 가입, 주소 자동 | 구글 로그인 → 진짜 Phantom 지갑 |
| Auth 기준 | Firebase UID를 pubkey로 교체 | Firebase UID 유지 | Firebase UID 유지 |
| 코드 영향 | **전 시스템** (auth/미들웨어/Firestore 키/A2A 소유권) | 백엔드 1함수 + `/me` + FE 카드 | FE 통합 + Phantom 앱 등록 |
| 마감 내? | ✗ | ✓ | △ 08-07 stretch |
| 자율 정산과의 관계 | 악화 (서명 주체가 사람으로 고정) | **개선 (플랫폼이 키를 쥐므로 자율 서명 가능)** | 중립 |

### 권장: **B를 지금, C를 08-07 stretch. A는 버린다.**

A를 버리는 건 취향이 아니라 구조다. Firebase UID가 `users/{uid}`·`agents/{agentId}`·A2A 소유권 검사·dev-admin allowlist 전부의 기준 키다. 마감 전날 이걸 지갑 주소로 바꾸는 건 데모 전체를 거는 도박이다.

**그리고 A는 서사적으로도 반대 방향이다.** 이 프로젝트의 주장은 "사람 개입 없는 에이전트 결제"인데, 로그인부터 지갑 팝업을 띄우면 첫 화면에서 이미 주장이 깨진다. 지갑은 **보이지 않게 만드는 쪽**이 심사 포인트에 정합한다.

**B가 §2의 전제조건이기도 하다.** 플랫폼이 유저 지갑 키를 쥐고 있어야 사람 클릭 없이 서명할 수 있다. 즉 B는 UX 개선이 아니라 **자율성 복구의 수단**이다. 이게 B를 지금 해야 하는 진짜 이유다.

C는 효창이 말한 "구글 계정으로 로그인하면 팬텀 지갑 주소까지 생기는 것"의 문자 그대로의 구현이고 방향은 정확하다. 다만 Phantom 앱 등록 + FE 오너(민성) 작업이 얽혀 마감 전날 착수는 위험하다. **B의 데이터 모델을 C가 그대로 재사용하도록** 설계해두면(아래 `walletCustody`) 08-07에 FE 교체만으로 넘어간다.

### B 구현 계획 (효창 레인 — 백엔드/웹3만)

1. **`libs/web3/user_wallet.py`** — `provision_user_wallet(uid)`. 기존 `agent_wallet.py`를 일반화(시크릿 ID만 `knot-user-key-{uid}`). 기존 코드가 이미 검증돼 있어 복제 비용이 낮다.
2. **훅 위치**: 역할 선택 핸들러(`routes.py:306` 옆). 이미 에이전트 지갑을 만드는 자리라 트랜잭션 경계가 같다.
3. **스키마**:
   ```
   users/{uid}.walletAddress   # 기존 필드 재사용
   users/{uid}.walletCustody   # "PLATFORM" | "SELF"   ← 신규
   ```
4. **`POST /me/wallet` 유지.** 외부 Phantom을 연결하면 `walletCustody: "SELF"`로 덮어쓴다. **자동 생성이 기본값, Phantom은 선택적 업그레이드.** C로 갈 때 이 엔드포인트가 그대로 Embedded 주소를 받는다.
5. **FE(민성 레인 — 스펙만)**: WALLET 카드를 `not-connected` → **"지갑 자동 생성됨 · {주소}"** + 보조 버튼 "내 지갑으로 교체". `NegotiationDetail.tsx:358,377` 문구도 함께 정리.

### 리스크

- **커스터디 = 플랫폼 책임.** 비밀키를 우리가 보관한다. **devnet 한정**임을 UI·소개서에 명시해야 한다. mainnet에는 키 로테이션·복구 정책이 필요하고 v2 범위다(`WALLET_AND_MONEY_FLOW.md` §9에 이미 open).
- **"팬텀 지갑이 생긴다"는 B에서 부정확한 표현이다.** B가 만드는 건 Phantom 지갑이 아니라 플랫폼 커스터디 Solana 지갑이다. 소개서에는 "임베디드 지갑 / 자동 생성 지갑"으로 쓰고 Phantom은 "외부 지갑 연결 옵션"으로 분리하자. 심사위원이 파고들 때 표현이 정확하면 신뢰가 오르고, 부정확하면 그 자리에서 깎인다.

---

## 2. 예치·정산 수수료 — "SOL 대신 USDC"

### 진짜 문제

효창의 의도는 "유저가 SOL을 안 들고 있어도 되게"로 읽힌다. 배포본에서 이건 **실제 문제가 맞다** — 표 D·E. 브랜드는 예치할 때, settlementAuthority 보유자는 정산할 때 각각 devnet SOL이 필요하다. 데모 중 SOL이 떨어지면 그대로 멈춘다.

게다가 더 큰 손실이 있다: **신규 Agreement rail에는 USDC 수수료 자체가 없다**(표 G). legacy rail에 있던 `brand_fee_bps`/`creator_fee_bps` → treasury 분배가 새 rail로 넘어오지 않았다. 즉 지금은 **SOL은 유저가 내고, USDC 수수료는 아무도 안 걷는** 상태다. 수익 모델이 온체인에서 사라졌다.

### 해법: fee payer 분리 (Solana 네이티브)

Solana는 **fee payer와 instruction 서명자의 분리를 프로토콜 차원에서 지원**한다. 별도 프로그램도, 프로그램 재배포도 필요 없다. `transaction.feePayer`를 플랫폼 릴레이어로 바꾸고, 릴레이어가 부분 서명해서 내보내면 끝이다.

배포본 구조가 마침 이걸 하기에 이상적이다 — 이미 **prepare → 서명 → confirm** 3단계로 쪼개져 있어서, `prepare` 단계에서 feePayer만 바꾸면 된다.

```
현재:  transaction.feePayer = brandAuthority          (funding.ts:236)
       transaction.feePayer = settlementAuthority     (funding.ts:498)

변경:  transaction.feePayer = config.relayerPubkey
       → prepare 응답 직전 relayer 키로 partialSign
       → FE는 지금처럼 Phantom으로 자기 서명만 추가해서 브로드캐스트
```

FE 변경은 **없다.** `sendPreparedSolanaTransaction`은 이미 base64 tx를 받아 서명·전송할 뿐이라 partial signature가 들어 있어도 그대로 동작한다. 게이트웨이 2줄 + 릴레이어 키 로딩이 전부다.

효과:
- 유저는 SOL 0. 지갑에 USDC만 있으면 된다.
- 데모 중 "SOL 부족"으로 멈출 위험이 사라진다. 릴레이어 하나만 채워두면 된다.

### USDC 회수는 어떻게

가스를 USDC로 회수하려면 두 갈래다.

| | ⓐ 온체인 fee bps 복원 | **ⓑ 오프체인 회계 + 영수증 노출** |
|---|---|---|
| 방법 | 신규 rail의 `release_milestone`에 treasury 분배 추가 | 프로그램 손 안 대고, 영수증에 lamports·USDC 환산 기록 |
| 비용 | **프로그램 재배포 → program id 변경 → 게이트웨이·env·config PDA 재초기화** | 게이트웨이 `liveReceipt()` 한 곳 |
| 마감 내 | ✗ 위험 | ✓ |

**권장: 마감 내에는 ⓑ만.** 프로그램 재배포는 program id가 바뀌고 게이트웨이·env·PDA 초기화가 전부 따라와야 한다. 게다가 devnet config는 이미 mint 불일치 블로커가 하나 걸려 있다(`IMPLEMENTATION_STATUS.md` §17). **마감 전날 건드릴 대상이 아니다.** ⓐ는 08-07 이후 v2.

영수증에 추가할 필드:

```
transactionReceipts/{id}
  gasLamports        # getTransaction(sig).meta.fee
  gasPaidBy          # "PLATFORM_RELAYER"
  gasPayerPubkey
  userSolSpent       # 0   ← 핵심 증거
  feeUsdcBaseUnits   # 회수 예정 USDC (오프체인 산정)
```

UI 문구(FE 스펙): **"가스비 0 SOL — 네트워크 수수료는 플랫폼이 대납하고 정산 시 USDC로 회수합니다."** 아래에 실제 lamports 숫자.

### 표현 주의

"가스비를 USDC로 낸다"는 엄밀히 틀리다. Solana 수수료는 언제나 SOL로 지불된다. 정확한 문장:

> **SOL 가스는 플랫폼 릴레이어가 대납하고, 그 비용은 USDC 수수료로 회수한다. 유저는 SOL을 보유할 필요가 없다.**

사실이고, 서사로도 충분히 강하다. 과장할 이유가 없다.

### 그리고 — 자율성 복구 (이 문서에서 가장 중요한 항목)

fee payer 분리는 **SOL 문제만 푼다.** 사람 클릭은 그대로 남는다. 표 E·F를 다시 보자: `settlementAuthority`는 **이미 플랫폼이 소유한 고정 pubkey**다. 유저 지갑이 아니다.

그렇다면 **그 키를 브라우저에서 사람이 연결할 이유가 없다.** Secret Manager에 넣고 게이트웨이가 서버에서 서명하면, 정산이 곧바로 무인화된다.

```
현재:  evidence 통과 → 사람이 settlementAuthority 지갑을 Phantom에 연결 → 클릭 → 서명
변경:  evidence 통과 → 게이트웨이가 SM에서 settlementAuthority 키 로드 → 자동 서명 → 완료
```

`web3/gateway/src/funding.ts:379 submitAgreementMilestoneRelease`가 **이미 서버 서명 경로로 존재한다**(`escrow.ts:303`에서 호출). 즉 새로 만들 것도 없고, **`prepare-release` 대신 이 경로를 태우기만 하면 된다.**

이 변경 하나로 `CLAUDE.md`의 핵심 심사 포인트("사람 개입 없이")가 정산 경로에서 복구된다. **§1·§2를 통틀어 투자 대비 효과가 가장 큰 항목이다.**

브랜드 예치는 사람이 서명해도 서사상 문제없다 — 오히려 "내 돈을 내가 잠근다"가 자연스럽다. **핵심은 예치가 아니라 정산의 무인화**다.

---

## 3. pay.sh 활용방안

### 진단

구현은 이미 정교하다 — allowlist, per-call/run/daily cap, 멱등 operation ID, `paymentOperations`·`transactionReceipts` 기록, 실패 시 continuation 정책(표 I).

**문제는 하나: 실제로 한 번도 호출된 적이 없다.** `tests/test_paysh_sandbox.py`는 skipped, `IMPLEMENTATION_STATUS.md`는 "No real pay.sh call was executed"라고 적혀 있다.

pay.sh는 주최사(Solana 재단 + Google Cloud) 제품이고 **명시적 가산점 항목**이다. 코드가 아무리 좋아도 **호출 증거가 없으면 점수는 0이다.**

### 우선순위

| 순위 | 항목 | 이유 | 비용 |
|---|---|---|---|
| **1 (필수)** | **현 경로로 sandbox 실호출 1건 성공 + 영수증 캡처** | 가산점의 전제. 코드는 이미 완성. `pay setup` → 실제 `PAYSH_RESOURCE_ID` → Match Run 1회 | 낮음 (설정·실행뿐) |
| 2 | **Evidence 검증을 유료 API로** | 서사가 가장 강함. evidence 파이프라인은 이미 존재(Phase 10) | 중 (호출 지점 1곳) |
| 3 | 협상 라운드마다 시장가 조회 | "자율 결제가 1회성이 아님"을 증명. `MAX_NEGOTIATION_ROUNDS=5`, per-run cap 이미 존재 | 중 |
| 4 | Pay MCP를 데모에 노출 | `.mcp.json`에 `pay --sandbox mcp` 이미 등록. 장면 자체가 데모 소재 | 낮음 |

### 권장: 1을 오늘 반드시, 2를 stretch

**2번을 미는 이유를 따로 적는다.** 현재 호출 위치(Match Run 후보 검증)는 "매칭 품질 향상"이라 *왜 굳이 유료 API여야 하는지*가 심사위원에게 약하다. 반면 **정산 직전 evidence 검증**은:

- 돈이 움직이기 직전이라 **유료 검증의 필요성이 자명**하다.
- "에이전트가 스스로 비용을 지출해 리스크를 줄인다" = 에이전틱 커머스의 교과서적 사례.
- x402의 원래 용도(머신이 API에 종량 지불)와 정확히 일치.
- evidence 파이프라인이 이미 provider/observations/policy decision 구조를 갖고 있어 **붙일 자리가 파여 있다.**

**그리고 §2의 자율 정산과 맞물린다.** "에이전트가 돈 내고 확인한 뒤 → 사람 없이 정산한다"가 하나의 연속된 장면이 된다. 따로 놀던 두 기능이 하나의 이야기가 되는 게 이 조합의 진짜 값어치다.

즉 호출 지점을 **한 군데 옮기는 것만으로** 서사가 "매칭 보조 도구"에서 "자율 결제가 정산 안전성을 만든다"로 격상된다.

---

## 4. 종합 — 구현 상태 (2026-08-02 기준)

| 항목 | 근거 절 | 상태 | 구현 위치 |
|---|---|---|---|
| **정산 자동화** — evidence 통과 즉시 서버 서명 릴리즈, 실패 시 수동 fallback | §2 끝 | **완료** | `routes.py` `_try_auto_settlement` / `_perform_milestone_release`, `KNOT_AUTO_SETTLEMENT_ON_EVIDENCE`(기본 on) |
| **pay.sh 실호출 증거** | §3 | **완료** | `pay` 0.26.0 sandbox 호출 성공. `test_paysh_sandbox` skip→pass, Match Run 실결제 통합 테스트 추가 |
| **fee payer 릴레이어 대납** | §2 | **완료** | `web3/gateway/src/funding.ts` `sponsorFeePayer()`, `KNOT_RELAYER_KEYPAIR_JSON`. FE 무변경 |
| **유저 임베디드 지갑 + `walletCustody`** | §1 B | **완료** | `libs/web3/user_wallet.py`, `KNOT_USER_WALLET_PROVISION`(기본 off) |
| 영수증 가스 회계 필드(`gasLamports` 등) | §2 ⓑ | 미착수 | — |
| FE 문구·카드 반영 | §1·§2 | 미착수 (민성 레인) | prepare 응답의 `feePayer`/`gasSponsored`, `/me`의 `walletCustody` 사용 |
| README + 소개서 내러티브 | — | **완료** | `README.md`, `docs/BLOCKCHAIN_NARRATIVE.md` |

배포에 반영하려면 `scripts/deploy_cloud_run_demo.sh`가 이미 `KNOT_AUTO_SETTLEMENT_ON_EVIDENCE=1`,
`KNOT_USER_WALLET_PROVISION=1`을 넘기도록 수정돼 있다. 다만 **다음 두 가지가 선행돼야 실제로 동작한다**:

1. Web3 Gateway에 `KNOT_SETTLEMENT_KEYPAIR_JSON`이 설정되고, 그 pubkey가 `KNOT_SETTLEMENT_AUTHORITY`와 일치해야 한다. 불일치하면 자동 정산이 거부되고 수동 fallback으로 떨어진다.
2. `KNOT_USER_WALLET_PROVISION=1`은 API 런타임 SA에 Secret Manager **쓰기** 권한을 요구한다. 권한이 없으면 지갑 주소를 배정하지 않는다(비밀키 없는 주소로 정산되는 사고를 막기 위한 의도적 동작).

**08-07 stretch**: 온체인 fee bps 복원(§2 ⓐ) → Phantom Embedded(§1 C). C는 fee payer 릴레이어(3번)가 선행돼야 한다.

**손대지 말 것**: 프로그램 재배포, Firebase Auth 기준 변경, devnet config PDA 재초기화. 셋 다 되돌리기 어렵고 데모 전체를 인질로 잡는다.

---

## 5. 팀 결정이 필요한 항목

1. **정산을 무인화할 것인가** (§2 끝). 배포본은 의도적으로 Phantom 서명을 요구하도록 바꿨다(commit `93ead9e`). **의도한 설계인지, 데모를 돌리기 위한 임시 조치였는지 확인이 필요하다.** 의도였다면 해커톤 심사 포인트와의 충돌을 팀이 인지한 상태에서 내린 결정인지 다시 논의해야 한다. — **가장 먼저 답이 나와야 하는 질문.**
2. **legacy 캠페인 rail을 어떻게 할 것인가.** 지금 두 rail이 공존하고 legacy는 차단된 상태(표 G·H). 코드는 남아 있으므로 정리하거나, 아니면 명시적으로 "v1=Agreement rail"로 문서화해야 한다.
3. **신규 rail에 수수료를 언제 복원할지** (§2 ⓐ). 지금은 온체인 수익 모델이 없다.
4. **pay.sh 호출 지점을 Match Run에서 Evidence로 옮길지, 둘 다 둘지.** 둘 다면 daily cap 재산정 필요.
5. **커스터디 지갑을 기본값으로 둘지**, 고지 문구를 어떻게 할지 (§1 리스크).
6. **마감이 `CLAUDE.md`의 08-03이 맞는지.** 바뀌었다면 stretch를 본 범위로 올린다.
