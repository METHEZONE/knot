# KNOT Codex Development Pack v1

이 패키지는 KNOT 해커톤 MVP를 Codex에 위임하기 위한 개발 기준 문서 모음이다.

## 핵심 원칙

- 제품 문서 버전은 **v1**이다.
- **온보딩 로직은 현재 범위에서 제외**한다. 브랜드·크리에이터·에이전트 프로필은 seed fixture 또는 관리자 스크립트로 준비한다.
- 모든 애플리케이션·에이전트·데이터·배포 인프라는 **Google Cloud 기반**으로 구현한다.
- Solana, USDC, pay.sh/x402는 결제 실행 레이어로 사용한다.
- 브랜드 홍보 사업 단위는 **프로모션(Promotion)** 으로 통일한다. 과거 명칭이나 별도 유사 용어를 새 코드와 문서에 사용하지 않는다.
- Creator 탐색·매칭은 Brand Agent가 수행한다.
- LLM은 제안과 설명을 생성하지만, 정책 검증과 결제 권한은 결정론적 코드가 통제한다.

## 권장 사용 순서

1. Codex가 저장소 루트의 `AGENTS.md`를 읽도록 한다.
2. 신규 작업 시작 전 `docs/00_INDEX.md`에서 관련 기준 문서를 확인한다.
3. 여러 파일과 서비스에 걸친 작업은 `PLANS.md` 형식으로 실행 계획을 먼저 갱신한다.
4. 작업 프롬프트는 외부 프롬프트 파일을 참고하되, 프롬프트 파일 자체는 저장소에 추적하지 않는다.
5. 완료 후 `docs/20_IMPLEMENTATION_STATUS.md`와 WBS를 업데이트한다.

## 패키지 적용

주요 코드 영역은 `frontend/`, `backend/`, `web3/` 세 곳이다. 현재 `frontend/`는 폴더만 유지하고 구현 파일은 두지 않는다. `infra/`, `scripts/`는 실제 배포나 seed/smoke 구현이 시작될 때 추가한다. 프롬프트 원본, `MANIFEST.json`, OS 임시 파일은 저장소에 넣지 않는다.

## 로컬 개발

```text
python3 -m venv .venv
.venv/bin/python -m pip install -e 'backend[dev]'
.venv/bin/python -m ruff check backend
.venv/bin/python -m pytest backend/tests
.venv/bin/python -m mypy backend/apps backend/libs
```

```text
.venv/bin/python scripts/seed_demo.py --target memory
.venv/bin/python scripts/firestore_smoke.py --target memory
.venv/bin/python scripts/seed_demo.py --target firestore --project <gcp-project-id>
.venv/bin/python scripts/firestore_smoke.py --target firestore --project <gcp-project-id>
```

```text
cd web3/gateway
npm install
npm run lint
npm test
npm run build
```
