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
    CONTENT_MILESTONE_ID,
    DEFAULT_DEPOSIT_PCT,
    DEPOSIT_MILESTONE_ID,
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

def test_default_terms_split_deposit_and_final_without_losing_a_base_unit() -> None:
    """계약금 20% + 잔금 80% 로 쪼개도 합이 락 금액과 정확히 같아야 한다.

    합이 어긋나면 release 가 locked 를 넘거나(이중 지급) 잔액이 영구히 남는다.
    """
    milestones = [
        Milestone(
            id=DEPOSIT_MILESTONE_ID,
            trigger="creatorAccepted",
            releasePct=DEFAULT_DEPOSIT_PCT,
        ),
        Milestone(
            id=CONTENT_MILESTONE_ID,
            trigger="contentLiveVerified",
            releasePct=100 - DEFAULT_DEPOSIT_PCT,
        ),
    ]
    # 100 으로 나누어떨어지지 않는 금액을 일부러 넣어 반올림 손실을 노린다.
    for locked in (1, 3, 7, 333, 650_000_001, 999_999_999):
        amounts = milestone_amounts_base_units(locked, milestones)
        assert sum(amounts.values()) == locked, locked
        assert set(amounts) == {DEPOSIT_MILESTONE_ID, CONTENT_MILESTONE_ID}
        assert amounts[DEPOSIT_MILESTONE_ID] == locked * DEFAULT_DEPOSIT_PCT // 100


def test_deposit_is_twenty_percent_of_a_round_amount() -> None:
    milestones = [
        Milestone(
            id=DEPOSIT_MILESTONE_ID,
            trigger="creatorAccepted",
            releasePct=DEFAULT_DEPOSIT_PCT,
        ),
        Milestone(
            id=CONTENT_MILESTONE_ID,
            trigger="contentLiveVerified",
            releasePct=100 - DEFAULT_DEPOSIT_PCT,
        ),
    ]
    amounts = milestone_amounts_base_units(650 * USDC_BASE_UNIT, milestones)
    assert amounts[DEPOSIT_MILESTONE_ID] == 130 * USDC_BASE_UNIT
    assert amounts[CONTENT_MILESTONE_ID] == 520 * USDC_BASE_UNIT
