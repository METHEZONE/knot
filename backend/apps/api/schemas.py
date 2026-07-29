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


class UserBootstrapRequest(DomainModel):
    email: str
    display_name: str = Field(alias="displayName")
    role: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        if "@" not in value:
            raise ValueError("email must contain @")
        return value.strip().lower()

    @field_validator("role")
    @classmethod
    def validate_role(cls, value: str) -> str:
        if value not in {"brand", "creator"}:
            raise ValueError("role must be brand or creator")
        return value


class CurrentUserRoleRequest(DomainModel):
    role: str

    @field_validator("role")
    @classmethod
    def validate_role(cls, value: str) -> str:
        normalized = value.strip().upper()
        if normalized not in {"BRAND", "CREATOR"}:
            raise ValueError("role must be BRAND or CREATOR")
        return normalized


class CurrentUserWalletRequest(DomainModel):
    wallet_address: str = Field(alias="walletAddress")


class CurrentUserBrandProfileRequest(DomainModel):
    brand_name: str = Field(alias="brandName")
    website_url: str = Field(alias="websiteUrl")
    categories: list[str] = Field(default_factory=list)
    custom_category: str | None = Field(default=None, alias="customCategory")
    target_audience: str = Field(alias="targetAudience")
    restricted_claims: list[str] = Field(default_factory=list, alias="restrictedClaims")
    description: str = ""

    @field_validator("website_url")
    @classmethod
    def validate_website_url(cls, value: str) -> str:
        if not value.startswith(("https://", "http://")):
            raise ValueError("websiteUrl must use http or https")
        return value

    @field_validator("categories")
    @classmethod
    def validate_categories(cls, value: list[str]) -> list[str]:
        categories = [item.strip() for item in value if item.strip()]
        if not categories:
            raise ValueError("at least one category is required")
        return categories


class CurrentUserCreatorProfileRequest(DomainModel):
    creator_name: str = Field(alias="creatorName")
    sns_url: str = Field(alias="snsUrl")
    categories: list[str] = Field(default_factory=list)
    custom_category: str | None = Field(default=None, alias="customCategory")
    minimum_usdc: int = Field(default=300, alias="minimumUsdc", ge=1)
    blocked_domains: list[str] = Field(default_factory=list, alias="blockedDomains")
    preferred_content: list[str] = Field(default_factory=list, alias="preferredContent")
    wallet_address: str | None = Field(default=None, alias="walletAddress")

    @field_validator("sns_url")
    @classmethod
    def validate_sns_url(cls, value: str) -> str:
        if not value.startswith(("https://", "http://")):
            raise ValueError("snsUrl must use http or https")
        return value

    @field_validator("categories")
    @classmethod
    def validate_categories(cls, value: list[str]) -> list[str]:
        categories = [item.strip() for item in value if item.strip()]
        if not categories:
            raise ValueError("at least one category is required")
        return categories


class BrandSourceAnalysisRequest(DomainModel):
    website_url: str | None = Field(default=None, alias="websiteUrl")
    product_url: str | None = Field(default=None, alias="productUrl")
    pdf_file_ref: str | None = Field(default=None, alias="pdfFileRef")

    @field_validator("website_url", "product_url")
    @classmethod
    def validate_source_url(cls, value: str | None) -> str | None:
        if value is None or not value.strip():
            return None
        cleaned = value.strip()
        if not cleaned.startswith(("https://", "http://")):
            raise ValueError("source URL must use http or https")
        return cleaned


class BrandOnboardingRequest(DomainModel):
    user_id: str | None = Field(default=None, alias="userId")
    brand_name: str = Field(alias="brandName")
    website_url: str = Field(alias="websiteUrl")
    category: str
    target_audience: list[str] = Field(default_factory=list, alias="targetAudience")
    restricted_claims: list[str] = Field(default_factory=list, alias="restrictedClaims")

    @field_validator("website_url")
    @classmethod
    def validate_website_url(cls, value: str) -> str:
        if not value.startswith(("https://", "http://")):
            raise ValueError("websiteUrl must use http or https")
        return value


class CreatorOnboardingRequest(DomainModel):
    user_id: str | None = Field(default=None, alias="userId")
    creator_name: str = Field(alias="creatorName")
    sns_url: str = Field(alias="snsUrl")
    primary_category: str = Field(default="lifestyle", alias="primaryCategory")

    @field_validator("sns_url")
    @classmethod
    def validate_sns_url(cls, value: str) -> str:
        if not value.startswith(("https://", "http://")):
            raise ValueError("snsUrl must use http or https")
        return value


class CreatorCriteriaRequest(DomainModel):
    minimum_usdc: int = Field(alias="minimumUsdc", ge=1)
    blocked_domains: list[str] = Field(default_factory=list, alias="blockedDomains")
    preferred_content: list[str] = Field(default_factory=list, alias="preferredContent")
    usage_rights: UsageRights = Field(default=UsageRights.PAID_BOOST_30D, alias="usageRights")
    notes: str = ""


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


class BrandPromotionCreateRequest(DomainModel):
    promotion_id: str | None = Field(default=None, alias="promotionId")
    product_name: str = Field(alias="productName")
    title: str
    objective: str
    categories: list[str] = Field(default_factory=list)
    target_audience: str = Field(alias="targetAudience")
    total_budget: int = Field(alias="totalBudget", ge=1)
    initial_offer: int = Field(alias="initialOffer", ge=1)
    maximum_per_creator: int = Field(alias="maximumPerCreator", ge=1)
    auto_accept_ceiling: int = Field(alias="autoAcceptCeiling", ge=1)
    maximum_rounds: int = Field(default=3, alias="maximumRounds", ge=1, le=5)
    deliverables: list[Deliverable]
    usage_rights: UsageRights = Field(alias="usageRights")
    deadline: date
    prohibited_claims: list[str] = Field(default_factory=list, alias="prohibitedClaims")
    # 에이전트 자율 정산 위임 — auto_accept_ceiling(cap) 이내에서 사람 승인 없이 락/릴리즈.
    # cap 하이브리드(docs/WALLET_AND_MONEY_FLOW.md §9): 이내는 자동, 초과는 정책이 막고 사람 승인.
    # 기본 True: 이전엔 하드코딩 False 라서 앱에서 만든 프로모션은 ESCROW_LOCK 이 영구 차단됐다
    # (POLICY_VIOLATION). 승인 0회가 제품 전제이므로 기본을 위임으로 두고, 상한은 cap 이 지킨다.
    auto_escrow: bool = Field(default=True, alias="autoEscrow")
    auto_release: bool = Field(default=True, alias="autoRelease")

    @field_validator("categories")
    @classmethod
    def validate_categories(cls, value: list[str]) -> list[str]:
        categories = [item.strip() for item in value if item.strip()]
        if not categories:
            raise ValueError("at least one category is required")
        return categories

    def to_promotion(
        self,
        promotion_id: str,
        brand_id: str,
        brand_agent_id: str,
        now: datetime,
    ) -> Promotion:
        return Promotion(
            promotionId=promotion_id,
            brandId=brand_id,
            brandAgentId=brand_agent_id,
            title=self.title,
            objective=self.objective,
            category=self.categories[0],
            targetAudience=[self.target_audience],
            budget=MoneyBudget(
                totalUsdc=self.total_budget,
                maxPerCreatorUsdc=self.maximum_per_creator,
            ),
            deliverables=self.deliverables,
            postingWindow=PostingWindow(start=self.deadline, end=self.deadline),
            usageRights=self.usage_rights,
            constraints=PromotionConstraints(
                requiredCategories=self.categories,
                prohibitedClaims=self.prohibited_claims,
            ),
            autonomy=PromotionAutonomy(
                maxNegotiationRounds=self.maximum_rounds,
                autoEscrow=self.auto_escrow,
                autoRelease=self.auto_release,
            ),
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
    milestone_id: str = Field(default="content", alias="milestoneId")

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
