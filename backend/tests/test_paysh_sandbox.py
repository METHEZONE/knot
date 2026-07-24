"""pay.sh sandbox 스모크 — pay CLI로 유료 API를 펀딩 없이 호출(결제 흐름 1)."""
import shutil

import pytest

from knot.payments import paysh

pytestmark = pytest.mark.integration


@pytest.mark.skipif(shutil.which("pay") is None, reason="pay CLI 미설치 (npm i -g @solana/pay)")
def test_sandbox_fetch_quote():
    res = paysh.fetch("https://debugger.pay.sh/mpp/quote/AAPL", sandbox=True)
    # 게이트웨이/네트워크 상태에 따라 흔들릴 수 있음. 최소한 CLI가 정상 종료하고 응답이 있어야 함.
    assert res.returncode == 0, res.stderr
    assert res.body
