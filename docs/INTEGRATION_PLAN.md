# KNOT 통합 계획 — `integrate/be-blockchain`

작성 2026-07-24. `be`(앱/오케스트레이션 백엔드)와 `hyo/blockchain-setup`(온체인/결제)을
합친 통합 브랜치의 현황과 남은 작업. PRD(`docs/01_PRD_v1.md` 계열)를 기준선으로 삼는다.

## 1. 배경 — 두 브랜치

같은 PRD를 앞단/뒷단으로 나눠 각자 구현한 것을 병합했다.

- **`be`** — Product API(Promotion→매칭→협상→Agreement→Evidence), 결정론 정책 엔진, `matching-v1`,
  A2A v1.0, Firestore 저장소, `web3/gateway`(TS). 온체인/결제는 SIMULATED.
- **`hyo/blockchain-setup`** — Anchor 에스크로 프로그램(`programs/knot-escrow`), `backend/knot`
  (anchorpy 클라이언트 / pay.sh 래퍼 / 평판 PDA). 실제 코드지만 미배포·미연결.
- **`integrate/be-blockchain`** — 둘을 병합. 충돌은 `.gitignore`(합집합)와 `backend/pyproject.toml`
  (의존성·툴 설정 통합, `requires-python>=3.12`, mypy strict는 `apps`/`libs`로 한정)뿐이었고 나머지는 자동 병합.

## 2. 이번 통합 세션에서 완료 (검증됨)

- **병합 + 푸시**: `integrate/be-blockchain` 생성·push. 원본 `be`/`hyo/blockchain-setup`은 보존.
- **빌드 정상화** (통합 py3.14 환경에서 드러난 이슈 수정):
  - `anchorpy`가 딸려오며 그 pytest 플러그인이 제거된 `pytest_xprocess`를 import → 전체 수트 붕괴.
    `[tool.pytest.ini_options] addopts = "-p no:pytest_anchorpy"`로 비활성화(우리는 localnet 픽스처 미사용).
  - `knot/**` 코드가 be의 ruff 설정으로 검사되며 위반 7건(UP035/UP006/UP045/E501/I001) 수정.
  - mypy redundant-cast 1건(`libs/repositories/store.py`) 수정.
  - **검증**: `ruff` pass · `mypy` Success(38 files) · `pytest` **58 passed / 5 skipped**
    (devnet·pay.sh·firestore-emulator는 정상 gated) · gateway `lint`/`test`(5)/`build` pass.
- **escrow lock/release API 신설** (be, PRD §4.1 계약의 미구현 부분):
  - `POST /api/v1/agreements/{id}/escrow:lock`, `GET /escrows/{id}`,
    `POST /escrows/{id}/milestones/{mid}:release`, `GET /transaction-receipts/{id}`.
  - `libs/payments/settlement.py`: `lock_amount_base_units`(=base×10^6, 지급 고정액), 
    `milestone_amounts_base_units`(releasePct 분할, 나머지는 마지막 마일스톤 → 합=locked).
  - **PRD 준수**: `PLATFORM_FEE_BPS = 0`(수수료 신설 금지), lock 전 termsHash 재계산·대조,
    autoEscrow/autoRelease 게이트, release는 해당 마일스톤 evidence `PASSED` 선행,
    PaymentOperation + IdempotencyRecord + append-only auditEvent, 멱등 재요청 처리, released≤locked.
  - **한계**: 온체인 서명이 아직 없어 receipt/settlement `status: "SIMULATED"`, `signature: null`.
    `libs/payments/settlement.py`·`_simulated_receipt`가 실제 서명으로 갈아끼울 seam.
  - 테스트 14개 신설(`test_settlement.py` 4 + `test_api_escrow.py` 10).
- **설정 정렬**: be `Settings`와 gateway `config.ts` 기본값을 실제 devnet 프로그램/민트로 통일
  (`programId=Hv74c9a4rKMHpsy7hgCj7a11tDRaAZG49Ss7bLscs5hu`,
  `mint=4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`, `network=solanaDevnet`).

## 3. PRD 준수 매트릭스 (갱신)

| 영역 | 상태 | 비고 |
|---|---|---|
| LLM은 결제 승인 불가 / 결정론 게이트 | ✅ | be에 LLM 없음, 순수 규칙 |
| 매칭(필터·가중치·타이브레이크) | ✅ | PRD 수치 일치 |
| A2A v1.0, Part.data, messageId 멱등, 5라운드, Artifact | ✅ | 외부 HTTP 오케스트레이션은 후속 |
| Agreement + SHA-256 termsHash(정준 JSON) | ✅ | |
| 도메인 모델/컬렉션 | ✅ | escrow/settlement/payment/receipt 경로 이제 사용됨 |
| escrow lock/release API + 계약 | ✅ (SIMULATED) | 온체인 서명 배선 전까지 시뮬 |
| 수수료 미신설(불변식5) | ✅ | be lock=고정액, fee 0. **온체인도 fee_bps=0로 config 필요** |
| 멱등/감사/정책 게이트 | ✅ | |
| 실제 devnet lock/release 서명 | ⬜ | 데모 하드게이트 — §4-B/C |
| pay.sh/x402 흐름1을 Brand Agent에 연결 | ⬜ | §4-D |
| Gemini/Vertex AI 설명 생성 | ⬜(베이스라인 허용) | 판정 가점·텔레메트리 |
| Evidence 실제/명시 fixture | ⚠️ | 현재 URL 토큰 시뮬(PRD v1 fixture 허용) |
| 프론트(Society Map/Timeline) | ⬜ | 데모 필수 — §4-F |
| Cloud Run 배포 | ⬜ | 데모 필수 — §4-E |
| 용어 정리 | ⚠️ | Product/API/Firestore는 Promotion으로 통일. 기존 Anchor legacy `campaign` 명칭은 Promotion escrow로 매핑 |

## 4. 남은 작업 & 실행 런북

이 머신엔 Rust/Anchor/Solana CLI·gcloud·pay가 없어 아래는 해당 툴체인+자격증명 환경에서 실행해야 한다.

### A. 중복 stub Anchor 프로그램 제거
완료. be의 no-op stub `web3/program/`은 제거했고 실제 프로그램
`programs/knot-escrow`만 남긴다.

### B. Anchor 빌드 + devnet 배포 (실제 서명 게이트 해제)
`target/idl`·`target/deploy`는 gitignore라 새 클론엔 없다 → 반드시 재빌드.
```bash
solana config set --url devnet && solana airdrop 2
anchor build              # target/idl/knot_escrow.json 생성 → anchorpy 클라이언트 언블록
anchor deploy             # devnet 배포 (program id 고정: Hv74…s5hu)
# devnet USDC-SPL 토큰계정 + 펀딩 후:
KNOT_RUN_DEVNET=1 pytest backend/tests/test_escrow_devnet.py   # (현재 skip 스텁 → 본문 작성 필요)
```

### C. 실제 온체인 서명 배선 (SIMULATED → 실제)
`libs/payments/settlement.py` seam과 escrow API의 receipt 생성부를 실제 서명으로 교체. 두 선택지:
1. **be가 `knot.escrow.client`(anchorpy) 직접 호출** — Python 단일 스택. 서명 지갑은 Secret Manager.
2. **TS `knot-web3` 게이트웨이가 서명** — PRD 아키텍처. `web3/gateway`에 실제 서명 추가, be는 HTTP 호출.
   → 결정 필요. 어느 쪽이든 **on-chain fee_bps=0**로 `initialize_config` 호출해야 lock 금액이 be 계산과 일치.
   협상 마일스톤(%) → `initialize_campaign`의 `milestone_amounts`(절대 USDC) 매핑은 `milestone_amounts_base_units` 사용.

### D. pay.sh / x402 (흐름1) 연결
`backend/knot/payments/paysh.py`를 Brand Agent 매칭 흐름의 1회 유료 검증 호출로 연결(sandbox), provider/price/receipt 저장.
실패한 결제는 크리에이터를 승인하지 않음(재시도/에스컬레이트). `pay` CLI 필요.

### E. Cloud Run 배포
`knot-api`, `creator-agent`, `knot-web3` 컨테이너 빌드·배포(Dockerfile 존재), Firestore Native 연결, seed/reset 스크립트, health/readiness. "Live Cloud Run URL"은 데모 하드게이트.

### F. 프론트엔드
Agent Society Map + Promotion Timeline(Next.js, `/promotions/{id}/timeline` 활용). Cloud Run 배포. 데모 필수.

### G. 용어/네이밍 정리
Product API, Firestore, frontend, runbook 문서는 `Promotion` / `promotionId`를
사용한다. 현재 Anchor program과 `backend/knot/escrow`의 `campaign`
instruction/account 명칭은 legacy on-chain API로 한정하며, Product API payload나
UI에는 노출하지 않는다. Web3 담당자가 프로그램 API rename을 진행할 때
`initialize_campaign` -> `initialize_promotion_escrow` 같은 명칭으로 바꾸고
IDL/client/tests/docs를 같은 커밋에서 갱신한다.

## 5. 빌드 산출물 주의
`target/`, `node_modules/`, `.venv/`는 gitignore. 새 클론에서는 `anchor build` / `npm install` /
`pip install -e 'backend[dev]'`를 다시 실행해야 한다. (HANDOFF.md의 "빌드 ✅"는 원저자 로컬 기준.)
