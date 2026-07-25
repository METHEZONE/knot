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
