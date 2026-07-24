from enum import StrEnum

from pydantic import BaseModel, Field


class PolicyAction(StrEnum):
    ALLOW = "ALLOW"
    BLOCK = "BLOCK"
    ESCALATE = "ESCALATE"


class Violation(BaseModel):
    code: str
    field: str
    rule: str


class PolicyDecision(BaseModel):
    allowed: bool
    action: PolicyAction
    violations: list[Violation] = Field(default_factory=list)
    rule_version: str = Field(alias="ruleVersion")


def allow(rule_version: str) -> PolicyDecision:
    return PolicyDecision(allowed=True, action=PolicyAction.ALLOW, ruleVersion=rule_version)
