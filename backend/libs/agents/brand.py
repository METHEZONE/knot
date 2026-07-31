from datetime import date

from libs.a2a.models import A2AMessage, A2APart, A2ARole, A2ASendConfiguration, A2ASendRequest
from libs.agents.matching import rank_creators
from libs.domain.models import (
    AgreementTerms,
    Compensation,
    CompensationStructure,
    CreatorProfile,
    Milestone,
    PostingWindow,
    Promotion,
    TermConstraints,
    TermDeliverable,
)


def select_creator_for_negotiation(
    promotion: Promotion, creators: list[CreatorProfile]
) -> CreatorProfile | None:
    ranked = rank_creators(promotion, creators)
    selected = next((result for result in ranked if result.eligible), None)
    if selected is None:
        return None
    return next(
        creator for creator in creators if creator.creator_agent_id == selected.creator_agent_id
    )


def build_initial_terms(
    promotion: Promotion,
    creator: CreatorProfile,
    *,
    base_amount_usdc: int | None = None,
) -> AgreementTerms:
    amount = base_amount_usdc
    if amount is None:
        amount = min(creator.rate_card.min_base_usdc, promotion.budget.max_per_creator_usdc)

    return AgreementTerms(
        compensation=Compensation(
            structure=CompensationStructure.FLAT,
            baseAmountUsdc=amount,
            performancePct=0,
        ),
        deliverables=[
            TermDeliverable(
                format=deliverable.format,
                count=deliverable.count,
                postWindow=PostingWindow(
                    start=promotion.posting_window.start,
                    end=promotion.posting_window.end,
                ),
                revisionRounds=1,
            )
            for deliverable in promotion.deliverables
        ],
        usageRights=promotion.usage_rights,
        milestones=[
            Milestone(id="content", trigger="contentLiveVerified", releasePct=100),
        ],
        constraints=TermConstraints(
            requiredDisclosures=promotion.constraints.required_disclosures,
            prohibitedClaims=promotion.constraints.prohibited_claims,
            exclusivityDays=0,
        ),
    )


def build_a2a_offer_request(
    *,
    tenant: str,
    promotion: Promotion,
    terms: AgreementTerms,
    message_id: str,
    context_id: str,
    round_: int = 1,
    rationale: str = "Initial promotion offer",
) -> A2ASendRequest:
    return A2ASendRequest(
        tenant=tenant,
        message=A2AMessage(
            messageId=message_id,
            contextId=context_id,
            role=A2ARole.USER,
            parts=[
                A2APart(
                    mediaType="application/json",
                    data={
                        "schema": "knot.negotiation.v1",
                        "type": "OFFER",
                        "round": round_,
                        "promotion": promotion.model_dump(by_alias=True, mode="json"),
                        "terms": terms.model_dump(by_alias=True, mode="json"),
                        "changedFields": [],
                        "rationale": rationale,
                    },
                )
            ],
        ),
        configuration=A2ASendConfiguration(acceptedOutputModes=["application/json"]),
    )


def planned_posting_date(promotion: Promotion) -> date:
    return promotion.posting_window.start
