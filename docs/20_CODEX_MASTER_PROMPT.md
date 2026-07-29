# Codex Master Prompt — KNOT v2

저장소를 직접 수정하라.

1. `docs/KNOT_PRODUCT_MASTER_SPEC_V2.md`와 `docs/00_DOCUMENT_INDEX.md`를 최우선 source of truth로 사용한다.
2. UI/UX는 `origin/feat/two-user-session`을 기준으로 한다.
3. Backend/API/A2A/Agreement/Escrow/Settlement는 실제 기능이 동작하는 안정 브랜치를 기준으로 한다.
4. 기존 통합 브랜치를 백업하고 UI branch 기반 새 worktree에서 시작한다.
5. old/new onboarding, dashboard, settings를 섞지 않는다.
6. Adapter/ViewModel로 UI와 기존 API를 연결한다.
7. `매니저 붙이기` 후 Dashboard로 이동하고 협상은 시작하지 않는다.
8. Creator `협찬 받기`, Brand `협찬 제안하기`가 Agent run의 시작점이다.
9. Dashboard에는 요약, Negotiation Detail에는 전체 Agent 대화가 있어야 한다.
10. 여러 협상과 거절 내역을 저장·조회한다.
11. 상대 private policy, raw prompt, chain-of-thought를 노출하지 않는다.
12. 실제 A2A OFFER→COUNTER→ACCEPT/REJECT/ESCALATE를 구현한다.
13. 최종 Artifact에서 exactly-once Agreement와 deterministic termsHash를 생성한다.
14. Web3 Gateway를 통해 Solana localnet/devnet Escrow lock과 milestone release를 구현한다.
15. API mode에서 fake metrics, fake hash, fake signature, silent mock fallback을 금지한다.
16. `/mypage` 하나와 `SettingsScreen.tsx` 디자인으로 설정을 통일한다.
17. Phase별로 테스트·스크린샷·커밋·`IMPLEMENTATION_STATUS.md` 갱신을 수행한다.
18. mainnet과 main 직접 push를 금지한다.
19. 최종적으로 lint/typecheck/test/build/E2E/devnet smoke와 Cloud Run 배포까지 수행한다.
20. 실제 권한·secret이 없어 수행 못한 단계만 증거와 함께 BLOCKED로 기록한다.
