from __future__ import annotations

import json
import logging
import shutil
import subprocess
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Optional

logger = logging.getLogger(__name__)


class PayCliNotFound(RuntimeError):
    """Raised when the pay.sh CLI is not available on PATH."""


class PayShError(Exception):
    """pay.sh payment or API call failed."""
    pass


def _pay_bin() -> str:
    path = shutil.which("pay")
    if not path:
        raise PayCliNotFound("pay CLI was not found on PATH")
    return path


@dataclass(frozen=True)
class PayResult:
    ok: bool
    returncode: int
    body: str
    stderr: str


@dataclass
class PaymentReceipt:
    """Receipt for pay.sh verification payment"""
    provider: str
    cost_usdc: float
    paid_at: datetime
    verification_result: dict[str, Any]
    transaction_id: Optional[str] = None


def fetch(resource_id: str, *, sandbox: bool = True, timeout_seconds: int = 90) -> PayResult:
    """Call one pay.sh/x402-priced resource through the pay CLI.

    The CLI handles the x402 challenge/payment flow. The caller decides whether
    the returned receipt is authoritative for display; it must never authorize
    matching, escrow lock, or release decisions.
    """
    args = [_pay_bin()]
    if sandbox:
        args.append("--sandbox")
    args += ["fetch", resource_id]
    proc = subprocess.run(
        args,
        capture_output=True,
        text=True,
        timeout=timeout_seconds,
        check=False,
    )
    return PayResult(
        ok=proc.returncode == 0,
        returncode=proc.returncode,
        body=proc.stdout,
        stderr=proc.stderr,
    )


def verify_creator(
    profile_url: str,
    *,
    sandbox: bool = True,
    max_price_usdc: float = 0.10,
    provider: str = "nansen",
) -> PaymentReceipt:
    """
    Verify creator authenticity using paid API via pay.sh

    Args:
        profile_url: Social media profile URL (Instagram/YouTube/TikTok)
        sandbox: If True, simulate without real payment
        max_price_usdc: Maximum acceptable price for verification
        provider: "nansen" or "hypeauditor"

    Returns:
        PaymentReceipt with verification results:
        - bot_percentage: 0.0 to 1.0 (likelihood of fake followers)
        - engagement_quality: "high", "medium", "low"
        - follower_count: Estimated real follower count
        - verified: Whether profile is verified by platform

    Raises:
        PayShError: If payment fails or API returns error
    """
    if sandbox:
        logger.info(f"[SANDBOX] Simulating creator verification for {profile_url}")
        return _simulate_creator_verification(profile_url, provider)

    # Real implementation: pay curl to verification API
    api_url = _get_verification_api_url(provider, "creator")

    try:
        result = _pay_curl(
            url=api_url,
            method="POST",
            data={"profile_url": profile_url},
            max_price_usdc=max_price_usdc,
            sandbox=False,
        )

        return PaymentReceipt(
            provider=provider,
            cost_usdc=result.get("x402_cost", max_price_usdc),
            paid_at=datetime.utcnow(),
            verification_result=result.get("result", {}),
            transaction_id=result.get("x402_tx_id"),
        )

    except Exception as e:
        raise PayShError(f"Creator verification failed: {e}")


def verify_content(
    content_url: str,
    brand_keywords: list[str],
    *,
    sandbox: bool = True,
    max_price_usdc: float = 0.50,
) -> PaymentReceipt:
    """
    Verify content quality and brand alignment using paid API via pay.sh

    Args:
        content_url: Posted content URL (Instagram post, YouTube video, etc.)
        brand_keywords: Brand-related keywords to check for
        sandbox: If True, simulate without real payment
        max_price_usdc: Maximum acceptable price for verification

    Returns:
        PaymentReceipt with verification results:
        - sentiment_score: -1.0 to 1.0 (negative to positive)
        - brand_mention_found: bool
        - estimated_reach: Estimated view/impression count
        - quality_score: 0.0 to 1.0 (content quality)

    Raises:
        PayShError: If payment fails or API returns error
    """
    if sandbox:
        logger.info(f"[SANDBOX] Simulating content verification for {content_url}")
        return _simulate_content_verification(content_url, brand_keywords)

    # Real implementation: pay curl to Brandwatch API
    api_url = _get_verification_api_url("brandwatch", "content")

    try:
        result = _pay_curl(
            url=api_url,
            method="POST",
            data={
                "content_url": content_url,
                "keywords": brand_keywords,
            },
            max_price_usdc=max_price_usdc,
            sandbox=False,
        )

        return PaymentReceipt(
            provider="brandwatch",
            cost_usdc=result.get("x402_cost", max_price_usdc),
            paid_at=datetime.utcnow(),
            verification_result=result.get("result", {}),
            transaction_id=result.get("x402_tx_id"),
        )

    except Exception as e:
        raise PayShError(f"Content verification failed: {e}")


def _pay_curl(
    url: str,
    method: str,
    data: dict,
    max_price_usdc: float,
    sandbox: bool,
) -> dict:
    """Execute pay curl with x402 payment"""
    try:
        args = [_pay_bin()]
        if sandbox:
            args.append("--sandbox")

        args += [
            "curl",
            url,
            "-X", method,
            "-H", "Content-Type: application/json",
            "-d", json.dumps(data),
            "--max-price", str(max_price_usdc),
        ]

        proc = subprocess.run(
            args,
            capture_output=True,
            text=True,
            timeout=120,
            check=False,
        )

        if proc.returncode != 0:
            raise PayShError(f"pay curl failed: {proc.stderr}")

        # Parse JSON response
        response = json.loads(proc.stdout)
        return response

    except json.JSONDecodeError as e:
        raise PayShError(f"Invalid JSON response from pay curl: {e}")
    except Exception as e:
        raise PayShError(f"pay curl execution error: {e}")


def _get_verification_api_url(provider: str, endpoint_type: str) -> str:
    """Get verification API endpoint URL"""
    # These would be real API endpoints in production
    # For hackathon demo, these are placeholder URLs
    urls = {
        "nansen": {
            "creator": "https://api.nansen.ai/v1/social/verify",
        },
        "hypeauditor": {
            "creator": "https://api.hypeauditor.com/v1/creator/verify",
        },
        "brandwatch": {
            "content": "https://api.brandwatch.com/v1/content/analyze",
        },
    }

    return urls.get(provider, {}).get(endpoint_type, "")


# ============= SANDBOX SIMULATION =============

def _simulate_creator_verification(
    profile_url: str,
    provider: str,
) -> PaymentReceipt:
    """
    Simulate creator verification for sandbox mode
    Returns realistic fake data for development
    """
    import random
    import hashlib

    # Deterministic fake data based on URL hash
    url_hash = int(hashlib.md5(profile_url.encode()).hexdigest()[:8], 16)
    random.seed(url_hash)

    # Simulate verification result
    bot_percentage = random.uniform(0.05, 0.30)
    follower_count = random.randint(5000, 500000)

    engagement_quality = "high"
    if bot_percentage > 0.20:
        engagement_quality = "medium"
    if bot_percentage > 0.25:
        engagement_quality = "low"

    verification_result = {
        "bot_percentage": round(bot_percentage, 3),
        "engagement_quality": engagement_quality,
        "follower_count": follower_count,
        "verified": bot_percentage < 0.15,
        "profile_url": profile_url,
        "provider": provider,
    }

    logger.info(
        f"[SANDBOX] Creator verification simulated: "
        f"bot_percentage={bot_percentage:.2%}, "
        f"engagement={engagement_quality}"
    )

    return PaymentReceipt(
        provider=provider,
        cost_usdc=0.10,  # Simulated cost
        paid_at=datetime.utcnow(),
        verification_result=verification_result,
        transaction_id=f"sandbox_tx_{url_hash}",
    )


def _simulate_content_verification(
    content_url: str,
    brand_keywords: list[str],
) -> PaymentReceipt:
    """
    Simulate content verification for sandbox mode
    Returns realistic fake data for development
    """
    import random
    import hashlib

    # Deterministic fake data based on URL hash
    url_hash = int(hashlib.md5(content_url.encode()).hexdigest()[:8], 16)
    random.seed(url_hash)

    # Simulate content analysis
    sentiment_score = random.uniform(0.5, 1.0)  # Mostly positive
    estimated_reach = random.randint(10000, 1000000)
    quality_score = random.uniform(0.6, 0.95)

    # Check if any brand keyword appears in URL (simple simulation)
    brand_mention_found = any(
        keyword.lower() in content_url.lower()
        for keyword in brand_keywords
    ) if brand_keywords else True

    verification_result = {
        "sentiment_score": round(sentiment_score, 3),
        "brand_mention_found": brand_mention_found,
        "estimated_reach": estimated_reach,
        "quality_score": round(quality_score, 3),
        "content_url": content_url,
        "keywords_checked": brand_keywords,
    }

    logger.info(
        f"[SANDBOX] Content verification simulated: "
        f"sentiment={sentiment_score:.2f}, "
        f"reach={estimated_reach:,}, "
        f"quality={quality_score:.2f}"
    )

    return PaymentReceipt(
        provider="brandwatch",
        cost_usdc=0.50,  # Simulated cost
        paid_at=datetime.utcnow(),
        verification_result=verification_result,
        transaction_id=f"sandbox_tx_{url_hash}",
    )
