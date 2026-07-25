import json
from pathlib import Path

from libs.agents.matching import rank_creators
from libs.domain.models import CreatorProfile, Promotion
from tests.test_domain_models import promotion_payload


def load_creators() -> list[CreatorProfile]:
    fixture_path = Path(__file__).resolve().parents[1] / "fixtures" / "creators.json"
    payload = json.loads(fixture_path.read_text(encoding="utf-8"))
    return [CreatorProfile.model_validate(item) for item in payload]


def test_matching_ranks_eligible_creators_deterministically() -> None:
    ranked = rank_creators(Promotion.model_validate(promotion_payload()), load_creators())
    fixture_path = Path(__file__).resolve().parents[1] / "fixtures" / "matching_golden.json"
    expected = json.loads(fixture_path.read_text(encoding="utf-8"))["expectedOrder"]

    assert [
        {
            "creatorAgentId": result.creator_agent_id,
            "eligible": result.eligible,
            "score": result.score,
            "rank": result.rank,
            "hardFilterReasons": result.hard_filter_reasons,
        }
        for result in ranked
    ] == expected


def test_matching_tie_breaks_by_completed_deals_then_price_then_id() -> None:
    payload = promotion_payload()
    payload["constraints"] = {"requiredCategories": ["beauty"]}
    promotion = Promotion.model_validate(payload)
    creators = [
        CreatorProfile.model_validate(
            {
                "creatorId": "creator-a",
                "creatorAgentId": "creator-agent-b",
                "displayName": "B",
                "categories": ["beauty"],
                "prohibitedIndustries": [],
                "supportedDeliverableFormats": ["reel"],
                "allowedUsageRights": ["paidBoost30d"],
                "minDaysToPost": 5,
                "availableFrom": "2026-08-01",
                "monthlyCapacity": 4,
                "activeDeliverablesThisMonth": 0,
                "completedDealCount": 10,
                "rateCard": {"minBaseUsdc": 500, "maxBaseUsdc": 800},
                "active": True,
            }
        ),
        CreatorProfile.model_validate(
            {
                "creatorId": "creator-b",
                "creatorAgentId": "creator-agent-a",
                "displayName": "A",
                "categories": ["beauty"],
                "prohibitedIndustries": [],
                "supportedDeliverableFormats": ["reel"],
                "allowedUsageRights": ["paidBoost30d"],
                "minDaysToPost": 5,
                "availableFrom": "2026-08-01",
                "monthlyCapacity": 4,
                "activeDeliverablesThisMonth": 0,
                "completedDealCount": 10,
                "rateCard": {"minBaseUsdc": 500, "maxBaseUsdc": 800},
                "active": True,
            }
        ),
    ]

    ranked = rank_creators(promotion, creators)
    assert [result.creator_agent_id for result in ranked] == [
        "creator-agent-a",
        "creator-agent-b",
    ]
