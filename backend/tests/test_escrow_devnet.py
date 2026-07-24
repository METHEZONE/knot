"""에스크로 devnet 통합 테스트 (KNOT_RUN_DEVNET=1 일 때만 실행).

전제: `anchor deploy`(devnet) 완료 + 펀딩된 devnet 지갑 + USDC-SPL 토큰계정.
현재는 배포/펀딩/토큰계정 자동화가 미완이라 기본 skip. (다음 작업 — docs/architecture.md의 E2E 참고)
"""
import os

import pytest

pytestmark = pytest.mark.devnet

_RUN = os.environ.get("KNOT_RUN_DEVNET") == "1"


@pytest.mark.skipif(not _RUN, reason="KNOT_RUN_DEVNET!=1 (devnet 배포/펀딩 필요)")
def test_full_milestone_flow():
    # TODO(다음 작업):
    #   1) initialize_campaign(총액 USDC 예치)
    #   2) submit_milestone(index=0)
    #   3) approve_and_release(index=0)  # 에이전트 키, cap 이내 → 사람 개입 없이 릴리스
    #   4) 크리에이터 USDC 잔액이 마일스톤 금액만큼 증가했는지 assert
    #   5) Reputation PDA(total_settled) 갱신 확인
    pytest.skip("devnet 배포/펀딩/토큰계정 자동화 미완 — 다음 작업")
