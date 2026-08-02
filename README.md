# KNOT v1

브랜드 에이전트와 크리에이터 에이전트가 **사람 없이** 캠페인을 협상하고, 합의 내용을 온체인에 해시로
박은 뒤, 콘텐츠 게시가 확인되면 **프로그램이 스스로** Solana Devnet 에스크로에서 USDC를 지급한다.

```text
구글 / 이메일 로그인
 → 1페이지 역할 온보딩
 → 역할별 대시보드
 → Promotion / Offer
 → HTTP A2A 협상
 → Agreement (조건 해시)
 → 브랜드가 USDC 에스크로 예치
 → evidence(게시 증빙) 검증
 → 마일스톤 정산 → 크리에이터 지갑
```

Solana Foundation + Google Cloud Korea AI 해커톤 "Build the Future of Agentic Commerce" 출품작.

**devnet 전용이다. mainnet 자산이나 실제 가치 이전은 어디에서도 사용하지 않는다.**

---

## 1. 아키텍처

| 구성요소 | 스택 | 역할 |
|---|---|---|
| Frontend | Next.js 16 + TypeScript | 브랜드/크리에이터 대시보드, Phantom 연동 |
| Product API | FastAPI (`backend/apps/api`) | 온보딩, 매칭, Agreement, 에스크로 오케스트레이션 |
| Creator A2A Service | FastAPI (`backend/apps/creator_agent`) | 크리에이터 에이전트. AgentCard 발견 + 다회차 협상 |
| Web3 Gateway | Node/TypeScript (`web3/gateway`) | Solana 트랜잭션 생성·서명·검증. 비공개 서비스 |
| 온체인 | Anchor/Rust (`programs/knot-escrow`) | 마일스톤 에스크로, 평판 PDA |
| DB | Firestore Native | 전 도메인 문서 저장 |

오프체인 런타임은 전부 Cloud Run, DB는 Firestore Native다.

**Product API는 시뮬레이션 게이트웨이 영수증을 에스크로 성공으로 인정하지 않는다.**
확정된 Solana 서명이 있어야만 성공이다.

---

## 2. 자금 흐름 — 누가 서명하고 누가 가스를 내는가

이 표가 이 프로젝트에서 가장 중요하다.

| 단계 | 온체인 호출 | 서명자 | 네트워크 수수료 |
|---|---|---|---|
| 브랜드 예치 | `initialize_escrow` + `fund_escrow` | **브랜드 지갑 (Phantom)** | 릴레이어(설정 시), 없으면 브랜드 |
| evidence 검증 통과 | — | — | — |
| 마일스톤 정산 | `verify_milestone` + `release_milestone` | **플랫폼 정산 권한 (서버)** | 릴레이어(설정 시), 없으면 정산 권한 |

### 2.1 정산 자동화 — 사람 클릭 없음

evidence가 검증을 통과하는 **즉시** Product API가 서버 보유 정산 권한 키로 서명해 마일스톤을 지급한다.
브라우저도, 지갑 팝업도, 사람도 개입하지 않는다.

자동 정산이 실패하면 예외를 삼키고 `MILESTONE_AUTO_RELEASE_DEFERRED` 타임라인 이벤트만 남긴다.
**수동 Phantom 릴리즈 경로가 fallback으로 그대로 살아 있다.** evidence 검증 자체는 실패하지 않는다.

- 설정: `KNOT_AUTO_SETTLEMENT_ON_EVIDENCE` (기본 켜짐, 끄려면 `0`)
- 구현: `backend/apps/api/routes.py` — `_try_auto_settlement` / `_perform_milestone_release`

### 2.2 가스 대납 — 유저는 SOL을 보유하지 않는다

`KNOT_RELAYER_KEYPAIR_JSON`(또는 `_PATH`)이 설정되면, Web3 Gateway가 트랜잭션의 `feePayer`를
릴레이어로 바꾸고 **미리 부분 서명**한 뒤 미서명 트랜잭션을 브라우저에 내려보낸다.
유저는 instruction 서명만 하면 되고 SOL은 한 푼도 필요 없다.

Solana는 feePayer와 instruction 서명자의 분리를 **프로토콜 차원에서 지원**하므로 프로그램 변경이 없다.
프론트엔드 코드도 변경이 없다 — `sendPreparedSolanaTransaction`이 base64 트랜잭션을 그대로 처리한다.

prepare 응답에 `feePayer`와 `gasSponsored`가 실려 오므로 UI에서 그대로 표시할 수 있다.

> **표현 주의.** Solana 네트워크 수수료는 언제나 SOL로 지불된다.
> KNOT은 "가스를 USDC로 내는" 것이 아니라 **"플랫폼이 SOL로 대납하고 USDC 수수료로 회수하는"** 것이다.
> 소개서·발표에서 이 문장을 그대로 쓸 것.

---

## 3. 지갑 3종

| | 유저 지갑 | 정산 권한 | 가스 릴레이어 |
|---|---|---|---|
| 소유 | 유저(자기수탁) 또는 플랫폼(수탁) | 플랫폼 | 플랫폼 |
| 보관 | Phantom, 또는 Secret Manager `knot-user-key-{uid}` | Secret Manager / env | Secret Manager / env |
| 용도 | 에스크로 예치, 정산 수령 | 마일스톤 릴리즈 서명 | 네트워크 수수료 대납 |

### 3.1 임베디드 지갑 — 구글 로그인만으로 주소가 생긴다

`KNOT_USER_WALLET_PROVISION=1`이면 역할 선택 시 Solana 키페어를 생성하고, 비밀키를 Secret Manager에
저장한 뒤 `walletAddress`와 `walletCustody: "PLATFORM"`을 유저 문서에 기록한다.
유저는 Phantom 설치도 시드 문구도 필요 없다.

`POST /api/v1/me/wallet`으로 외부 Phantom 지갑을 연결하면 `walletCustody: "SELF"`로 승격된다.
**커스터디는 기본값이지 강제가 아니다.**

**크리에이터에게만 적용된다.** 크리에이터는 정산을 받기만 하므로 서명할 일이 없다. 반면 브랜드는
예치 트랜잭션을 브라우저에서 직접 서명해야 하는데, 커스터디 키로는 브라우저 서명이 불가능하다.

**비밀키 저장에 실패하면 주소를 배정하지 않는다.** 키를 모르는 주소를 정산 수령처로 삼으면
지급된 USDC를 영구히 회수할 수 없기 때문이다. 의도적 동작이다.

커스터디 지갑은 devnet 한정이다. 키 로테이션·복구 정책은 v1 범위 밖이다.

---

## 4. 온체인 — 에스크로 rail이 두 개다

`programs/knot-escrow`에는 서로 다른 두 rail이 공존한다.

| | Agreement rail (**v1 실사용**) | Campaign rail (legacy) |
|---|---|---|
| 명령 | `initialize_escrow` / `fund_escrow` / `verify_milestone` / `release_milestone` / `refund_remaining` | `initialize_campaign` / `submit_milestone` / `approve_and_release` / `refund` |
| 에스크로 PDA | Agreement ID 해시에서 파생 | 브랜드 pubkey + campaign ID |
| 예치 서명 | 브랜드 Phantom | 에이전트 키(서버) |
| 플랫폼 수수료 | **없음** | `brand_fee_bps` / `creator_fee_bps` → treasury |

**현재 유저 플로우는 Agreement rail만 사용한다.** Campaign rail은 유저 경로에서 차단돼 있고
초기 agent-funded 테스트를 위해 남아 있다.

Agreement rail에 플랫폼 수수료가 없다는 점은 알려진 공백이다. 프로그램 재배포가 필요해 v1 이후로 미뤘다.
자세한 배경은 `docs/WALLET_LOGIN_FEE_AND_PAYSH_DECISION.md` §2.

### 마일스톤

정산 분할 단위다. 각각 "언제 풀리는가(`trigger`)"와 "얼마나 풀리는가(`releasePct`, 합 100)"를 갖는다.
v1 MVP는 마일스톤이 **하나**다.

```python
Milestone(id="content", trigger="contentLiveVerified", releasePct=100)
```

즉 "콘텐츠가 실제로 게시된 게 확인되면 전액 지급"이다.

---

## 5. pay.sh / x402 — 에이전트 자율 결제

Match Run 중 후보 크리에이터를 선정한 뒤, 에이전트가 유료 API를 **스스로 결제해서** 호출한다.
게이트웨이는 주최사(Solana Foundation + Google Cloud) 제품인 **pay.sh**를 쓴다.

무제한 자율이 아니다. 지출은 세 겹의 상한 안에서만 일어난다.

| 상한 | 환경변수 |
|---|---|
| 호출당 | `PAYSH_MAX_CALL_AMOUNT_USDC` |
| 실행당 | `PAYSH_RUN_SPEND_CAP_USDC` |
| 일일 | `PAYSH_DAILY_SPEND_CAP_USDC` |

리소스는 allowlist로 제한되고(`PAYSH_ALLOWED_RESOURCE_PREFIXES`), 모든 지출은 멱등 operation ID로
기록돼 중복 결제가 불가능하다. 결과는 `paymentOperations`와 `transactionReceipts`에 남는다.

> **주의.** `PAYSH_RESOURCE_ID`가 기본값 `replace-me`이면 코드가 호출을 **SKIPPED 처리하고 넘어간다.**
> 배포 시 실제 값을 반드시 주입해야 한다. 넣지 않으면 pay.sh가 한 번도 실행되지 않는다.

활용 확장 아이디어(크리에이터 에이전트 자체를 유료 API로 판매하는 방안 등)는
`docs/PAYSH_INTEGRATION_IDEAS.md`에 정리돼 있다. **미구현이다.**

---

## 6. 시작하기

요구 사항: Python 3.12+, Node.js 20+, (온체인 작업 시) Rust · Anchor · Solana CLI.

```bash
git clone https://github.com/METHEZONE/knot.git
cd knot
cp .env.example .env
```

### 백엔드

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -e 'backend[dev]'
cd backend
../.venv/bin/python -m ruff check apps libs tests
../.venv/bin/python -m pytest tests
```

### 프론트엔드

```bash
cd frontend
npm install
npm run typecheck
npm run lint
npm run test
npm run build
```

### Web3 Gateway

```bash
cd web3/gateway
npm install
npm run build
npm run lint
npm run test
```

### pay.sh CLI

실제 x402 호출에 필요하다. 없으면 유료 검증 테스트는 skip된다.

```bash
npm install -g @solana/pay
pay --version
pay --sandbox fetch https://debugger.pay.sh/mpp/quote/AAPL
```

Windows에서는 npm postinstall이 `unzip`을 호출해 실패한다. 바이너리는 이미 내려받아져 있으니
수동으로 압축만 풀면 된다.

```powershell
$bin = "$env:APPDATA\npm\node_modules\@solana\pay\bin"
Expand-Archive "$bin\pay-x86_64-pc-windows-msvc.zip" -DestinationPath $bin -Force
```

---

## 7. 데모 계정

devnet 데모 전용이다.

| 역할 | 이메일 | 비밀번호 |
|---|---|---|
| 브랜드 | `t1@knot.com` | `000000` |
| 크리에이터 | `c1@knot.com` | `000000` |

---

## 8. 환경변수

### Product API

```text
KNOT_AUTH_MODE=firebase
FIREBASE_PROJECT_ID=knot-dev-503505
KNOT_REPOSITORY_BACKEND=firestore
GOOGLE_CLOUD_PROJECT=knot-dev-503505
KNOT_CREATOR_A2A_MODE=http
CREATOR_AGENT_BASE_URL=http://localhost:8081/a2a/v1
KNOT_A2A_SERVICE_TOKEN=...
KNOT_WEB3_MODE=gateway
WEB3_GATEWAY_BASE_URL=http://localhost:8082
KNOT_SETTLEMENT_AUTHORITY=...
KNOT_AUTO_SETTLEMENT_ON_EVIDENCE=1     # evidence 통과 시 서버 자동 정산 (기본 on)
KNOT_USER_WALLET_PROVISION=0           # 크리에이터 임베디드 지갑 자동 생성 (기본 off)
KNOT_DEV_ADMIN_ENABLED=false
KNOT_DEV_ADMIN_ALLOWLIST=
```

### 프론트엔드

```text
NEXT_PUBLIC_KNOT_DATA_MODE=api
KNOT_API_BASE_URL=http://127.0.0.1:18080
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=knot-dev-503505.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=knot-dev-503505
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
```

### Web3 Gateway (devnet 서명)

```text
KNOT_WEB3_SIGNING_MODE=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com
KNOT_ESCROW_PROGRAM_ID=9LjQL46RB4WigamSUmuEehVWF9BLz145Wv4cBxgF4Npn
KNOT_USDC_MINT=4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
KNOT_SETTLEMENT_KEYPAIR_JSON=...       # 정산 자동 서명용
KNOT_RELAYER_KEYPAIR_JSON=...          # 가스 대납용
```

### pay.sh

```text
PAYSH_MODE=sandbox
PAYSH_RESOURCE_ID=https://debugger.pay.sh/mpp/quote/AAPL
PAYSH_MAX_CALL_AMOUNT_USDC=0.02
PAYSH_RUN_SPEND_CAP_USDC=0.02
PAYSH_DAILY_SPEND_CAP_USDC=1.0
PAYSH_ALLOWED_RESOURCE_PREFIXES=https://debugger.pay.sh/mpp/quote/
PAYSH_FAILURE_POLICY=continue
```

**시크릿·개인키·서비스 계정 JSON·시드 문구·토큰은 절대 커밋하지 않는다.**

---

## 9. 시드 데이터

메모리 전용 검증:

```bash
.venv/bin/python scripts/seed_demo.py --target memory
```

Firestore 데모 리시드는 지정된 데모 프로젝트로만 가능하고 명시적 확인이 필요하다:

```bash
ALLOW_DEMO_DATA_RESET=true DEMO_PROJECT_ID=knot-dev-503505 \
.venv/bin/python scripts/seed_demo.py --target firestore --project knot-dev-503505 --confirm=RESET_KNOT_DEMO_DATA
```

devnet Phantom 데모 픽스처: `scripts/seed_devnet_phantom_demo.py`

프로덕션이나 알 수 없는 프로젝트에 리시드를 실행하지 말 것.
이 스크립트는 Firestore 픽스처 문서만 만들고 Firebase Auth 사용자는 만들지 않는다.

---

## 10. 배포

```bash
scripts/deploy_cloud_run_demo.sh
```

### 배포 전 반드시 확인할 4가지

1. **`KNOT_SETTLEMENT_KEYPAIR_JSON`의 pubkey가 `KNOT_SETTLEMENT_AUTHORITY`와 일치**해야 한다.
   불일치하면 자동 정산이 거부되고 수동 Phantom 경로로 떨어진다.
2. **`KNOT_USER_WALLET_PROVISION=1`은 API 런타임 서비스 계정에 Secret Manager 쓰기 권한**을 요구한다.
   권한이 없으면 지갑 주소를 배정하지 않는다(§3.1의 안전장치).
3. **가스 대납을 켜려면** `KNOT_RELAYER_KEYPAIR_JSON`을 넣고 릴레이어 지갑에 SOL을 채워야 한다.
4. **`PAYSH_RESOURCE_ID`에 실제 값**을 넣어야 한다. 기본값 `replace-me`면 pay.sh가 호출되지 않는다.

배포, IAM 변경, 시크릿 로테이션, 지갑 펀딩, devnet 트랜잭션 전송은
**운영자가 명시적으로 승인하지 않으면 실행하지 않는다.**

---

## 11. 문서

먼저 `AGENTS.md`를 읽고, 작업별 문서는 `docs/00_DOCUMENT_INDEX.md`에서 찾는다.

| 문서 | 내용 |
|---|---|
| `docs/IMPLEMENTATION_STATUS.md` | 능력 매트릭스, 검증 증거, 알려진 블로커 |
| `docs/WALLET_LOGIN_FEE_AND_PAYSH_DECISION.md` | 지갑 로그인 · 가스 대납 · pay.sh 결정 근거 |
| `docs/BLOCKCHAIN_NARRATIVE.md` | 소개서용 서술. **증명된 것과 아닌 것의 경계** |
| `docs/PAYSH_INTEGRATION_IDEAS.md` | pay.sh를 파는 쪽으로 쓰는 방안 (미구현) |
| `docs/WALLET_AND_MONEY_FLOW.md` | 2-지갑 모델 원본 스펙 |
| `.agent/execplans/` | 단계별 실행 계획 |

---

## 12. 알려진 정리 대상

- `backend/libs/web3/agent_wallet.py` — 브랜치 병합 과정에서 **호출자가 사라진 죽은 코드**다.
  이를 호출하던 설정(`KNOT_AGENT_WALLET_PROVISION`)과 `/me/role` 훅이 병합 시 채택되지 않았다.
  현재 유저 지갑 프로비저닝은 `user_wallet.py`가 담당한다.
- Agreement rail에 플랫폼 수수료(bps)가 없다 (§4).
- Campaign rail이 코드에 남아 있으나 유저 플로우에서는 차단돼 있다 (§4).
