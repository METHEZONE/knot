from datetime import date

import pytest
from pydantic import ValidationError

from libs.domain.models import AgreementTerms, PostingWindow, Promotion


def promotion_payload() -> dict[str, object]:
    return {
        "promotionId": "promotion-001",
        "brandId": "brand-001",
        "brandAgentId": "brand-agent-001",
        "title": "Summer skincare launch",
        "objective": "awareness",
        "category": "beauty",
        "targetAudience": ["20s", "skincare"],
        "budget": {"totalUsdc": 2000, "maxPerCreatorUsdc": 800},
        "deliverables": [{"format": "reel", "count": 1}],
        "postingWindow": {"start": "2026-08-05", "end": "2026-08-10"},
        "usageRights": "paidBoost30d",
        "constraints": {
            "requiredDisclosures": ["ad"],
            "prohibitedClaims": [],
            "requiredCategories": ["beauty"],
        },
        "autonomy": {"maxNegotiationRounds": 5, "autoEscrow": True, "autoRelease": True},
    }


def terms_payload(base_amount_usdc: int = 650) -> dict[str, object]:
    return {
        "compensation": {
            "structure": "flat",
            "baseAmountUsdc": base_amount_usdc,
            "performancePct": 0,
        },
        "deliverables": [
            {
                "format": "reel",
                "count": 1,
                "postWindow": {"start": "2026-08-05", "end": "2026-08-10"},
                "revisionRounds": 1,
            }
        ],
        "usageRights": "paidBoost30d",
        "milestones": [
            {"id": "contract", "trigger": "contractSigned", "releasePct": 30},
            {"id": "content", "trigger": "contentLiveVerified", "releasePct": 70},
        ],
        "constraints": {
            "requiredDisclosures": ["ad"],
            "prohibitedClaims": [],
            "exclusivityDays": 0,
        },
    }


def test_promotion_uses_camel_case_contract() -> None:
    promotion = Promotion.model_validate(promotion_payload())
    dumped = promotion.model_dump(by_alias=True)
    assert dumped["promotionId"] == "promotion-001"
    assert dumped["budget"]["maxPerCreatorUsdc"] == 800
    assert promotion.posting_window.start == date(2026, 8, 5)


def test_posting_window_rejects_inverted_dates() -> None:
    with pytest.raises(ValidationError):
        PostingWindow.model_validate({"start": "2026-08-10", "end": "2026-08-05"})


def test_agreement_milestones_must_sum_to_100() -> None:
    payload = terms_payload()
    payload["milestones"] = [{"id": "content", "trigger": "contentLiveVerified", "releasePct": 70}]
    with pytest.raises(ValidationError):
        AgreementTerms.model_validate(payload)
