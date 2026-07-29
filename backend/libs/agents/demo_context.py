from datetime import date

from libs.agents.negotiation import CreatorNegotiationContext
from libs.domain.models import CreatorPolicy, UsageRights


def demo_creator_contexts() -> dict[str, CreatorNegotiationContext]:
    return {
        "creator-agent-001": _context("creator-agent-001", min_base_usdc=650, min_days=5),
        "creator-agent-002": _context(
            "creator-agent-002",
            min_base_usdc=500,
            min_days=5,
        ),
        "creator-agent-003": _context("creator-agent-003", min_base_usdc=400, min_days=7),
    }


def _context(
    creator_agent_id: str,
    *,
    min_base_usdc: int,
    min_days: int,
    allowed_usage_rights: list[UsageRights] | None = None,
) -> CreatorNegotiationContext:
    return CreatorNegotiationContext(
        creatorAgentId=creator_agent_id,
        today=date(2026, 7, 24),
        currentMonthDeliverables=1 if creator_agent_id == "creator-agent-001" else 0,
        policy=CreatorPolicy(
            minBaseUsdc=min_base_usdc,
            blockedIndustries=["gambling", "cryptoTrading"],
            maxDeliverablesPerMonth=4,
            minDaysToPost=min_days,
            allowedUsageRights=allowed_usage_rights
            or [UsageRights.ORGANIC_ONLY, UsageRights.PAID_BOOST_30D],
            maxRevisionRounds=1,
            maxExclusivityDays=0,
        ),
    )
