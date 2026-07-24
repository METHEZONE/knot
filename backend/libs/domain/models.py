from datetime import date
from enum import StrEnum

from pydantic import BaseModel, Field


class UsageRights(StrEnum):
    ORGANIC_ONLY = "organicOnly"
    PAID_BOOST_30D = "paidBoost30d"
    FULL_LICENSE_90D = "fullLicense90d"


class MoneyBudget(BaseModel):
    total_usdc: int = Field(alias="totalUsdc", ge=0)
    max_per_creator_usdc: int = Field(alias="maxPerCreatorUsdc", ge=0)


class PostingWindow(BaseModel):
    start: date
    end: date


class Deliverable(BaseModel):
    format: str
    count: int = Field(ge=1)


class Promotion(BaseModel):
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
    status: str = "DRAFT"
