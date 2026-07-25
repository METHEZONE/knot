# knot 블록체인 백엔드 — 세션 인계 (2026-07-23 ~ 24)

효창(블록체인 백엔드) 개발 셋팅 세션 기록 + **다른 노트북에서 이어가기** 위한 가이드.
(프로젝트 개요·컨벤션은 루트 `CLAUDE.md`, 아키텍처·인터페이스는 `docs/architecture.md` 참고.)

> **갱신(2026-07-24):** 이 브랜치는 `be`(앱 백엔드)와 병합되어 `integrate/be-blockchain`이 되었다.
> 통합 현황·남은 작업은 `docs/INTEGRATION_PLAN.md` 참고. 아래 "빌드 ✅"는 **원저자 로컬 기준**이며
> `target/`은 gitignore이므로 새 클론에서는 `anchor build`를 다시 실행해야 IDL이 생긴다.

## 이 세션 요약
- 빈 레포(`METHEZONE/knot`, README만) 클론 → **hyo0831** 계정으로 레포-로컬 인증 설정.
- 해커톤 정체 파악: **Solana Foundation + Google Cloud "Agentic Commerce" 해커톤**.
  제출 **2026-08-03**, 데모 **2026-08-07(금)**. **pay.sh / x402 / USDC / Solana 가산점** (pay.sh = 주최사 제품).
- 브랜치 `hyo/blockchain-setup` 생성 → 블록체인 백엔드 슬라이스 스캐폴딩.
- 툴체인 설치: solana-cli 4.1.1 · anchor 1.1.2(avm) · pay 0.21 · rust 1.95.
- Anchor 에스크로 프로그램 작성 → **`anchor build` 성공**, IDL 생성. program id `Hv74c9a4rKMHpsy7hgCj7a11tDRaAZG49Ss7bLscs5hu`.
- Python 백엔드(pay.sh 래퍼 / anchorpy 클라이언트 / 평판) + pytest → **단위·샌드박스 테스트 5 pass**.

## 대화·결정 로그 (시간순)
1. "knot 레포 봐줘, 작업 시작할 거임" → 빈 레포 확인·클론·hyo0831 인증.
2. 회의록 공유(팀·역할). 효창 = 백엔드 **블록체인 시스템**(Solana·x402·신원·에스크로). "내가 뭘 하면 좋을까?"
   → 역할 스코프 정리 + x402/AP2/A2A/pay.sh 지형 1차 소스 조사.
3. "브랜치 파고 개발 셋팅(CLAUDE.md·skill)" + "**pay.sh 쓰면 가산점**" → 계획 수립.
4. 결정: 범위 = **블록체인 슬라이스 + 설정/문서**(팀원 디렉토리 안 건드림), 스택 = **Anchor(Rust) + Python**,
   브랜치 = **hyo/blockchain-setup**, 테스트 = **devnet 전용**.
5. "유저플로우 어떻게 될 것 같아?" → E2E 플로우 제안 (온보딩→매칭(pay.sh)→A2A협상→에스크로펀딩→마일스톤정산→완료).
6. 자율성 = **한도 내 완전 자율**(cap 초과만 사람 서명), 마일스톤 검증 = **에이전트 attested**(pay.sh 지표검증은 옵션).
7. "대화내역 md로 깃헙에 같이 올려줘(다른 노트북)" + "작업 다 하면 push까지" → 이 문서 + push.

## 현재 상태
- **빌드**: 원저자 로컬에서 `anchor build` ✅ → `target/deploy/knot_escrow.so`, `target/idl/knot_escrow.json`.
- **테스트**: `pytest -m "not devnet"` ✅ **5 passed** (PDA 4 + pay.sh sandbox 스모크 1 — `pay --sandbox fetch` 실제 성공).
- **미완**: `anchor deploy`(devnet) 아직 안 함 → devnet 통합 테스트(`test_escrow_devnet.py`)는 skip 상태.
- **주의(관측)**: 시스템 Python 3.9로 단위테스트는 solders+pytest만 설치해 통과. `anchorpy`/`pytest-asyncio`는 미설치
  → devnet 통합 시 설치 필요(3.11+ 권장).

## 다른 노트북에서 이어가기
```bash
# 1) hyo0831로 GitHub 로그인 후 클론
gh auth login                       # github.com → hyo0831 선택 (HTTPS)
gh repo clone METHEZONE/knot
cd knot && git checkout hyo/blockchain-setup

# 2) 툴체인 (macOS). brew는 지양(파이썬 꼬임 이력) — 공식 설치 스크립트 사용
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"                 # solana-cli
cargo install --git https://github.com/coral-xyz/anchor avm --force           # avm
avm install latest && avm use latest                                          # anchor 1.1.2
npm install -g @solana/pay                                                    # pay CLI
export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.cargo/bin:$HOME/.avm/bin:$PATH"

# 3) 빌드 + 테스트
anchor build
cd backend && python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"             # anchorpy 포함 (py3.11+ 권장; 3.9면 solders+pytest만으로 단위테스트 가능)
pytest -m "not devnet"

# 4) pay.sh sandbox 확인 (펀딩 불필요)
pay --sandbox fetch https://debugger.pay.sh/mpp/quote/AAPL
```

## 다음 작업 (우선순위)
1. **`anchor deploy`(devnet)** + `backend/tests/test_escrow_devnet.py` 채우기:
   Promotion escrow initialize → `submit_milestone` → `approve_and_release`(에이전트 키, cap 이내 → 사람 없이 릴리스)
   → 크리에이터 USDC 잔액 증가 assert. (`pytest-asyncio` 설치 필요)
2. **인터페이스 계약 확정** — `docs/architecture.md §4` 열린 질문: Agreement terms → on-chain Promotion escrow 필드 매핑,
   에이전트 키(agent_authority)·지갑 발급·보관, 증빙 방식.
3. **pay.sh 실지갑**(`pay setup`) + Google Cloud/Nansen 등 실제 유료 API 데모 결제(흐름1).
4. (옵션) 마일스톤 pay.sh 지표검증, 분쟁(`raise_dispute`) 처리.

## 주의
- **devnet 전용**. mainnet 키·시크릿 커밋 금지(`.gitignore`로 keypair/.env 제외).
- 이 레포는 **hyo0831** 계정 인증(레포-로컬 credential helper). 새 머신에선 `gh auth login`으로 재설정.
- **Anchor 1.x 변경점**: `CpiContext::new(program_id: Pubkey, accounts)` — 첫 인자가 **Pubkey**(구버전은 AccountInfo).
