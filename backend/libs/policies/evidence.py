from libs.policies.decision import PolicyDecision, Violation, allow, block

EVIDENCE_POLICY_VERSION = "verification-v1"


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
