from datetime import date

from libs.agents.negotiation import CreatorNegotiationContext
from libs.domain.models import CreatorPolicy, UsageRights


def demo_creator_contexts() -> dict[str, CreatorNegotiationContext]:
    return {
        "creator-agent-001": CreatorNegotiationContext(
            creatorAgentId="creator-agent-001",
            today=date(2026, 7, 30),
            currentMonthDeliverables=1,
            policy=CreatorPolicy(
                minBaseUsdc=650,
                blockedIndustries=["gambling", "cryptoTrading"],
                maxDeliverablesPerMonth=4,
                minDaysToPost=5,
                allowedUsageRights=[UsageRights.ORGANIC_ONLY, UsageRights.PAID_BOOST_30D],
                maxRevisionRounds=1,
                maxExclusivityDays=0,
            ),
        )
    }
