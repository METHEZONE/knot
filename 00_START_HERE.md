# KNOT v1 Reboot — 문서 교체 및 실행 가이드

이 패키지는 기존 KNOT 문서를 대체하는 **단일 Source of Truth**다.

이번 리부트의 목적은 화면을 새로 만드는 것이 아니라 다음 구조를 실제 데이터로 완성하는 것이다.

```text
실제 로그인
→ 역할별 1페이지 온보딩
→ 실제 계정·프로필 생성
→ 역할별 대시보드
→ Promotion / Offer
→ 실제 A2A 협상
→ Agreement
→ Solana devnet Escrow
```

Society Map은 MVP 범위에서 제외한다.

## 기존 문서 처리

기존 문서를 즉시 삭제하지 말고 먼저 `docs/_archive_pre_reboot_YYYYMMDD/`로 이동한다.

Archive 대상:

- 과거 PRD와 사용자 플로우
- `/brand/negotiate`, `/brand/result`, `/brand/settlement` 중심 명세
- mock 중심 프론트 구현 프롬프트
- 길어진 온보딩 명세
- Society Map 포함 문서
- 서로 충돌하는 Agent/A2A 문서

유지 가능한 참고 자료:

- `DESIGN.md`
- 디자인 에셋
- 실제 코드와 일치하는 배포 명령
- 공식 A2A 규격을 반영한 조사 원문

## 저장소에 복사할 구조

```text
/
├── AGENTS.md
├── PLANS.md
├── docs/
├── prompts/
└── .codex/
```

## 실행 순서

```text
Phase 0  저장소 감사·문서 교체·구 코드 분류
Phase 1  Firebase Auth와 실제 사용자 세션
Phase 2  1페이지 온보딩과 역할별 대시보드
Phase 3  Promotion/Offer/Agreement 중심 resource route
Phase 4  실제 HTTP A2A
Phase 5  실제 Solana devnet escrow
Phase 6  안전한 /dev/admin
Phase 7  E2E·mock 제거·구 route 정리
```

각 Phase는 별도 Codex 세션에서 실행한다. 해당 `prompts/` 파일 하나와 그 파일이 지정한 문서만 읽힌다.

## 중요한 원칙

- 기존 UI component와 디자인 시스템을 최대한 재사용한다.
- 전체 코드를 한 번에 갈아엎지 않는다.
- API mode에서 성공 mock fallback을 허용하지 않는다.
- Seed는 `/dev/admin`의 명시적 작업으로만 만든다.
- Firebase Auth UID와 Firestore 문서가 실제 계정의 기준이다.
- dev admin은 관리자 권한 없이는 접근할 수 없다.
- 사용자 삭제는 Firebase Auth와 Firestore를 함께 처리하고 audit log를 남긴다.
- 실제 A2A는 Product API와 Creator A2A Service 사이의 HTTP 통신이다.
- 실제 escrow 성공은 Solana devnet signature가 확인된 경우에만 표시한다.
