from datetime import date

from libs.domain.models import (
    AgreementTerms,
    Compensation,
    CompensationStructure,
    Milestone,
    PostingWindow,
    TermDeliverable,
    UsageRights,
)
from libs.payments.settlement import (
    PLATFORM_FEE_BPS,
    USDC_BASE_UNIT,
    lock_amount_base_units,
    milestone_amounts_base_units,
)


def _terms(base: int = 800, milestones: list[Milestone] | None = None) -> AgreementTerms:
    return AgreementTerms(
        compensation=Compensation(
            structure=CompensationStructure.FLAT,
            baseAmountUsdc=base,
            performancePct=0,
        ),
        deliverables=[
            TermDeliverable(
                format="reel",
                count=1,
                postWindow=PostingWindow(start=date(2026, 8, 5), end=date(2026, 8, 10)),
                revisionRounds=1,
            )
        ],
        usageRights=UsageRights.PAID_BOOST_30D,
        milestones=milestones
        or [
            Milestone(id="contract", trigger="contractSigned", releasePct=30),
            Milestone(id="content", trigger="contentLiveVerified", releasePct=70),
        ],
    )


def test_no_platform_fee_in_v1() -> None:
    assert PLATFORM_FEE_BPS == 0


def test_lock_amount_is_base_times_usdc_unit() -> None:
    assert lock_amount_base_units(_terms(800)) == 800 * USDC_BASE_UNIT


def test_milestone_amounts_sum_to_locked_with_remainder_on_last() -> None:
    locked = 1_000_001  # not divisible by the split → forces a rounding remainder
    amounts = milestone_amounts_base_units(locked, _terms().milestones)
    assert amounts["contract"] == locked * 30 // 100
    assert amounts["content"] == locked - amounts["contract"]
    assert sum(amounts.values()) == locked


def test_milestone_amounts_empty_when_no_milestones() -> None:
    assert milestone_amounts_base_units(100, []) == {}
