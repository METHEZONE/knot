from collections.abc import Sequence
from datetime import UTC, date, datetime
from typing import cast
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query, status

from apps.api.schemas import (
    EvidenceObservations,
    EvidenceSubmissionRequest,
    EvidenceVerificationRequest,
    PromotionCreateRequest,
)
from libs.a2a.models import NegotiationMessageType, NegotiationPayload
from libs.agents.brand import build_initial_terms
from libs.agents.matching import MATCHING_WEIGHTS_VERSION, rank_creators
from libs.agents.negotiation import CreatorNegotiationContext, evaluate_creator_message
from libs.domain.hashing import canonical_terms_json
from libs.domain.models import AgreementTerms, CreatorProfile, Promotion
from libs.policies.brand import validate_brand_terms
from libs.policies.evidence import validate_evidence_observations
from libs.repositories.firestore_paths import COLLECTIONS, FirestorePaths
from libs.repositories.serialization import model_to_document
from libs.repositories.store import KnotRepository


def build_api_router(repository: KnotRepository) -> APIRouter:
    router = APIRouter(prefix="/api/v1")

    @router.get("")
    def api_root() -> dict[str, object]:
        return _ok({"service": "knot-api"})

    @router.post("/promotions", status_code=status.HTTP_201_CREATED)
    def create_promotion(payload: PromotionCreateRequest) -> dict[str, object]:
        promotion_id = payload.promotion_id or f"promotion-{uuid4()}"
        if repository.get_promotion(promotion_id) is not None:
            raise _problem(
                status.HTTP_409_CONFLICT,
                "IDEMPOTENCY_CONFLICT",
                f"Promotion {promotion_id} already exists.",
            )

        promotion = payload.to_promotion(promotion_id=promotion_id, now=_now_datetime())
        repository.save_promotion(promotion)
        _append_event(
            repository,
            promotion_id=promotion.promotion_id,
            event_type="PROMOTION_CREATED",
            data={"status": promotion.status},
        )
        return _ok({"promotion": model_to_document(promotion)})

    @router.get("/promotions")
    def list_promotions() -> dict[str, object]:
        promotions = sorted(repository.list_promotions(), key=lambda item: item.promotion_id)
        return _ok({"promotions": [model_to_document(promotion) for promotion in promotions]})

    @router.get("/promotions/{promotion_id}")
    def get_promotion(promotion_id: str) -> dict[str, object]:
        promotion = _get_promotion(repository, promotion_id)
        return _ok({"promotion": model_to_document(promotion)})

    @router.post("/promotions/{promotion_id}:activate")
    def activate_promotion(promotion_id: str) -> dict[str, object]:
        promotion = _get_promotion(repository, promotion_id)
        if promotion.status == "ACTIVE":
            return _ok({"promotion": model_to_document(promotion)})
        if promotion.status != "DRAFT":
            raise _problem(
                status.HTTP_409_CONFLICT,
                "INVALID_STATE_TRANSITION",
                f"Cannot activate Promotion in {promotion.status} state.",
            )

        activated = promotion.model_copy(
            update={"status": "ACTIVE", "updated_at": _now_datetime()}
        )
        repository.save_promotion(activated)
        _append_event(
            repository,
            promotion_id=promotion_id,
            event_type="PROMOTION_ACTIVATED",
            data={"status": "ACTIVE"},
        )
        return _ok({"promotion": model_to_document(activated)})

    @router.post("/promotions/{promotion_id}/matches:run", status_code=status.HTTP_201_CREATED)
    def run_matches(promotion_id: str) -> dict[str, object]:
        promotion = _get_promotion(repository, promotion_id)
        creators = repository.list_creator_profiles()
        ranked = rank_creators(promotion, creators)
        selected = next((candidate for candidate in ranked if candidate.eligible), None)
        selected_creator = (
            _creator_by_agent_id(creators, selected.creator_agent_id) if selected else None
        )
        match_run_id = f"match-{uuid4()}"
        now = _now()
        match_run = {
            "matchRunId": match_run_id,
            "promotionId": promotion.promotion_id,
            "brandAgentId": promotion.brand_agent_id,
            "status": "COMPLETED",
            "weightsVersion": MATCHING_WEIGHTS_VERSION,
            "selectedCreatorId": selected_creator.creator_id if selected_creator else None,
            "selectedCreatorAgentId": selected.creator_agent_id if selected else None,
            "createdAt": now,
            "completedAt": now,
        }
        repository.save_raw_document(FirestorePaths.match_run(match_run_id), match_run)
        for candidate in ranked:
            creator = _creator_by_agent_id(creators, candidate.creator_agent_id)
            document = candidate.model_dump(by_alias=True, mode="json")
            document["creatorId"] = creator.creator_id
            document["creatorProfilePath"] = FirestorePaths.creator_profile(creator.creator_id)
            document["explanation"] = _candidate_explanation(document)
            document["negotiationId"] = None
            repository.save_raw_document(
                FirestorePaths.match_candidate(match_run_id, creator.creator_id),
                document,
            )
        _append_event(
            repository,
            promotion_id=promotion_id,
            event_type="MATCH_RUN_COMPLETED",
            data={
                "matchRunId": match_run_id,
                "selectedCreatorAgentId": selected.creator_agent_id if selected else None,
            },
        )
        return _ok({"matchRun": match_run})

    @router.get("/match-runs/{match_run_id}")
    def get_match_run(match_run_id: str) -> dict[str, object]:
        match_run = repository.get_raw_document(FirestorePaths.match_run(match_run_id))
        if match_run is None:
            raise _not_found("matchRun", match_run_id)
        return _ok({"matchRun": match_run})

    @router.get("/match-runs/{match_run_id}/candidates")
    def list_match_candidates(match_run_id: str) -> dict[str, object]:
        if repository.get_raw_document(FirestorePaths.match_run(match_run_id)) is None:
            raise _not_found("matchRun", match_run_id)
        candidates = repository.list_raw_documents(
            f"{COLLECTIONS.match_runs}/{match_run_id}/{COLLECTIONS.match_candidates}"
        )
        candidates.sort(key=lambda item: (item.get("rank") is None, item.get("rank") or 9999))
        return _ok({"candidates": candidates})

    @router.post("/match-runs/{match_run_id}/candidates/{creator_agent_id}:select")
    def select_match_candidate(match_run_id: str, creator_agent_id: str) -> dict[str, object]:
        match_run_path = FirestorePaths.match_run(match_run_id)
        match_run = repository.get_raw_document(match_run_path)
        if match_run is None:
            raise _not_found("matchRun", match_run_id)
        candidate_path, candidate = _match_candidate_by_agent_id(
            repository,
            match_run_id,
            creator_agent_id,
        )
        if candidate is None:
            raise _not_found("candidate", creator_agent_id)
        if candidate.get("eligible") is not True:
            raise _problem(
                status.HTTP_409_CONFLICT,
                "POLICY_VIOLATION",
                "Cannot select an ineligible creator candidate.",
            )
        match_run["selectedCreatorId"] = candidate["creatorId"]
        match_run["selectedCreatorAgentId"] = creator_agent_id
        match_run["updatedAt"] = _now()
        repository.save_raw_document(candidate_path, {**candidate, "selected": True})
        repository.save_raw_document(match_run_path, match_run)
        _append_event(
            repository,
            promotion_id=_require_document_str(match_run, "promotionId"),
            event_type="MATCH_CANDIDATE_SELECTED",
            data={
                "matchRunId": match_run_id,
                "creatorId": candidate["creatorId"],
                "creatorAgentId": creator_agent_id,
            },
        )
        return _ok({"matchRun": match_run})

    @router.post(
        "/match-runs/{match_run_id}:start-negotiation",
        status_code=status.HTTP_201_CREATED,
    )
    def start_negotiation(match_run_id: str) -> dict[str, object]:
        match_run = repository.get_raw_document(FirestorePaths.match_run(match_run_id))
        if match_run is None:
            raise _not_found("matchRun", match_run_id)
        promotion_id = _require_document_str(match_run, "promotionId")
        creator_agent_id = _require_document_str(match_run, "selectedCreatorAgentId")
        match_candidate_id = _require_document_str(match_run, "selectedCreatorId")
        promotion = _get_promotion(repository, promotion_id)
        creator = repository.get_creator_profile_by_agent_id(creator_agent_id)
        if creator is None:
            raise _not_found("creatorAgent", creator_agent_id)
        candidate_path = FirestorePaths.match_candidate(match_run_id, match_candidate_id)
        candidate = repository.get_raw_document(candidate_path)
        if candidate is None:
            raise _not_found("candidate", match_candidate_id)
        agent_policy = repository.get_agent_policy(creator_agent_id)
        if agent_policy is None:
            raise _not_found("agentPolicy", creator_agent_id)

        terms = build_initial_terms(promotion, creator)
        brand_decision = validate_brand_terms(promotion, creator, terms, current_round=1)
        if not brand_decision.allowed:
            raise _problem(
                status.HTTP_409_CONFLICT,
                "POLICY_VIOLATION",
                "Initial terms do not satisfy Brand policy.",
            )

        negotiation_id = f"negotiation-{uuid4()}"
        context_id = f"context-{uuid4()}"
        task_id = f"task-{uuid4()}"
        artifact_id = f"artifact-{uuid4()}"
        offer_message_id = f"message-{uuid4()}"
        decision_id = f"decision-{uuid4()}"
        now = _now()
        payload = NegotiationPayload(
            type=NegotiationMessageType.OFFER,
            round=1,
            promotion=promotion,
            terms=terms,
            changedFields=[],
            rationale="Initial promotion offer",
        )
        creator_decision = evaluate_creator_message(
            CreatorNegotiationContext(
                creatorAgentId=creator_agent_id,
                policy=agent_policy.creator,
                today=_policy_today(promotion),
                currentMonthDeliverables=creator.active_deliverables_this_month,
                maxRounds=promotion.autonomy.max_negotiation_rounds,
            ),
            payload,
        )
        response_message_id = f"message-{uuid4()}"
        negotiation_status = _negotiation_status(creator_decision.type)
        negotiation = {
            "negotiationId": negotiation_id,
            "matchRunId": match_run_id,
            "matchCandidateId": match_candidate_id,
            "matchCandidatePath": candidate_path,
            "promotionId": promotion.promotion_id,
            "brandAgentId": promotion.brand_agent_id,
            "creatorAgentId": creator_agent_id,
            "contextId": context_id,
            "taskId": task_id,
            "status": negotiation_status,
            "currentRound": 1,
            "maxRounds": promotion.autonomy.max_negotiation_rounds,
            "currentTerms": terms.model_dump(by_alias=True, mode="json"),
            "brandPolicySnapshot": {
                "ruleVersion": brand_decision.rule_version,
                "decision": brand_decision.model_dump(by_alias=True, mode="json"),
            },
            "creatorPolicySnapshot": agent_policy.model_dump(by_alias=True, mode="json"),
            "lastMessageId": response_message_id,
            "createdAt": now,
            "updatedAt": now,
        }
        repository.save_raw_document(FirestorePaths.negotiation(negotiation_id), negotiation)
        repository.save_raw_document(
            FirestorePaths.a2a_task(task_id),
            {
                "taskId": task_id,
                "contextId": context_id,
                "negotiationId": negotiation_id,
                "status": {"state": "TASK_STATE_COMPLETED"},
                "createdAt": now,
                "updatedAt": now,
            },
        )
        repository.save_raw_document(
            FirestorePaths.negotiation_message(negotiation_id, offer_message_id),
            {
                "messageId": offer_message_id,
                "contextId": context_id,
                "taskId": task_id,
                "role": "ROLE_USER",
                "sequence": 1,
                "payload": payload.model_dump(by_alias=True, mode="json"),
                "createdAt": now,
            },
        )
        repository.save_raw_document(
            FirestorePaths.negotiation_message(negotiation_id, response_message_id),
            {
                "messageId": response_message_id,
                "contextId": context_id,
                "taskId": task_id,
                "role": "ROLE_AGENT",
                "sequence": 2,
                "payload": creator_decision.model_dump(by_alias=True, mode="json"),
                "createdAt": now,
            },
        )
        creator_decision_document = creator_decision.model_dump(by_alias=True, mode="json")
        repository.save_raw_document(
            FirestorePaths.negotiation_decision(negotiation_id, decision_id),
            {
                "decisionId": decision_id,
                "messageId": response_message_id,
                "type": creator_decision.type.value,
                "policyDecision": creator_decision.policy_decision.model_dump(
                    by_alias=True,
                    mode="json",
                ),
                "createdAt": now,
            },
        )
        repository.save_raw_document(
            candidate_path,
            {
                **candidate,
                "negotiationId": negotiation_id,
                "negotiationPath": FirestorePaths.negotiation(negotiation_id),
                "negotiationStatus": negotiation_status,
                "updatedAt": now,
            },
        )
        agreement = _agreement_document(
            negotiation=negotiation,
            decision=creator_decision_document,
            artifact_id=artifact_id,
            task_id=task_id,
            created_at=now,
        )
        if agreement is not None:
            repository.save_raw_document(
                FirestorePaths.a2a_task_artifact(task_id, artifact_id),
                _term_sheet_artifact_document(
                    artifact_id=artifact_id,
                    task_id=task_id,
                    negotiation_id=negotiation_id,
                    decision=creator_decision_document,
                    created_at=now,
                ),
            )
            repository.save_raw_document(
                FirestorePaths.agreement(str(agreement["agreementId"])),
                agreement,
            )
            _write_agreement_milestones(repository, agreement)
        event_data: dict[str, object] = {
            "matchRunId": match_run_id,
            "negotiationId": negotiation_id,
            "taskId": task_id,
            "status": negotiation_status,
            "creatorAgentId": creator_agent_id,
        }
        if agreement is not None:
            event_data["agreementId"] = agreement["agreementId"]
            event_data["termsHash"] = agreement["termsHash"]
        _append_event(
            repository,
            promotion_id=promotion_id,
            event_type="NEGOTIATION_STARTED",
            data=event_data,
        )
        if agreement is not None:
            _append_event(
                repository,
                promotion_id=promotion_id,
                event_type="AGREEMENT_CREATED",
                data={
                    "agreementId": agreement["agreementId"],
                    "negotiationId": negotiation_id,
                    "taskId": task_id,
                    "artifactId": artifact_id,
                    "termsHash": agreement["termsHash"],
                    "status": agreement["status"],
                },
            )
        return _ok({"negotiation": negotiation, "agreement": agreement})

    @router.get("/negotiations/{negotiation_id}")
    def get_negotiation(negotiation_id: str) -> dict[str, object]:
        negotiation = repository.get_raw_document(FirestorePaths.negotiation(negotiation_id))
        if negotiation is None:
            raise _not_found("negotiation", negotiation_id)
        return _ok({"negotiation": negotiation})

    @router.get("/negotiations/{negotiation_id}/messages")
    def list_negotiation_messages(negotiation_id: str) -> dict[str, object]:
        _require_negotiation(repository, negotiation_id)
        messages = repository.list_raw_documents(
            f"{COLLECTIONS.negotiations}/{negotiation_id}/{COLLECTIONS.negotiation_messages}"
        )
        messages.sort(key=lambda item: (str(item.get("createdAt", "")), item.get("sequence", 0)))
        return _ok({"messages": messages})

    @router.get("/negotiations/{negotiation_id}/events")
    def list_negotiation_events(negotiation_id: str) -> dict[str, object]:
        _require_negotiation(repository, negotiation_id)
        decisions = repository.list_raw_documents(
            f"{COLLECTIONS.negotiations}/{negotiation_id}/{COLLECTIONS.negotiation_decisions}"
        )
        decisions.sort(key=lambda item: str(item.get("createdAt", "")))
        return _ok(
            {
                "events": [
                    {
                        "eventId": decision["decisionId"],
                        "type": f"NEGOTIATION_{decision['type']}",
                        "data": decision,
                        "createdAt": decision["createdAt"],
                    }
                    for decision in decisions
                ]
            }
        )

    @router.post("/negotiations/{negotiation_id}:cancel")
    def cancel_negotiation(negotiation_id: str) -> dict[str, object]:
        path = FirestorePaths.negotiation(negotiation_id)
        negotiation = repository.get_raw_document(path)
        if negotiation is None:
            raise _not_found("negotiation", negotiation_id)
        if negotiation.get("status") in {"AGREED", "REJECTED", "CANCELED"}:
            raise _problem(
                status.HTTP_409_CONFLICT,
                "INVALID_STATE_TRANSITION",
                "Terminal negotiations cannot be canceled.",
            )
        negotiation["status"] = "CANCELED"
        negotiation["updatedAt"] = _now()
        repository.save_raw_document(path, negotiation)
        _append_event(
            repository,
            promotion_id=_require_document_str(negotiation, "promotionId"),
            event_type="NEGOTIATION_CANCELED",
            data={
                "negotiationId": negotiation_id,
                "status": "CANCELED",
            },
        )
        return _ok({"negotiation": negotiation})

    @router.get("/agreements/{agreement_id}")
    def get_agreement(agreement_id: str) -> dict[str, object]:
        agreement = repository.get_raw_document(FirestorePaths.agreement(agreement_id))
        if agreement is None:
            raise _not_found("agreement", agreement_id)
        return _ok({"agreement": agreement})

    @router.post("/agreements/{agreement_id}/evidence", status_code=status.HTTP_201_CREATED)
    def submit_evidence(
        agreement_id: str,
        payload: EvidenceSubmissionRequest,
    ) -> dict[str, object]:
        agreement = _get_agreement_document(repository, agreement_id)
        creator_agent_id = _require_document_str(agreement, "creatorAgentId")
        milestone = _get_milestone_document(repository, agreement_id, payload.milestone_id)
        if payload.submitted_by_agent_id != creator_agent_id:
            raise _problem(
                status.HTTP_409_CONFLICT,
                "POLICY_VIOLATION",
                "Evidence submitter must match the Agreement creator agent.",
            )

        evidence_id = f"evidence-{uuid4()}"
        now = _now()
        evidence = {
            "evidenceId": evidence_id,
            "agreementId": agreement_id,
            "milestoneId": payload.milestone_id,
            "milestonePath": FirestorePaths.milestone(agreement_id, payload.milestone_id),
            "milestoneSnapshot": milestone,
            "promotionId": agreement["promotionId"],
            "creatorAgentId": creator_agent_id,
            "submittedByAgentId": payload.submitted_by_agent_id,
            "url": payload.url,
            "status": "SUBMITTED",
            "observations": None,
            "policyDecision": None,
            "createdAt": now,
            "updatedAt": now,
        }
        repository.save_raw_document(FirestorePaths.evidence(evidence_id), evidence)
        _append_event(
            repository,
            promotion_id=str(agreement["promotionId"]),
            event_type="EVIDENCE_SUBMITTED",
            data={
                "agreementId": agreement_id,
                "milestoneId": payload.milestone_id,
                "evidenceId": evidence_id,
                "status": "SUBMITTED",
            },
        )
        return _ok({"evidence": evidence})

    @router.get("/evidence/{evidence_id}")
    def get_evidence(evidence_id: str) -> dict[str, object]:
        evidence = repository.get_raw_document(FirestorePaths.evidence(evidence_id))
        if evidence is None:
            raise _not_found("evidence", evidence_id)
        return _ok({"evidence": evidence})

    @router.post("/evidence/{evidence_id}:verify")
    def verify_evidence(
        evidence_id: str,
        payload: EvidenceVerificationRequest | None = None,
    ) -> dict[str, object]:
        evidence_path = FirestorePaths.evidence(evidence_id)
        evidence = repository.get_raw_document(evidence_path)
        if evidence is None:
            raise _not_found("evidence", evidence_id)
        agreement = _get_agreement_document(
            repository,
            _require_document_str(evidence, "agreementId"),
        )
        observations = _evidence_observations(
            evidence=evidence,
            agreement=agreement,
            payload=payload,
        )
        policy_decision = validate_evidence_observations(observations)
        verified = {
            **evidence,
            "status": "PASSED" if policy_decision.allowed else "FAILED",
            "observations": observations,
            "policyDecision": policy_decision.model_dump(by_alias=True, mode="json"),
            "verifiedAt": _now(),
            "updatedAt": _now(),
        }
        repository.save_raw_document(evidence_path, verified)
        _append_event(
            repository,
            promotion_id=str(verified["promotionId"]),
            event_type="EVIDENCE_VERIFIED",
            data={
                "agreementId": verified["agreementId"],
                "milestoneId": verified["milestoneId"],
                "evidenceId": evidence_id,
                "status": verified["status"],
                "violationCodes": [
                    violation.code for violation in policy_decision.violations
                ],
            },
        )
        if not policy_decision.allowed:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "type": "https://knot.example/errors/evidence-verification-failed",
                    "title": "Evidence Verification Failed",
                    "status": status.HTTP_409_CONFLICT,
                    "detail": "Evidence does not satisfy verification policy.",
                    "code": "EVIDENCE_VERIFICATION_FAILED",
                    "evidence": verified,
                },
            )
        return _ok({"evidence": verified})

    @router.get("/promotions/{promotion_id}/timeline")
    def get_promotion_timeline(promotion_id: str) -> dict[str, object]:
        _get_promotion(repository, promotion_id)
        events = repository.list_raw_documents(
            f"{COLLECTIONS.promotions}/{promotion_id}/{COLLECTIONS.promotion_events}"
        )
        events.sort(key=lambda item: str(item.get("createdAt", "")))
        return _ok({"events": events})

    @router.get("/audit-events")
    def list_audit_events(
        promotion_id: str | None = Query(default=None, alias="promotionId"),
        limit: int = Query(default=100, ge=1, le=500),
    ) -> dict[str, object]:
        events = repository.list_audit_events()
        if promotion_id is not None:
            events = [event for event in events if event.get("promotionId") == promotion_id]
        events.sort(key=lambda item: str(item.get("createdAt", "")), reverse=True)
        return _ok({"events": events[:limit]})

    return router


def _get_promotion(repository: KnotRepository, promotion_id: str) -> Promotion:
    promotion = repository.get_promotion(promotion_id)
    if promotion is None:
        raise _not_found("promotion", promotion_id)
    return promotion


def _require_negotiation(repository: KnotRepository, negotiation_id: str) -> dict[str, object]:
    negotiation = repository.get_raw_document(FirestorePaths.negotiation(negotiation_id))
    if negotiation is None:
        raise _not_found("negotiation", negotiation_id)
    return negotiation


def _get_agreement_document(repository: KnotRepository, agreement_id: str) -> dict[str, object]:
    agreement = repository.get_raw_document(FirestorePaths.agreement(agreement_id))
    if agreement is None:
        raise _not_found("agreement", agreement_id)
    if agreement.get("status") != "AGREED":
        raise _problem(
            status.HTTP_409_CONFLICT,
            "INVALID_STATE_TRANSITION",
            "Evidence requires an agreed Agreement.",
        )
    return agreement


def _get_milestone_document(
    repository: KnotRepository,
    agreement_id: str,
    milestone_id: str,
) -> dict[str, object]:
    milestone = repository.get_raw_document(FirestorePaths.milestone(agreement_id, milestone_id))
    if milestone is None:
        raise _not_found("milestone", milestone_id)
    return milestone


def _require_document_str(document: dict[str, object], field_name: str) -> str:
    value = document.get(field_name)
    if not isinstance(value, str) or not value:
        raise _problem(
            status.HTTP_409_CONFLICT,
            "INVALID_STATE_TRANSITION",
            f"{field_name} is not set.",
        )
    return value


def _negotiation_status(message_type: NegotiationMessageType) -> str:
    if message_type == NegotiationMessageType.ACCEPT:
        return "AGREED"
    if message_type == NegotiationMessageType.REJECT:
        return "REJECTED"
    if message_type == NegotiationMessageType.COUNTER:
        return "COUNTERED"
    return "ESCALATED"


def _agreement_document(
    *,
    negotiation: dict[str, object],
    decision: dict[str, object],
    artifact_id: str,
    task_id: str,
    created_at: str,
) -> dict[str, object] | None:
    if decision.get("type") != NegotiationMessageType.ACCEPT.value:
        return None
    agreement_id = decision.get("agreementId")
    terms = decision.get("terms")
    terms_hash = decision.get("termsHash")
    if (
        not isinstance(agreement_id, str)
        or not isinstance(terms, dict)
        or not isinstance(terms_hash, str)
    ):
        raise _problem(
            status.HTTP_409_CONFLICT,
            "INVALID_STATE_TRANSITION",
            "Accepted negotiation is missing agreement terms.",
        )
    agreement_terms = AgreementTerms.model_validate(terms)
    return {
        "agreementId": agreement_id,
        "negotiationId": negotiation["negotiationId"],
        "taskId": task_id,
        "artifactId": artifact_id,
        "promotionId": negotiation["promotionId"],
        "brandAgentId": negotiation["brandAgentId"],
        "creatorAgentId": negotiation["creatorAgentId"],
        "terms": terms,
        "canonicalTermsJson": canonical_terms_json(agreement_terms),
        "termsHash": terms_hash,
        "status": "AGREED",
        "createdAt": created_at,
    }


def _term_sheet_artifact_document(
    *,
    artifact_id: str,
    task_id: str,
    negotiation_id: str,
    decision: dict[str, object],
    created_at: str,
) -> dict[str, object]:
    return {
        "artifactId": artifact_id,
        "taskId": task_id,
        "negotiationId": negotiation_id,
        "name": "Negotiation Result",
        "parts": [
            {
                "mediaType": "application/json",
                "data": {
                    "schema": "knot.term-sheet.v1",
                    "result": "AGREED",
                    "agreementId": decision["agreementId"],
                    "terms": decision["terms"],
                    "termsHash": decision["termsHash"],
                    "rationale": decision["rationale"],
                },
            }
        ],
        "createdAt": created_at,
    }


def _write_agreement_milestones(
    repository: KnotRepository,
    agreement: dict[str, object],
) -> None:
    agreement_id = _require_document_str(agreement, "agreementId")
    terms = AgreementTerms.model_validate(agreement["terms"])
    for milestone in terms.milestones:
        repository.save_raw_document(
            FirestorePaths.milestone(agreement_id, milestone.id),
            {
                "milestoneId": milestone.id,
                "agreementId": agreement_id,
                "trigger": milestone.trigger,
                "releasePct": milestone.release_pct,
                "status": "PENDING",
                "createdAt": agreement["createdAt"],
            },
        )


def _match_candidate_by_agent_id(
    repository: KnotRepository,
    match_run_id: str,
    creator_agent_id: str,
) -> tuple[str, dict[str, object] | None]:
    candidates = repository.list_raw_documents(
        f"{COLLECTIONS.match_runs}/{match_run_id}/{COLLECTIONS.match_candidates}"
    )
    for candidate in candidates:
        if candidate.get("creatorAgentId") == creator_agent_id:
            creator_id = _require_document_str(candidate, "creatorId")
            return FirestorePaths.match_candidate(match_run_id, creator_id), candidate
    return "", None


def _creator_by_agent_id(
    creators: Sequence[CreatorProfile],
    creator_agent_id: str,
) -> CreatorProfile:
    for creator in creators:
        if creator.creator_agent_id == creator_agent_id:
            return creator
    raise ValueError(f"creator profile for {creator_agent_id} was not found")


def _evidence_observations(
    *,
    evidence: dict[str, object],
    agreement: dict[str, object],
    payload: EvidenceVerificationRequest | None,
) -> dict[str, object]:
    if payload is not None and payload.observations is not None:
        return payload.observations.model_dump(by_alias=True, mode="json")

    terms = AgreementTerms.model_validate(agreement["terms"])
    url = _require_document_str(evidence, "url").lower()
    prohibited_claims_found = [
        claim
        for claim in terms.constraints.prohibited_claims
        if claim.lower() in url
    ]
    return EvidenceObservations(
        urlReachable="unreachable" not in url,
        brandMentioned="missing-brand" not in url,
        disclosurePresent="missing-disclosure" not in url,
        prohibitedClaimsFound=prohibited_claims_found,
    ).model_dump(by_alias=True, mode="json")


def _append_event(
    repository: KnotRepository,
    *,
    promotion_id: str,
    event_type: str,
    data: dict[str, object],
) -> None:
    event_id = f"event-{uuid4()}"
    created_at = _now()
    event = {
        "eventId": event_id,
        "promotionId": promotion_id,
        "type": event_type,
        "data": data,
        "createdAt": created_at,
    }
    repository.save_raw_document(FirestorePaths.promotion_event(promotion_id, event_id), event)
    repository.create_audit_event(
        event_id,
        {
            **event,
            "source": "knot-api",
            "promotionEventPath": FirestorePaths.promotion_event(promotion_id, event_id),
        },
    )


def _candidate_explanation(candidate: dict[str, object]) -> str:
    if candidate["eligible"]:
        return "Category, rate, schedule, deliverable and usage rights fit the Promotion."
    hard_filter_reasons = cast(Sequence[object], candidate["hardFilterReasons"])
    reasons = ", ".join(str(reason) for reason in hard_filter_reasons)
    return f"Excluded by deterministic hard filters: {reasons}."


def _ok(data: dict[str, object]) -> dict[str, object]:
    return {
        "data": data,
        "meta": {
            "requestId": str(uuid4()),
            "timestamp": _now(),
            "schemaVersion": "v1",
        },
    }


def _now() -> str:
    return _now_datetime().isoformat().replace("+00:00", "Z")


def _now_datetime() -> datetime:
    return datetime.now(UTC)


def _policy_today(promotion: Promotion) -> date:
    if promotion.created_at is not None:
        return promotion.created_at.date()
    return date(2026, 7, 24)


def _not_found(resource: str, resource_id: str) -> HTTPException:
    return _problem(
        status.HTTP_404_NOT_FOUND,
        "RESOURCE_NOT_FOUND",
        f"{resource} {resource_id} was not found.",
    )


def _problem(status_code: int, code: str, detail: str) -> HTTPException:
    return HTTPException(
        status_code=status_code,
        detail={
            "type": f"https://knot.example/errors/{code.lower().replace('_', '-')}",
            "title": code.replace("_", " ").title(),
            "status": status_code,
            "detail": detail,
            "code": code,
        },
    )
