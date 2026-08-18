"""증빙 검증 정책 — 관측을 위반 목록으로, 위반 목록을 4단 판정으로 바꾼다.

판정이 둘(통과/거절)뿐이면 "고치면 되는 것" 과 "판단이 안 되는 것" 이 모두 거절로
떨어진다. 그러면 태그 하나 빠뜨린 크리에이터가 전액을 잃고, 일시적 fetch 실패가 계약을
깨뜨린다. 그래서 스펙(docs/13 §9)대로 4단으로 나눈다.

  VERIFIED           모든 결정론 게이트 통과 → 정산
  REVISION_REQUIRED  고칠 수 있는 결함 → 재제출 (횟수는 협상된 revisionRounds 로 제한)
  MANUAL_REVIEW      판단 불가 → 사람 확인 (자동 거절하지 않는다)
  REJECTED           확정 위반 또는 수정 기회 소진 → 환불 경로

핵심 원칙: **저신뢰는 자동으로 실패시키지도, 릴리즈하지도 않는다**(docs/13 §9).
"""

from dataclasses import dataclass, field

from libs.policies.decision import PolicyDecision, Violation, allow, block

EVIDENCE_POLICY_VERSION = "verification-v1"

VERIFIED = "VERIFIED"
REVISION_REQUIRED = "REVISION_REQUIRED"
MANUAL_REVIEW = "MANUAL_REVIEW"
REJECTED = "REJECTED"

# 고칠 수 있는 결함 — 크리에이터가 다시 올리면 해결된다.
FIXABLE_VIOLATION_CODES = frozenset(
    {
        "EVIDENCE_DISCLOSURE_MISSING",
    }
)

# 판단 불가 — 원인이 크리에이터 잘못인지 일시적 장애인지 구분할 수 없다.
# urlReachable=False 는 "삭제됨" 일 수도 있고 "네트워크 일시 실패" 일 수도 있어서,
# 자동 거절하면 정상 크리에이터의 자금을 잘못 뺏을 수 있다.
UNCERTAIN_VIOLATION_CODES = frozenset(
    {
        "EVIDENCE_URL_UNREACHABLE",
    }
)


def validate_evidence_observations(
    observations: dict[str, object],
) -> PolicyDecision:
    violations: list[Violation] = []

    if observations.get("urlReachable") is not True:
        violations.append(
            Violation(
                code="EVIDENCE_URL_UNREACHABLE",
                field="observations.urlReachable",
                rule="urlReachable",
            )
        )

    if observations.get("brandMentioned") is not True:
        violations.append(
            Violation(
                code="EVIDENCE_BRAND_MENTION_MISSING",
                field="observations.brandMentioned",
                rule="brandMentioned",
            )
        )

    if observations.get("disclosurePresent") is not True:
        violations.append(
            Violation(
                code="EVIDENCE_DISCLOSURE_MISSING",
                field="observations.disclosurePresent",
                rule="requiredDisclosures",
            )
        )

    prohibited_claims = observations.get("prohibitedClaimsFound")
    if isinstance(prohibited_claims, list) and prohibited_claims:
        violations.append(
            Violation(
                code="EVIDENCE_PROHIBITED_CLAIM_FOUND",
                field="observations.prohibitedClaimsFound",
                rule="prohibitedClaims",
            )
        )

    if violations:
        return block(EVIDENCE_POLICY_VERSION, violations)
    return allow(EVIDENCE_POLICY_VERSION)


@dataclass(frozen=True)
class EvidenceOutcome:
    """4단 판정 결과.

    `revisions_remaining` 은 남은 재제출 횟수다. REVISION_REQUIRED 가 아니면 0.
    """

    status: str
    reason_codes: list[str] = field(default_factory=list)
    revisions_remaining: int = 0

    @property
    def releasable(self) -> bool:
        return self.status == VERIFIED

    @property
    def refundable(self) -> bool:
        """환불 경로로 넘어가야 하는 판정인가 (P2 에서 실제 환불을 붙인다)."""
        return self.status == REJECTED


def classify_evidence_outcome(
    decision: PolicyDecision,
    *,
    revisions_used: int = 0,
    max_revision_rounds: int = 0,
    low_confidence: bool = False,
) -> EvidenceOutcome:
    """위반 목록과 재제출 잔여 횟수로 4단 판정을 낸다.

    우선순위: 확정 위반 > 판단 불가 > 고칠 수 있음. 확정 위반이 있으면 다른 불확실성이
    있어도 결론은 나 있다. 반대로 확정 위반이 없는데 판단 불가가 섞여 있으면 사람에게
    넘긴다 — 자동 거절이 곧 자금 회수를 뜻하므로 틀리면 비싸다.
    """
    codes = [violation.code for violation in decision.violations]

    if decision.allowed:
        if low_confidence:
            # 게이트는 통과했지만 신뢰도가 낮다 → 릴리즈도 거절도 하지 않는다.
            return EvidenceOutcome(status=MANUAL_REVIEW, reason_codes=["EVIDENCE_LOW_CONFIDENCE"])
        return EvidenceOutcome(status=VERIFIED)

    non_hard = FIXABLE_VIOLATION_CODES | UNCERTAIN_VIOLATION_CODES
    hard = [code for code in codes if code not in non_hard]
    if hard:
        return EvidenceOutcome(status=REJECTED, reason_codes=hard)

    uncertain = [code for code in codes if code in UNCERTAIN_VIOLATION_CODES]
    if uncertain or low_confidence:
        reasons = list(uncertain)
        if low_confidence:
            reasons.append("EVIDENCE_LOW_CONFIDENCE")
        return EvidenceOutcome(status=MANUAL_REVIEW, reason_codes=reasons)

    fixable = [code for code in codes if code in FIXABLE_VIOLATION_CODES]
    remaining = max_revision_rounds - revisions_used
    if fixable and remaining > 0:
        return EvidenceOutcome(
            status=REVISION_REQUIRED,
            reason_codes=fixable,
            revisions_remaining=remaining,
        )
    # 수정 기회를 소진했으면 더 기다릴 근거가 없다 → 확정 거절.
    return EvidenceOutcome(status=REJECTED, reason_codes=fixable or codes)
