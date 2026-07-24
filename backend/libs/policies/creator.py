from datetime import date

from libs.domain.models import AgreementTerms, CreatorPolicy, Promotion
from libs.policies.decision import PolicyDecision, Violation, allow, block

CREATOR_POLICY_VERSION = "creator-policy-v1"


def validate_creator_terms(
    promotion: Promotion,
    policy: CreatorPolicy,
    terms: AgreementTerms,
    *,
    today: date,
    current_month_deliverables: int = 0,
) -> PolicyDecision:
    violations: list[Violation] = []

    if promotion.category in policy.blocked_industries:
        violations.append(
            Violation(
                code="CREATOR_BLOCKED_INDUSTRY",
                field="promotion.category",
                rule="blockedIndustries",
            )
        )

    if terms.compensation.base_amount_usdc < policy.min_base_usdc:
        violations.append(
            Violation(
                code="CREATOR_MIN_BASE_NOT_MET",
                field="terms.compensation.baseAmountUsdc",
                rule="minBaseUsdc",
            )
        )

    if terms.usage_rights not in policy.allowed_usage_rights:
        violations.append(
            Violation(
                code="CREATOR_USAGE_RIGHTS_NOT_ALLOWED",
                field="terms.usageRights",
                rule="allowedUsageRights",
            )
        )

    deliverable_count = sum(deliverable.count for deliverable in terms.deliverables)
    if current_month_deliverables + deliverable_count > policy.max_deliverables_per_month:
        violations.append(
            Violation(
                code="CREATOR_CAPACITY_EXCEEDED",
                field="terms.deliverables",
                rule="maxDeliverablesPerMonth",
            )
        )

    for deliverable in terms.deliverables:
        lead_time_days = (deliverable.post_window.start - today).days
        if lead_time_days < policy.min_days_to_post:
            violations.append(
                Violation(
                    code="CREATOR_LEAD_TIME_TOO_SHORT",
                    field="terms.deliverables.postWindow.start",
                    rule="minDaysToPost",
                )
            )
        if deliverable.revision_rounds > policy.max_revision_rounds:
            violations.append(
                Violation(
                    code="CREATOR_REVISION_LIMIT_EXCEEDED",
                    field="terms.deliverables.revisionRounds",
                    rule="maxRevisionRounds",
                )
            )

    if terms.constraints.exclusivity_days > policy.max_exclusivity_days:
        violations.append(
            Violation(
                code="CREATOR_EXCLUSIVITY_LIMIT_EXCEEDED",
                field="terms.constraints.exclusivityDays",
                rule="maxExclusivityDays",
            )
        )

    if violations:
        return block(CREATOR_POLICY_VERSION, violations)
    return allow(CREATOR_POLICY_VERSION)
