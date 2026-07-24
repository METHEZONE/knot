"""PDA 유도 단위 테스트 (검증기/네트워크 불필요)."""
from solders.pubkey import Pubkey

from knot.escrow import pdas

BRAND = Pubkey.default()


def test_program_id_parses():
    assert len(str(pdas.PROGRAM_ID)) > 0


def test_campaign_pda_deterministic_and_unique():
    a = pdas.campaign_pda(BRAND, 1)
    b = pdas.campaign_pda(BRAND, 1)
    assert a == b
    assert a[0] != pdas.campaign_pda(BRAND, 2)[0]


def test_vault_and_authority_distinct():
    campaign, _ = pdas.campaign_pda(BRAND, 7)
    vault, vbump = pdas.vault_pda(campaign)
    auth, abump = pdas.vault_authority_pda(campaign)
    assert vault != auth
    assert 0 <= vbump <= 255 and 0 <= abump <= 255


def test_reputation_pda():
    rep, _ = pdas.reputation_pda(BRAND)
    assert rep != BRAND
