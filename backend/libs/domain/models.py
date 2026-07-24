from datetime import date
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class DomainModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True)


class UsageRights(StrEnum):
    ORGANIC_ONLY = "organicOnly"
    PAID_BOOST_30D = "paidBoost30d"
    FULL_LICENSE_90D = "fullLicense90d"


class CompensationStructure(StrEnum):
    FLAT = "flat"
    BASE_PLUS_PERFORMANCE = "basePlusPerformance"


class MoneyBudget(DomainModel):
    total_usdc: int = Field(alias="totalUsdc", ge=0)
    max_per_creator_usdc: int = Field(alias="maxPerCreatorUsdc", ge=0)


class PostingWindow(DomainModel):
    start: date
    end: date

    @model_validator(mode="after")
    def validate_order(self) -> "PostingWindow":
        if self.end < self.start:
            raise ValueError("posting window end must be on or after start")
        return self


class Deliverable(DomainModel):
    format: str
    count: int = Field(ge=1)


class PromotionConstraints(DomainModel):
    required_disclosures: list[str] = Field(default_factory=list, alias="requiredDisclosures")
    prohibited_claims: list[str] = Field(default_factory=list, alias="prohibitedClaims")
    required_categories: list[str] = Field(default_factory=list, alias="requiredCategories")
    prohibited_categories: list[str] = Field(default_factory=list, alias="prohibitedCategories")
    max_performance_pct: int = Field(default=0, alias="maxPerformancePct", ge=0, le=100)


class PromotionAutonomy(DomainModel):
    max_negotiation_rounds: int = Field(default=5, alias="maxNegotiationRounds", ge=1, le=5)
    auto_escrow: bool = Field(default=True, alias="autoEscrow")
    auto_release: bool = Field(default=True, alias="autoRelease")


class Promotion(DomainModel):
    promotion_id: str = Field(alias="promotionId")
    brand_id: str = Field(alias="brandId")
    brand_agent_id: str = Field(alias="brandAgentId")
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
    status: str = "DRAFT"

    @field_validator("deliverables")
    @classmethod
    def require_deliverables(cls, value: list[Deliverable]) -> list[Deliverable]:
        if not value:
            raise ValueError("promotion must request at least one deliverable")
        return value


class RateCard(DomainModel):
    min_base_usdc: int = Field(alias="minBaseUsdc", ge=0)
    max_base_usdc: int = Field(alias="maxBaseUsdc", ge=0)

    @model_validator(mode="after")
    def validate_range(self) -> "RateCard":
        if self.max_base_usdc < self.min_base_usdc:
            raise ValueError("maxBaseUsdc must be greater than or equal to minBaseUsdc")
        return self


class CreatorProfile(DomainModel):
    creator_id: str = Field(alias="creatorId")
    creator_agent_id: str = Field(alias="creatorAgentId")
    display_name: str = Field(alias="displayName")
    categories: list[str]
    prohibited_industries: list[str] = Field(default_factory=list, alias="prohibitedIndustries")
    supported_deliverable_formats: list[str] = Field(alias="supportedDeliverableFormats")
    allowed_usage_rights: list[UsageRights] = Field(alias="allowedUsageRights")
    min_days_to_post: int = Field(alias="minDaysToPost", ge=0)
    available_from: date = Field(alias="availableFrom")
    monthly_capacity: int = Field(alias="monthlyCapacity", ge=0)
    active_deliverables_this_month: int = Field(
        default=0, alias="activeDeliverablesThisMonth", ge=0
    )
    completed_deal_count: int = Field(default=0, alias="completedDealCount", ge=0)
    rate_card: RateCard = Field(alias="rateCard")
    active: bool = True

    @property
    def remaining_capacity(self) -> int:
        return max(self.monthly_capacity - self.active_deliverables_this_month, 0)


class CreatorPolicy(DomainModel):
    min_base_usdc: int = Field(alias="minBaseUsdc", ge=0)
    blocked_industries: list[str] = Field(default_factory=list, alias="blockedIndustries")
    max_deliverables_per_month: int = Field(alias="maxDeliverablesPerMonth", ge=0)
    min_days_to_post: int = Field(alias="minDaysToPost", ge=0)
    allowed_usage_rights: list[UsageRights] = Field(alias="allowedUsageRights")
    max_revision_rounds: int = Field(default=1, alias="maxRevisionRounds", ge=0)
    max_exclusivity_days: int = Field(default=0, alias="maxExclusivityDays", ge=0)


class AgentPolicy(DomainModel):
    agent_id: str = Field(alias="agentId")
    policy_version: int = Field(alias="policyVersion", ge=1)
    agent_type: str = Field(alias="agentType")
    creator: CreatorPolicy
    active: bool = True


class Compensation(DomainModel):
    structure: CompensationStructure
    base_amount_usdc: int = Field(alias="baseAmountUsdc", ge=0)
    performance_pct: int = Field(default=0, alias="performancePct", ge=0, le=100)


class TermDeliverable(DomainModel):
    format: str
    count: int = Field(ge=1)
    post_window: PostingWindow = Field(alias="postWindow")
    revision_rounds: int = Field(default=1, alias="revisionRounds", ge=0)


class TermConstraints(DomainModel):
    required_disclosures: list[str] = Field(default_factory=list, alias="requiredDisclosures")
    prohibited_claims: list[str] = Field(default_factory=list, alias="prohibitedClaims")
    exclusivity_days: int = Field(default=0, alias="exclusivityDays", ge=0)


class Milestone(DomainModel):
    id: str
    trigger: str
    release_pct: int = Field(alias="releasePct", ge=0, le=100)


class AgreementTerms(DomainModel):
    compensation: Compensation
    deliverables: list[TermDeliverable]
    usage_rights: UsageRights = Field(alias="usageRights")
    milestones: list[Milestone]
    constraints: TermConstraints = Field(default_factory=TermConstraints)

    @field_validator("deliverables")
    @classmethod
    def require_term_deliverables(cls, value: list[TermDeliverable]) -> list[TermDeliverable]:
        if not value:
            raise ValueError("agreement terms must include at least one deliverable")
        return value

    @model_validator(mode="after")
    def validate_milestones(self) -> "AgreementTerms":
        if sum(milestone.release_pct for milestone in self.milestones) != 100:
            raise ValueError("agreement milestone percentages must sum to 100")
        return self
