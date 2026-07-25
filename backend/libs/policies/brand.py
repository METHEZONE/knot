from libs.domain.models import AgreementTerms, CreatorProfile, Promotion
from libs.policies.decision import PolicyDecision, Violation, allow, block

BRAND_POLICY_VERSION = "brand-policy-v1"


def validate_brand_terms(
    promotion: Promotion,
    creator: CreatorProfile,
    terms: AgreementTerms,
    *,
    current_round: int,
    cumulative_committed_usdc: int = 0,
    action: str | None = None,
) -> PolicyDecision:
    violations: list[Violation] = []
    base_amount = terms.compensation.base_amount_usdc

    required_categories = set(promotion.constraints.required_categories or [promotion.category])
    if not required_categories.intersection(creator.categories):
        violations.append(
            Violation(
                code="BRAND_REQUIRED_CATEGORY_MISSING",
                field="creator.categories",
                rule="requiredCategories",
            )
        )

    if promotion.category in creator.prohibited_industries:
        violations.append(
            Violation(
                code="BRAND_CREATOR_PROHIBITED_INDUSTRY",
                field="promotion.category",
                rule="creatorProhibitedIndustries",
            )
        )

    if base_amount > promotion.budget.max_per_creator_usdc:
        violations.append(
            Violation(
                code="POLICY_MAX_PER_CREATOR_EXCEEDED",
                field="terms.compensation.baseAmountUsdc",
                rule="maxPerCreatorUsdc",
            )
        )

    if base_amount > promotion.budget.total_usdc:
        violations.append(
            Violation(
                code="POLICY_TOTAL_BUDGET_EXCEEDED",
                field="terms.compensation.baseAmountUsdc",
                rule="budget.totalUsdc",
            )
        )

    if cumulative_committed_usdc + base_amount > promotion.budget.total_usdc:
        violations.append(
            Violation(
                code="POLICY_CUMULATIVE_BUDGET_EXCEEDED",
                field="terms.compensation.baseAmountUsdc",
                rule="cumulativeCommittedBudget",
            )
        )

    if terms.compensation.performance_pct > promotion.constraints.max_performance_pct:
        violations.append(
            Violation(
                code="POLICY_PERFORMANCE_PCT_EXCEEDED",
                field="terms.compensation.performancePct",
                rule="maxPerformancePct",
            )
        )

    if terms.usage_rights != promotion.usage_rights:
        violations.append(
            Violation(
                code="POLICY_USAGE_RIGHTS_MISMATCH",
                field="terms.usageRights",
                rule="promotion.usageRights",
            )
        )

    requested_formats = {deliverable.format for deliverable in promotion.deliverables}
    term_formats = {deliverable.format for deliverable in terms.deliverables}
    if not term_formats.issubset(requested_formats):
        violations.append(
            Violation(
                code="POLICY_DELIVERABLE_FORMAT_UNREQUESTED",
                field="terms.deliverables",
                rule="promotion.deliverables",
            )
        )

    for deliverable in terms.deliverables:
        if (
            deliverable.post_window.start < promotion.posting_window.start
            or deliverable.post_window.end > promotion.posting_window.end
        ):
            violations.append(
                Violation(
                    code="POLICY_POSTING_WINDOW_OUT_OF_RANGE",
                    field="terms.deliverables.postWindow",
                    rule="promotion.postingWindow",
                )
            )

    if current_round > promotion.autonomy.max_negotiation_rounds:
        violations.append(
            Violation(
                code="POLICY_NEGOTIATION_ROUND_EXCEEDED",
                field="negotiation.currentRound",
                rule="maxNegotiationRounds",
            )
        )

    if action == "ESCROW_LOCK" and not promotion.autonomy.auto_escrow:
        violations.append(
            Violation(
                code="POLICY_AUTO_ESCROW_DISABLED",
                field="autonomy.autoEscrow",
                rule="autoEscrow",
            )
        )

    if action == "MILESTONE_RELEASE" and not promotion.autonomy.auto_release:
        violations.append(
            Violation(
                code="POLICY_AUTO_RELEASE_DISABLED",
                field="autonomy.autoRelease",
                rule="autoRelease",
            )
        )

    if violations:
        return block(BRAND_POLICY_VERSION, violations)
    return allow(BRAND_POLICY_VERSION)
