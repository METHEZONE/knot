"""
KNOT Payments Module

pay.sh/x402 integration for Agent operational costs:
- Creator authenticity verification (Nansen/HypeAuditor API)
- Content quality verification (Brandwatch API)

NOT used for creator compensation (that uses Solana escrow).
"""

from .paysh import (
    PayCliNotFound,
    PayShError,
    PayResult,
    PaymentReceipt,
    fetch,
    verify_creator,
    verify_content,
)
from .settlement import (
    PLATFORM_FEE_BPS,
    USDC_BASE_UNIT,
    USDC_DECIMALS,
    lock_amount_base_units,
    milestone_amounts_base_units,
)

__all__ = [
    # pay.sh verification
    "PayCliNotFound",
    "PayShError",
    "PayResult",
    "PaymentReceipt",
    "fetch",
    "verify_creator",
    "verify_content",
    # Settlement math
    "PLATFORM_FEE_BPS",
    "USDC_BASE_UNIT",
    "USDC_DECIMALS",
    "lock_amount_base_units",
    "milestone_amounts_base_units",
]
