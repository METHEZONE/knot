"""증빙 4단 판정 — 어떤 위반이 어느 판정으로 가는지 고정한다.

이 분류가 곧 자금의 향방이다. REJECTED 는 환불 경로로 이어지므로(docs/17 P2) 고칠 수
있는 결함이나 판단 불가가 REJECTED 로 새면 정상 크리에이터의 대금을 잘못 회수한다.
"""

from libs.policies.evidence import (
    MANUAL_REVIEW,
    REJECTED,
    REVISION_REQUIRED,
    VERIFIED,
    classify_evidence_outcome,
    validate_evidence_observations,
)


def observations(**overrides: object) -> dict[str, object]:
    base: dict[str, object] = {
        "urlReachable": True,
        "brandMentioned": True,
        "disclosurePresent": True,
        "prohibitedClaimsFound": [],
        "lowConfidence": False,
    }
    base.update(overrides)
    return base


def classify(obs: dict[str, object], *, used: int = 0, allowed_rounds: int = 1):
    return classify_evidence_outcome(
        validate_evidence_observations(obs),
        revisions_used=used,
        max_revision_rounds=allowed_rounds,
        low_confidence=bool(obs.get("lowConfidence")),
    )


def test_clean_evidence_is_verified() -> None:
    outcome = classify(observations())
    assert outcome.status == VERIFIED
    assert outcome.releasable is True
    assert outcome.refundable is False


def test_missing_disclosure_is_fixable_while_revisions_remain() -> None:
    outcome = classify(observations(disclosurePresent=False), used=0, allowed_rounds=1)
    assert outcome.status == REVISION_REQUIRED
    assert outcome.reason_codes == ["EVIDENCE_DISCLOSURE_MISSING"]
    assert outcome.revisions_remaining == 1
    assert outcome.releasable is False
    assert outcome.refundable is False


def test_missing_disclosure_becomes_rejected_when_revisions_are_exhausted() -> None:
    """수정 기회를 다 쓰면 더 기다릴 근거가 없다 → 확정 거절 → 환불 경로."""
    outcome = classify(observations(disclosurePresent=False), used=1, allowed_rounds=1)
    assert outcome.status == REJECTED
    assert outcome.refundable is True


def test_unreachable_url_goes_to_manual_review_not_rejection() -> None:
    """삭제됐는지 일시 장애인지 구분할 수 없다 — 자동 거절하면 정상 대금을 빼앗는다."""
    outcome = classify(observations(urlReachable=False))
    assert outcome.status == MANUAL_REVIEW
    assert outcome.reason_codes == ["EVIDENCE_URL_UNREACHABLE"]
    assert outcome.refundable is False


def test_missing_brand_mention_is_a_hard_violation() -> None:
    outcome = classify(observations(brandMentioned=False))
    assert outcome.status == REJECTED
    assert outcome.reason_codes == ["EVIDENCE_BRAND_MENTION_MISSING"]


def test_prohibited_claim_is_a_hard_violation() -> None:
    outcome = classify(observations(prohibitedClaimsFound=["cures acne"]))
    assert outcome.status == REJECTED
    assert outcome.reason_codes == ["EVIDENCE_PROHIBITED_CLAIM_FOUND"]


def test_low_confidence_does_not_release_even_when_gates_pass() -> None:
    """docs/13 §9: 저신뢰는 자동으로 실패시키지도, 릴리즈하지도 않는다."""
    outcome = classify(observations(lowConfidence=True))
    assert outcome.status == MANUAL_REVIEW
    assert outcome.reason_codes == ["EVIDENCE_LOW_CONFIDENCE"]
    assert outcome.releasable is False
    assert outcome.refundable is False


def test_low_confidence_upgrades_a_fixable_defect_to_review() -> None:
    outcome = classify(observations(disclosurePresent=False, lowConfidence=True))
    assert outcome.status == MANUAL_REVIEW
    assert "EVIDENCE_LOW_CONFIDENCE" in outcome.reason_codes


def test_hard_violation_wins_over_uncertainty() -> None:
    """확정 위반이 있으면 다른 불확실성이 섞여도 결론은 나 있다."""
    outcome = classify(observations(brandMentioned=False, urlReachable=False, lowConfidence=True))
    assert outcome.status == REJECTED
    assert outcome.reason_codes == ["EVIDENCE_BRAND_MENTION_MISSING"]


def test_uncertainty_wins_over_a_fixable_defect() -> None:
    outcome = classify(observations(urlReachable=False, disclosurePresent=False))
    assert outcome.status == MANUAL_REVIEW


def test_zero_allowed_revisions_rejects_a_fixable_defect() -> None:
    """협상에서 수정 기회를 0으로 합의했다면 고칠 수 있는 결함도 바로 거절이다."""
    outcome = classify(observations(disclosurePresent=False), used=0, allowed_rounds=0)
    assert outcome.status == REJECTED
