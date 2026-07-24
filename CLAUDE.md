# knot — 블록체인 백엔드 (CLAUDE.md)

## 프로젝트
knot = **Solana Foundation + Google Cloud Korea AI 해커톤 ("Build the Future of Agentic Commerce")** 출품작.
크리에이터(인플루언서) 에이전트 ↔ 브랜드 에이전트가 캠페인을 협상하고, **사람 승인 없이(한도 내) x402로 결제**하며, **Anchor 에스크로로 마일스톤 정산**하는 플랫폼.

- 제출 마감: **2026-08-03** / 데모데이: **2026-08-07(금)**
- 심사 포인트: 에이전트가 사람 개입 없이 x402로 API를 자율 결제 + **pay.sh / USDC / Solana 사용이 가산점** (pay.sh는 주최사=Solana 재단+Google Cloud 제품).

## 이 레포에서 내 역할 (효창 = 블록체인 백엔드)
- Solana 온체인: 마일스톤 에스크로 프로그램(Anchor/Rust), 신원/평판 PDA.
- 결제: x402 / **pay.sh** 연동(Python), USDC-SPL(devnet).
- **경계**: 예원=에이전트 시스템/온보딩, 민성=프론트/UX/PRD. 그쪽 디렉토리(`agents/`, `web/`)는 이 셋팅에서 만들지 않는다. A2A 계약 스키마는 예원과 공동.

## 아키텍처 — 결제 흐름이 둘
1. **pay.sh / x402 (API 소비 결제)**: 에이전트가 유료 API(Gemini/Nansen 등)를 호출당 자율 결제. → 해커톤 핵심 과제 + 가산점.
2. **Anchor 에스크로 (캠페인 정산)**: 브랜드→크리에이터 마일스톤 USDC 자동 지급. → 제품 핵심 가치.

레이어: A2A(에이전트 통신) · x402/pay.sh(결제) · Anchor 에스크로(정산) · 신원/평판(PDA).
유저 플로우·인터페이스 계약 상세: `docs/architecture.md`.

## 스택 / 디렉토리
- `programs/knot-escrow/` — Anchor(Rust) 에스크로 프로그램.
- `backend/` — Python. `knot/payments/`(pay.sh 래퍼), `knot/escrow/`(anchorpy 클라이언트), `knot/identity/`(평판 PDA). 테스트 `backend/tests/`(pytest, devnet).
- Anchor 테스트 러너 = pytest (`Anchor.toml`의 `[scripts] test`).

## 개발 명령어
```bash
# Solana devnet
solana config set --url devnet
solana airdrop 2

# Anchor
anchor build
anchor deploy            # devnet
anchor test              # → pytest 실행

# Python 백엔드
cd backend && python3 -m venv .venv && source .venv/bin/activate && pip install -e .
pytest

# pay.sh (sandbox: 펀딩 불필요)
pay --sandbox curl https://debugger.pay.sh/mpp/quote/AAPL
pay setup                # 실지갑 (OS 키체인)
```

## 검증된 프로토콜 사실 (2026-07 조사 — 재조사 방지)
- **x402**는 Solana 지원됨(`@x402/svm`, 공식). 결제 토큰 = **USDC-SPL**.
- 파실리테이터: **PayAI**(Solana 최대), **Coinbase CDP**, **pay.sh**(Solana 재단+Google Cloud — x402 위 게이트웨이 + Pay MCP).
- **Python + Solana x402 직접 SDK는 아직 미성숙**(공식 문서 명시). → **pay.sh CLI/MCP로 우회**(언어 무관). 온체인 에스크로 호출은 `anchorpy`/`solders`.
- 마일스톤 에스크로는 표준 프로그램이 없어 **직접 구현**(이 레포 최대 공수 항목).

## 컨벤션 / 안전
- 브랜치: `hyo/<작업>` (예: `hyo/blockchain-setup`) → main으로 PR.
- **devnet 전용**. mainnet 키·시크릿은 절대 커밋 금지(`.gitignore`, `pay setup`은 OS 키체인 사용).
- 이 레포 GitHub 계정 = **hyo0831**. 로컬에 여러 gh 계정이 있으면 이 레포만 hyo0831로 인증되도록 레포 로컬 credential helper를 설정. 새 노트북에선 `gh auth login`으로 hyo0831 로그인 후 클론(자세한 재개 절차는 `docs/HANDOFF.md`).
