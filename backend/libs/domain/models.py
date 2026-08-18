from datetime import date, datetime
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


class AgentPublicationStatus(StrEnum):
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"
    PAUSED = "PAUSED"
    SUSPENDED = "SUSPENDED"


class AgentAvailability(StrEnum):
    AVAILABLE = "AVAILABLE"
    RESERVED = "RESERVED"
    NEGOTIATING = "NEGOTIATING"
    AT_CAPACITY = "AT_CAPACITY"
    UNAVAILABLE = "UNAVAILABLE"


class MatchRunStatus(StrEnum):
    READY = "READY"
    QUEUED = "QUEUED"
    DISCOVERING = "DISCOVERING"
    RANKING = "RANKING"
    VERIFYING = "VERIFYING"
    SELECTING = "SELECTING"
    NEGOTIATING = "NEGOTIATING"
    AGREED = "AGREED"
    ESCROW_PREPARING = "ESCROW_PREPARING"
    ESCROW_SUBMITTED = "ESCROW_SUBMITTED"
    ESCROW_CONFIRMED = "ESCROW_CONFIRMED"
    COMPLETED = "COMPLETED"
    EXHAUSTED = "EXHAUSTED"
    CANCELED = "CANCELED"
    FAILED = "FAILED"


class MatchCandidateStatus(StrEnum):
    RETRIEVED = "RETRIEVED"
    ELIGIBLE = "ELIGIBLE"
    RANKED = "RANKED"
    VERIFICATION_PENDING = "VERIFICATION_PENDING"
    VERIFIED = "VERIFIED"
    RESERVATION_PENDING = "RESERVATION_PENDING"
    RESERVED = "RESERVED"
    NEGOTIATING = "NEGOTIATING"
    AGREED = "AGREED"
    REJECTED = "REJECTED"
    EXPIRED = "EXPIRED"
    SKIPPED = "SKIPPED"
    FAILED = "FAILED"


class NegotiationStatus(StrEnum):
    CREATED = "CREATED"
    OFFERED = "OFFERED"
    COUNTERED = "COUNTERED"
    AGREED = "AGREED"
    REJECTED = "REJECTED"
    EXPIRED = "EXPIRED"
    CANCELED = "CANCELED"
    FAILED = "FAILED"


class EvidenceStatus(StrEnum):
    REQUIRED = "REQUIRED"
    SUBMITTED = "SUBMITTED"
    VERIFYING = "VERIFYING"
    VERIFIED = "VERIFIED"
    REVISION_REQUIRED = "REVISION_REQUIRED"
    MANUAL_REVIEW = "MANUAL_REVIEW"
    REJECTED = "REJECTED"


class EscrowSettlementStatus(StrEnum):
    NOT_STARTED = "NOT_STARTED"
    PREPARING = "PREPARING"
    SUBMITTED = "SUBMITTED"
    CONFIRMED = "CONFIRMED"
    RELEASE_SUBMITTED = "RELEASE_SUBMITTED"
    RELEASED = "RELEASED"
    FAILED = "FAILED"
    CANCELED = "CANCELED"


CANONICAL_USAGE_RIGHTS_BY_LEGACY: dict[UsageRights, str] = {
    UsageRights.ORGANIC_ONLY: "ORGANIC_ONLY",
    UsageRights.PAID_BOOST_30D: "PAID_BOOST_30D",
    UsageRights.FULL_LICENSE_90D: "FULL_LICENSE_90D",
}
LEGACY_USAGE_RIGHTS_BY_CANONICAL: dict[str, UsageRights] = {
    canonical: legacy for legacy, canonical in CANONICAL_USAGE_RIGHTS_BY_LEGACY.items()
}


def canonical_usage_rights_code(value: UsageRights | str) -> str:
    usage_rights = value if isinstance(value, UsageRights) else UsageRights(value)
    return CANONICAL_USAGE_RIGHTS_BY_LEGACY[usage_rights]


def usage_rights_from_canonical(value: str) -> UsageRights:
    normalized = value.strip()
    if normalized in LEGACY_USAGE_RIGHTS_BY_CANONICAL:
        return LEGACY_USAGE_RIGHTS_BY_CANONICAL[normalized]
    return UsageRights(normalized)


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
    created_at: datetime | None = Field(default=None, alias="createdAt")
    updated_at: datetime | None = Field(default=None, alias="updatedAt")

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
    created_at: datetime | None = Field(default=None, alias="createdAt")


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


class AgreementResult(StrEnum):
    AGREED = "AGREED"
    REJECTED = "REJECTED"


class DisputeStatus(StrEnum):
    OPEN = "OPEN"
    UNDER_REVIEW = "UNDER_REVIEW"
    RESOLVED_CREATOR = "RESOLVED_CREATOR"
    RESOLVED_BRAND = "RESOLVED_BRAND"
    RESOLVED_PARTIAL = "RESOLVED_PARTIAL"
    REJECTED = "REJECTED"


class DisputeReason(StrEnum):
    CONTENT_QUALITY = "CONTENT_QUALITY"
    BRAND_MISMATCH = "BRAND_MISMATCH"
    MISSING_DISCLOSURE = "MISSING_DISCLOSURE"
    LATE_DELIVERY = "LATE_DELIVERY"
    PROHIBITED_CLAIMS = "PROHIBITED_CLAIMS"
    OTHER = "OTHER"


class Dispute(DomainModel):
    dispute_id: str = Field(alias="disputeId")
    agreement_id: str = Field(alias="agreementId")
    milestone_id: str = Field(alias="milestoneId")
    raised_by: str = Field(alias="raisedBy")  # "brand" or "creator"
    reason: DisputeReason
    description: str
    evidence_url: str | None = Field(default=None, alias="evidenceUrl")
    status: DisputeStatus
    amount_usdc: float = Field(alias="amountUsdc")
    resolution: str | None = None
    resolved_at: datetime | None = Field(default=None, alias="resolvedAt")
    auto_resolved: bool = Field(default=False, alias="autoResolved")
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")
