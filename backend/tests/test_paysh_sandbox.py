"""pay.sh sandbox 스모크 — pay CLI로 유료 API를 펀딩 없이 호출(결제 흐름 1)."""
import shutil

import pytest

from libs.payments import paysh

pytestmark = pytest.mark.integration


@pytest.mark.skipif(shutil.which("pay") is None, reason="pay CLI 미설치 (npm i -g @solana/pay)")
def test_sandbox_fetch_quote():
    res = paysh.fetch("https://debugger.pay.sh/mpp/quote/AAPL", sandbox=True)
    # 게이트웨이/네트워크 상태에 따라 흔들릴 수 있음. 최소한 CLI가 정상 종료하고 응답이 있어야 함.
    assert res.returncode == 0, res.stderr
    assert res.body


def test_sandbox_creator_verification():
    """Test creator verification in sandbox mode (no real payment)"""
    receipt = paysh.verify_creator(
        profile_url="https://instagram.com/test_creator",
        sandbox=True,
        max_price_usdc=0.10,
        provider="nansen",
    )

    # Verify receipt structure
    assert receipt.provider == "nansen"
    assert receipt.cost_usdc == 0.10
    assert receipt.paid_at is not None
    assert receipt.transaction_id is not None

    # Verify result contains expected fields
    result = receipt.verification_result
    assert "bot_percentage" in result
    assert "engagement_quality" in result
    assert "follower_count" in result
    assert "verified" in result
    assert "profile_url" in result

    # Verify reasonable values
    assert 0.0 <= result["bot_percentage"] <= 1.0
    assert result["engagement_quality"] in ["high", "medium", "low"]
    assert result["follower_count"] > 0


def test_sandbox_content_verification():
    """Test content verification in sandbox mode (no real payment)"""
    receipt = paysh.verify_content(
        content_url="https://instagram.com/p/test_post_abc",
        brand_keywords=["product", "brand"],
        sandbox=True,
        max_price_usdc=0.50,
    )

    # Verify receipt structure
    assert receipt.provider == "brandwatch"
    assert receipt.cost_usdc == 0.50
    assert receipt.paid_at is not None
    assert receipt.transaction_id is not None

    # Verify result contains expected fields
    result = receipt.verification_result
    assert "sentiment_score" in result
    assert "brand_mention_found" in result
    assert "estimated_reach" in result
    assert "quality_score" in result
    assert "content_url" in result
    assert "keywords_checked" in result

    # Verify reasonable values
    assert -1.0 <= result["sentiment_score"] <= 1.0
    assert isinstance(result["brand_mention_found"], bool)
    assert result["estimated_reach"] > 0
    assert 0.0 <= result["quality_score"] <= 1.0


def test_sandbox_creator_verification_deterministic():
    """Test that same URL produces same verification result (deterministic)"""
    url = "https://instagram.com/consistent_creator"

    receipt1 = paysh.verify_creator(url, sandbox=True)
    receipt2 = paysh.verify_creator(url, sandbox=True)

    # Same URL should produce same bot percentage
    assert receipt1.verification_result["bot_percentage"] == receipt2.verification_result["bot_percentage"]
    assert receipt1.verification_result["engagement_quality"] == receipt2.verification_result["engagement_quality"]
    assert receipt1.verification_result["follower_count"] == receipt2.verification_result["follower_count"]
