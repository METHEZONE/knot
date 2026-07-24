from datetime import date

from libs.domain.models import AgreementTerms, CreatorPolicy, CreatorProfile, Promotion
from libs.policies.brand import validate_brand_terms
from libs.policies.creator import validate_creator_terms
from tests.test_domain_models import promotion_payload, terms_payload


def creator_payload() -> dict[str, object]:
    return {
        "creatorId": "creator-001",
        "creatorAgentId": "creator-agent-001",
        "displayName": "Demo Beauty Creator",
        "categories": ["beauty", "skincare"],
        "prohibitedIndustries": [],
        "supportedDeliverableFormats": ["reel", "story"],
        "allowedUsageRights": ["organicOnly", "paidBoost30d"],
        "minDaysToPost": 5,
        "availableFrom": "2026-08-01",
        "monthlyCapacity": 4,
        "activeDeliverablesThisMonth": 1,
        "completedDealCount": 12,
        "rateCard": {"minBaseUsdc": 650, "maxBaseUsdc": 900},
        "active": True,
    }


def creator_policy_payload() -> dict[str, object]:
    return {
        "minBaseUsdc": 650,
        "blockedIndustries": ["gambling", "cryptoTrading"],
        "maxDeliverablesPerMonth": 4,
        "minDaysToPost": 5,
        "allowedUsageRights": ["organicOnly", "paidBoost30d"],
        "maxRevisionRounds": 1,
        "maxExclusivityDays": 0,
    }


def test_brand_policy_allows_valid_terms() -> None:
    decision = validate_brand_terms(
        Promotion.model_validate(promotion_payload()),
        CreatorProfile.model_validate(creator_payload()),
        AgreementTerms.model_validate(terms_payload()),
        current_round=1,
    )
    assert decision.allowed is True
    assert decision.rule_version == "brand-policy-v1"


def test_brand_policy_blocks_over_budget_offer() -> None:
    decision = validate_brand_terms(
        Promotion.model_validate(promotion_payload()),
        CreatorProfile.model_validate(creator_payload()),
        AgreementTerms.model_validate(terms_payload(base_amount_usdc=900)),
        current_round=1,
    )
    assert decision.allowed is False
    assert {violation.code for violation in decision.violations} == {
        "POLICY_MAX_PER_CREATOR_EXCEEDED"
    }


def test_brand_policy_blocks_round_six() -> None:
    decision = validate_brand_terms(
        Promotion.model_validate(promotion_payload()),
        CreatorProfile.model_validate(creator_payload()),
        AgreementTerms.model_validate(terms_payload()),
        current_round=6,
    )
    assert decision.allowed is False
    assert decision.violations[0].code == "POLICY_NEGOTIATION_ROUND_EXCEEDED"


def test_creator_policy_blocks_low_offer() -> None:
    decision = validate_creator_terms(
        Promotion.model_validate(promotion_payload()),
        CreatorPolicy.model_validate(creator_policy_payload()),
        AgreementTerms.model_validate(terms_payload(base_amount_usdc=500)),
        today=date(2026, 7, 30),
    )
    assert decision.allowed is False
    assert decision.violations[0].code == "CREATOR_MIN_BASE_NOT_MET"


def test_creator_policy_blocks_unsupported_rights() -> None:
    payload = terms_payload()
    payload["usageRights"] = "fullLicense90d"
    decision = validate_creator_terms(
        Promotion.model_validate(promotion_payload()),
        CreatorPolicy.model_validate(creator_policy_payload()),
        AgreementTerms.model_validate(payload),
        today=date(2026, 7, 30),
    )
    assert decision.allowed is False
    assert decision.violations[0].code == "CREATOR_USAGE_RIGHTS_NOT_ALLOWED"
