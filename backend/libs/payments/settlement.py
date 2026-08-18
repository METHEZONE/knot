"""Deterministic escrow settlement math.

Pure functions that map an agreed term sheet to on-chain USDC amounts. No LLM,
no network, no fee invention: PRD 11 defines no protocol/platform fee for v1, so
``PLATFORM_FEE_BPS`` is 0 and the lock amount equals the payable fixed amount
(invariant 5). The on-chain Anchor program must be configured with the same
0-bps fee for its deposits to match these numbers.
"""

from libs.domain.models import AgreementTerms, Milestone

USDC_DECIMALS = 6
USDC_BASE_UNIT: int = 10**USDC_DECIMALS

# PRD 11: v1 does not define a protocol/platform fee. Do not invent one.
PLATFORM_FEE_BPS = 0

# 계약금 비율 기본값 (docs/17 N1). 협상으로 계약별 조정이 가능해질 예정이므로
# 여기 값은 "합의된 조건이 없을 때의 출발점" 이다.
DEFAULT_DEPOSIT_PCT = 20

# 마일스톤 식별자. 온체인 마일스톤 인덱스와 순서가 대응하므로 순서를 바꾸면 안 된다.
DEPOSIT_MILESTONE_ID = "deposit"
CONTENT_MILESTONE_ID = "content"

# 릴리즈 게이트가 트리거마다 다르다. 계약금은 검증할 콘텐츠가 없으므로 증빙을 요구하면
# 정상 완료 시에도 영구히 잠긴다.
DEPOSIT_MILESTONE_TRIGGER = "creatorAccepted"
CONTENT_MILESTONE_TRIGGER = "contentLiveVerified"


def lock_amount_base_units(terms: AgreementTerms) -> int:
    """USDC base units to escrow at lock time.

    v1 locks the flat/base compensation only; performance upside is settled out
    of band and is not escrowed up front (invariant 5).
    """
    return terms.compensation.base_amount_usdc * USDC_BASE_UNIT


def milestone_amounts_base_units(
    locked_amount: int,
    milestones: list[Milestone],
) -> dict[str, int]:
    """Split ``locked_amount`` across milestones by ``releasePct``.

    Each milestone gets ``floor(locked * pct / 100)``; the rounding remainder is
    assigned to the last milestone so the amounts sum to exactly ``locked_amount``
    (release can never exceed locked, invariant 6). ``releasePct`` values are
    guaranteed to sum to 100 by ``AgreementTerms`` validation.
    """
    if not milestones:
        return {}
    amounts: dict[str, int] = {}
    allocated = 0
    for milestone in milestones[:-1]:
        amount = locked_amount * milestone.release_pct // 100
        amounts[milestone.id] = amount
        allocated += amount
    last = milestones[-1]
    amounts[last.id] = locked_amount - allocated
    return amounts
