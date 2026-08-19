import json
from pathlib import Path

from libs.agents.brand import (
    build_a2a_offer_request,
    build_initial_terms,
    select_creator_for_negotiation,
)
from libs.domain.models import CreatorProfile, Promotion
from tests.test_domain_models import promotion_payload


def load_creators() -> list[CreatorProfile]:
    fixture_path = Path(__file__).resolve().parents[1] / "fixtures" / "creators.json"
    payload = json.loads(fixture_path.read_text(encoding="utf-8"))
    return [CreatorProfile.model_validate(item) for item in payload]


def test_brand_agent_selects_top_eligible_creator() -> None:
    selected = select_creator_for_negotiation(
        Promotion.model_validate(promotion_payload()),
        load_creators(),
    )

    assert selected is not None
    assert selected.creator_agent_id == "agent-creator-1"


def test_brand_agent_builds_initial_terms_from_promotion_contract() -> None:
    promotion = Promotion.model_validate(promotion_payload())
    creator = load_creators()[0]
    terms = build_initial_terms(promotion, creator, base_amount_usdc=500)

    assert terms.compensation.base_amount_usdc == 500
    assert terms.usage_rights == promotion.usage_rights
    assert terms.deliverables[0].post_window.start == promotion.posting_window.start
    assert sum(milestone.release_pct for milestone in terms.milestones) == 100


def test_brand_agent_builds_a2a_offer_request() -> None:
    promotion = Promotion.model_validate(promotion_payload())
    creator = load_creators()[0]
    terms = build_initial_terms(promotion, creator, base_amount_usdc=500)
    request = build_a2a_offer_request(
        tenant=creator.creator_agent_id,
        promotion=promotion,
        terms=terms,
        message_id="message-001",
        context_id="context-001",
    )

    dumped = request.model_dump(by_alias=True, mode="json")
    assert dumped["tenant"] == "creator-agent-001"
    assert dumped["message"]["role"] == "ROLE_USER"
    assert dumped["message"]["parts"][0]["data"]["type"] == "OFFER"
    assert dumped["message"]["parts"][0]["data"]["terms"]["compensation"]["baseAmountUsdc"] == 500
