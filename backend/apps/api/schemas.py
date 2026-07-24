from datetime import date, datetime

from pydantic import Field, field_validator

from libs.domain.models import (
    Deliverable,
    DomainModel,
    MoneyBudget,
    PostingWindow,
    Promotion,
    PromotionAutonomy,
    PromotionConstraints,
    UsageRights,
)


class PromotionCreateRequest(DomainModel):
    promotion_id: str | None = Field(default=None, alias="promotionId")
    brand_id: str = Field(default="brand-001", alias="brandId")
    brand_agent_id: str = Field(default="brand-agent-001", alias="brandAgentId")
    title: str
    objective: str
    category: str
    target_audience: list[str] = Field(default_factory=list, alias="targetAudience")
    budget: MoneyBudget
    deliverables: list[Deliverable]
    posting_window: PostingWindow = Field(alias="postingWindow")
    usage_rights: UsageRights = Field(alias="usageRights")
    constraints: PromotionConstraints = Field(default_factory=PromotionConstraints)
    autonomy: PromotionAutonomy = Field(default_factory=PromotionAutonomy)

    def to_promotion(self, promotion_id: str, now: datetime) -> Promotion:
        return Promotion(
            promotionId=promotion_id,
            brandId=self.brand_id,
            brandAgentId=self.brand_agent_id,
            title=self.title,
            objective=self.objective,
            category=self.category,
            targetAudience=self.target_audience,
            budget=self.budget,
            deliverables=self.deliverables,
            postingWindow=self.posting_window,
            usageRights=self.usage_rights,
            constraints=self.constraints,
            autonomy=self.autonomy,
            status="DRAFT",
            createdAt=now,
            updatedAt=now,
        )


class PromotionResponse(DomainModel):
    promotion: Promotion


class PromotionListResponse(DomainModel):
    promotions: list[Promotion]


class MatchRunResponse(DomainModel):
    match_run: dict[str, object] = Field(alias="matchRun")


class CandidateListResponse(DomainModel):
    candidates: list[dict[str, object]]


class TimelineResponse(DomainModel):
    events: list[dict[str, object]]


class ActivationResponse(DomainModel):
    promotion: Promotion


class ManualCandidateSelection(DomainModel):
    selected_at: str = Field(alias="selectedAt")


class EvidenceSubmissionRequest(DomainModel):
    url: str
    submitted_by_agent_id: str = Field(alias="submittedByAgentId")

    @field_validator("url")
    @classmethod
    def validate_http_url(cls, value: str) -> str:
        if not value.startswith(("https://", "http://")):
            raise ValueError("evidence URL must use http or https")
        return value


class EvidenceObservations(DomainModel):
    url_reachable: bool = Field(default=True, alias="urlReachable")
    brand_mentioned: bool = Field(default=True, alias="brandMentioned")
    disclosure_present: bool = Field(default=True, alias="disclosurePresent")
    prohibited_claims_found: list[str] = Field(default_factory=list, alias="prohibitedClaimsFound")


class EvidenceVerificationRequest(DomainModel):
    observations: EvidenceObservations | None = None


def default_promotion_request() -> PromotionCreateRequest:
    return PromotionCreateRequest(
        title="Summer skincare launch",
        objective="awareness",
        category="beauty",
        targetAudience=["20s", "skincare"],
        budget=MoneyBudget(totalUsdc=2000, maxPerCreatorUsdc=800),
        deliverables=[Deliverable(format="reel", count=1)],
        postingWindow=PostingWindow(start=date(2026, 8, 5), end=date(2026, 8, 10)),
        usageRights=UsageRights.PAID_BOOST_30D,
        constraints=PromotionConstraints(requiredCategories=["beauty"], requiredDisclosures=["ad"]),
        autonomy=PromotionAutonomy(maxNegotiationRounds=5, autoEscrow=True, autoRelease=True),
    )
