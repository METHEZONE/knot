from collections.abc import Sequence
from datetime import UTC, date, datetime
from typing import cast
from uuid import uuid4

from fastapi import APIRouter, Header, HTTPException, status

from apps.api.schemas import (
    BrandOnboardingRequest,
    CreatorCriteriaRequest,
    CreatorOnboardingRequest,
    EvidenceObservations,
    EvidenceSubmissionRequest,
    EvidenceVerificationRequest,
    PromotionCreateRequest,
    UserBootstrapRequest,
)
from libs.a2a.client import CreatorA2AClient, CreatorA2AClientError, first_part_data
from libs.a2a.models import (
    A2AArtifact,
    A2AMessage,
    A2APart,
    A2ARole,
    A2ATask,
    NegotiationMessageType,
    NegotiationPayload,
)
from libs.a2a.store import InMemoryA2ATaskStore
from libs.agents.brand import build_initial_terms
from libs.agents.matching import MATCHING_WEIGHTS_VERSION, rank_creators
from libs.agents.negotiation import CreatorNegotiationContext
from libs.ai.gemini import AnalysisText, candidate_explanation, creator_rationale
from libs.domain.hashing import (
    canonical_json,
    canonical_terms_json,
    sha256_prefixed,
    terms_hash,
)
from libs.domain.models import AgreementTerms, CreatorProfile, Promotion, RateCard, UsageRights
from libs.payments.settlement import (
    PLATFORM_FEE_BPS,
    lock_amount_base_units,
    milestone_amounts_base_units,
)
from libs.policies.brand import validate_brand_terms
from libs.policies.evidence import validate_evidence_observations
from libs.repositories.firestore_paths import COLLECTIONS, FirestorePaths
from libs.repositories.serialization import model_to_document
from libs.repositories.store import IdempotencyConflictError, KnotRepository
from libs.settings.config import Settings, get_settings
from libs.web3.client import Web3GatewayClient, Web3GatewayError, receipt_from_gateway


def build_api_router(
    repository: KnotRepository,
    settings: Settings | None = None,
) -> APIRouter:
    settings = settings or get_settings()
    router = APIRouter(prefix="/api/v1")

    @router.get("")
    def api_root() -> dict[str, object]:
        return _ok({"service": "knot-api"})

    @router.post("/users:bootstrap", status_code=status.HTTP_201_CREATED)
    def bootstrap_user(payload: UserBootstrapRequest) -> dict[str, object]:
        now = _now()
        existing_path, existing_user = _find_user_by_email(repository, payload.email)
        if existing_user is None:
            user_id = f"user-{uuid4()}"
            user: dict[str, object] = {
                "userId": user_id,
                "email": payload.email,
                "displayName": payload.display_name,
                "roles": [payload.role],
                "activeRole": payload.role,
                "authProvider": "local-demo",
                "createdAt": now,
                "updatedAt": now,
                "lastLoginAt": now,
            }
            repository.save_raw_document(FirestorePaths.user(user_id), user)
        else:
            user_id = _require_document_str(existing_user, "userId")
            roles = _append_unique_str(existing_user.get("roles"), payload.role)
            user = dict(existing_user)
            user.update(
                {
                    "displayName": payload.display_name,
                    "roles": roles,
                    "activeRole": payload.role,
                    "updatedAt": now,
                    "lastLoginAt": now,
                }
            )
            repository.save_raw_document(existing_path, user)
        _append_audit(
            repository,
            action="USER_BOOTSTRAPPED",
            data={"userId": user["userId"], "role": payload.role},
        )
        return _ok({"user": user})

    @router.get("/users/{user_id}")
    def get_user(user_id: str) -> dict[str, object]:
        user = repository.get_raw_document(FirestorePaths.user(user_id))
        if user is None:
            raise _not_found("user", user_id)
        return _ok({"user": user})

    @router.post("/brands:onboard", status_code=status.HTTP_201_CREATED)
    def onboard_brand(payload: BrandOnboardingRequest) -> dict[str, object]:
        now = _now()
        brand_id = f"brand-{uuid4()}"
        brand_agent_id = f"brand-agent-{uuid4()}"
        brand = {
            "brandId": brand_id,
            "displayName": payload.brand_name,
            "websiteUrl": payload.website_url,
            "category": payload.category,
            "targetAudience": payload.target_audience,
            "restrictedClaims": payload.restricted_claims,
            "active": True,
            "createdAt": now,
            "updatedAt": now,
        }
        agent = {
            "agentId": brand_agent_id,
            "agentType": "BRAND",
            "ownerId": brand_id,
            "ownerType": "BRAND",
            "displayName": f"{payload.brand_name} Agent",
            "service": "knot-api",
            "active": True,
            "createdAt": now,
            "updatedAt": now,
        }
        repository.save_raw_document(FirestorePaths.brand(brand_id), brand)
        repository.save_raw_document(FirestorePaths.agent(brand_agent_id), agent)
        if payload.user_id:
            _attach_role_context(
                repository,
                payload.user_id,
                role="brand",
                entity_id=brand_id,
                agent_id=brand_agent_id,
            )
        _append_audit(
            repository,
            action="BRAND_ONBOARDED",
            data={"brandId": brand_id, "brandAgentId": brand_agent_id, "userId": payload.user_id},
        )
        return _ok(
            {"brand": brand, "agent": agent, "session": _role_session("brand", brand, agent)}
        )

    @router.post("/creators:onboard", status_code=status.HTTP_201_CREATED)
    def onboard_creator(payload: CreatorOnboardingRequest) -> dict[str, object]:
        now = _now()
        creator_id = f"creator-{uuid4()}"
        creator_agent_id = f"creator-agent-{uuid4()}"
        creator = CreatorProfile(
            creatorId=creator_id,
            creatorAgentId=creator_agent_id,
            displayName=payload.creator_name,
            categories=[payload.primary_category],
            prohibitedIndustries=[],
            supportedDeliverableFormats=["reel", "story"],
            allowedUsageRights=[UsageRights.ORGANIC_ONLY, UsageRights.PAID_BOOST_30D],
            minDaysToPost=5,
            availableFrom=date.today(),
            monthlyCapacity=4,
            activeDeliverablesThisMonth=0,
            completedDealCount=0,
            rateCard=RateCard(minBaseUsdc=300, maxBaseUsdc=800),
            active=True,
        )
        policy = {
            "agentId": creator_agent_id,
            "policyVersion": 1,
            "agentType": "CREATOR",
            "creator": {
                "minBaseUsdc": 300,
                "blockedIndustries": [],
                "maxDeliverablesPerMonth": 4,
                "minDaysToPost": 5,
                "allowedUsageRights": ["organicOnly", "paidBoost30d"],
                "maxRevisionRounds": 1,
                "maxExclusivityDays": 0,
            },
            "active": True,
            "createdAt": now,
        }
        agent = {
            "agentId": creator_agent_id,
            "agentType": "CREATOR",
            "ownerId": creator_id,
            "ownerType": "CREATOR",
            "displayName": f"{payload.creator_name} Agent",
            "service": "knot-creator-agent",
            "a2aEndpoint": "/a2a/v1",
            "active": True,
            "createdAt": now,
            "updatedAt": now,
        }
        repository.save_creator_profile(creator)
        repository.save_raw_document(FirestorePaths.agent_policy(creator_agent_id), policy)
        repository.save_raw_document(FirestorePaths.agent(creator_agent_id), agent)
        if payload.user_id:
            _attach_role_context(
                repository,
                payload.user_id,
                role="creator",
                entity_id=creator_id,
                agent_id=creator_agent_id,
            )
        creator_doc = model_to_document(creator)
        _append_audit(
            repository,
            action="CREATOR_ONBOARDED",
            data={
                "creatorId": creator_id,
                "creatorAgentId": creator_agent_id,
                "userId": payload.user_id,
                "snsUrl": payload.sns_url,
            },
        )
        return _ok(
            {
                "creator": {**creator_doc, "snsUrl": payload.sns_url},
                "agent": agent,
                "policy": policy,
                "session": _role_session("creator", creator_doc, agent),
            }
        )

    @router.post("/creators/{creator_id}/criteria")
    def update_creator_criteria(
        creator_id: str,
        payload: CreatorCriteriaRequest,
    ) -> dict[str, object]:
        creator = repository.get_creator_profile(creator_id)
        if creator is None:
            raise _not_found("creator", creator_id)
        usage_rights = [UsageRights.ORGANIC_ONLY]
        if payload.usage_rights not in usage_rights:
            usage_rights.append(payload.usage_rights)
        updated_creator = creator.model_copy(
            update={
                "prohibited_industries": payload.blocked_domains,
                "supported_deliverable_formats": _preferred_formats(payload.preferred_content),
                "allowed_usage_rights": usage_rights,
                "rate_card": RateCard(
                    minBaseUsdc=payload.minimum_usdc,
                    maxBaseUsdc=max(payload.minimum_usdc, creator.rate_card.max_base_usdc),
                ),
            }
        )
        repository.save_creator_profile(updated_creator)
        policy = {
            "agentId": creator.creator_agent_id,
            "policyVersion": 1,
            "agentType": "CREATOR",
            "creator": {
                "minBaseUsdc": payload.minimum_usdc,
                "blockedIndustries": payload.blocked_domains,
                "maxDeliverablesPerMonth": creator.monthly_capacity,
                "minDaysToPost": creator.min_days_to_post,
                "allowedUsageRights": [right.value for right in usage_rights],
                "maxRevisionRounds": 1,
                "maxExclusivityDays": 0,
            },
            "notes": payload.notes,
            "preferredContent": payload.preferred_content,
            "active": True,
            "createdAt": _now(),
        }
        repository.save_raw_document(FirestorePaths.agent_policy(creator.creator_agent_id), policy)
        _append_audit(
            repository,
            action="CREATOR_CRITERIA_UPDATED",
            data={"creatorId": creator_id, "creatorAgentId": creator.creator_agent_id},
        )
        return _ok({"creator": model_to_document(updated_creator), "policy": policy})

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
        _append_promotion_event(
            repository,
            promotion_id=promotion.promotion_id,
            event_type="PROMOTION_CREATED",
            data={"status": promotion.status},
        )
        return _ok({"promotion": model_to_document(promotion)})

    @router.get("/promotions")
    def list_promotions() -> dict[str, object]:
        promotions = sorted(
            repository.list_promotions(),
            key=lambda item: item.created_at or datetime.min.replace(tzinfo=UTC),
            reverse=True,
        )
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
        _append_promotion_event(
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
            explanation = _candidate_explanation(
                settings=settings,
                promotion=promotion,
                creator=creator,
                candidate=document,
            )
            document["explanation"] = explanation.text
            document["analysisProvider"] = explanation.provider
            document["analysisModel"] = explanation.model
            document["analysisFallbackReason"] = explanation.fallback_reason
            document["negotiationId"] = None
            repository.save_raw_document(
                FirestorePaths.match_candidate(match_run_id, creator.creator_id),
                document,
            )
        _append_promotion_event(
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
        creator_agent_id = match_run.get("selectedCreatorAgentId")
        match_candidate_id = match_run.get("selectedCreatorId")
        if not isinstance(creator_agent_id, str) or not isinstance(match_candidate_id, str):
            raise _problem(
                status.HTTP_409_CONFLICT,
                "NO_ELIGIBLE_CREATOR",
                "MatchRun has no eligible creator candidate. Adjust Promotion category, "
                "deliverable, usage rights, budget, or schedule and run matching again.",
            )
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
        offer_message = A2AMessage(
            messageId=offer_message_id,
            contextId=context_id,
            role=A2ARole.USER,
            parts=[
                A2APart(
                    mediaType="application/json",
                    data=payload.model_dump(by_alias=True, mode="json"),
                )
            ],
        )
        try:
            a2a_task = _send_creator_a2a_task(
                settings=settings,
                creator_agent_id=creator_agent_id,
                message=offer_message,
                context=CreatorNegotiationContext(
                    creatorAgentId=creator_agent_id,
                    policy=agent_policy.creator,
                    today=_policy_today(promotion),
                    currentMonthDeliverables=creator.active_deliverables_this_month,
                    maxRounds=promotion.autonomy.max_negotiation_rounds,
                ),
            )
        except CreatorA2AClientError as exc:
            raise _problem(
                status.HTTP_502_BAD_GATEWAY,
                "A2A_CREATOR_AGENT_UNAVAILABLE",
                f"Creator A2A negotiation failed: {exc}",
            ) from exc

        task_id = a2a_task.id
        response_message = a2a_task.status.message
        try:
            creator_decision_document = first_part_data(response_message)
        except CreatorA2AClientError as exc:
            raise _problem(
                status.HTTP_409_CONFLICT,
                "INVALID_STATE_TRANSITION",
                f"Creator A2A response is invalid: {exc}",
            ) from exc
        decision_type = _decision_type_from_document(creator_decision_document)
        response_message_id = (
            response_message.message_id if response_message else f"message-{uuid4()}"
        )
        negotiation_status = _negotiation_status(decision_type)
        response_terms = creator_decision_document.get("terms")
        current_terms = (
            response_terms
            if isinstance(response_terms, dict)
            else payload.terms.model_dump(by_alias=True, mode="json")
        )
        artifact = a2a_task.artifacts[0] if a2a_task.artifacts else None
        artifact_id = artifact.artifact_id if artifact else f"artifact-{uuid4()}"
        if decision_type == NegotiationMessageType.ACCEPT and artifact is None:
            raise _problem(
                status.HTTP_409_CONFLICT,
                "INVALID_STATE_TRANSITION",
                "Accepted A2A negotiation is missing an Agreement Artifact.",
            )
        agreement_source = (
            {**_artifact_part_data(artifact), "type": decision_type.value}
            if artifact is not None
            else creator_decision_document
        )
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
            "currentTerms": current_terms,
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
                **a2a_task.model_dump(by_alias=True, mode="json"),
                "taskId": task_id,
                "contextId": context_id,
                "negotiationId": negotiation_id,
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
                "a2aMessage": offer_message.model_dump(by_alias=True, mode="json"),
                "createdAt": now,
            },
        )
        if response_message is not None:
            repository.save_raw_document(
                FirestorePaths.negotiation_message(negotiation_id, response_message_id),
                {
                    "messageId": response_message_id,
                    "contextId": context_id,
                    "taskId": task_id,
                    "role": "ROLE_AGENT",
                    "sequence": 2,
                    "payload": creator_decision_document,
                    "a2aMessage": response_message.model_dump(by_alias=True, mode="json"),
                    "createdAt": now,
                },
            )
        repository.save_raw_document(
            FirestorePaths.negotiation_decision(negotiation_id, decision_id),
            {
                "decisionId": decision_id,
                "messageId": response_message_id,
                "type": decision_type.value,
                "policyDecision": creator_decision_document.get("policyDecision"),
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
            decision=agreement_source,
            artifact_id=artifact_id,
            task_id=task_id,
            created_at=now,
        )
        if artifact is not None:
            repository.save_raw_document(
                FirestorePaths.a2a_task_artifact(task_id, artifact.artifact_id),
                _a2a_artifact_document(
                    artifact=artifact,
                    task_id=task_id,
                    negotiation_id=negotiation_id,
                    created_at=now,
                ),
            )
        if agreement is not None:
            repository.save_raw_document(
                FirestorePaths.agreement(str(agreement["agreementId"])),
                agreement,
            )
            _write_agreement_milestones(repository, agreement)
        _append_promotion_event(
            repository,
            promotion_id=promotion_id,
            event_type="NEGOTIATION_STARTED",
            data={
                "matchRunId": match_run_id,
                "negotiationId": negotiation_id,
                "status": negotiation_status,
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

    @router.get("/negotiations/{negotiation_id}/agreement")
    def get_negotiation_agreement(negotiation_id: str) -> dict[str, object]:
        _require_negotiation(repository, negotiation_id)
        agreement = _find_agreement_by_negotiation(repository, negotiation_id)
        if agreement is None:
            raise _not_found("agreement", negotiation_id)
        return _ok({"agreement": agreement})

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
        return _ok({"negotiation": negotiation})

    @router.get("/agreements/{agreement_id}")
    def get_agreement(agreement_id: str) -> dict[str, object]:
        agreement = repository.get_raw_document(FirestorePaths.agreement(agreement_id))
        if agreement is None:
            raise _not_found("agreement", agreement_id)
        return _ok({"agreement": agreement})

    @router.get("/agreements/{agreement_id}/escrow")
    def get_agreement_escrow(agreement_id: str) -> dict[str, object]:
        _get_agreement_document(repository, agreement_id)
        escrow = _find_escrow_by_agreement(repository, agreement_id)
        settlements: list[dict[str, object]] = []
        if escrow is not None:
            settlements = [
                document
                for document in repository.list_raw_documents(COLLECTIONS.settlements)
                if document.get("escrowId") == escrow.get("escrowId")
            ]
            settlements.sort(key=lambda item: str(item.get("createdAt", "")))
        return _ok({"escrow": escrow, "settlements": settlements})

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
        _append_promotion_event(
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
        _append_promotion_event(
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

    @router.post("/agreements/{agreement_id}/escrow:lock")
    def lock_escrow(
        agreement_id: str,
        idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    ) -> dict[str, object]:
        key = _require_idempotency_key(idempotency_key)
        agreement = _get_agreement_document(repository, agreement_id)
        promotion = _get_promotion(repository, _require_document_str(agreement, "promotionId"))
        if not promotion.autonomy.auto_escrow:
            raise _problem(
                status.HTTP_409_CONFLICT,
                "POLICY_VIOLATION",
                "Auto-escrow is disabled for this Promotion; human approval is required.",
            )
        terms = AgreementTerms.model_validate(agreement["terms"])
        if terms_hash(terms) != agreement.get("termsHash"):
            raise _problem(
                status.HTTP_409_CONFLICT,
                "POLICY_VIOLATION",
                "Recomputed terms hash does not match the Agreement.",
            )
        locked_amount = lock_amount_base_units(terms)
        if locked_amount <= 0:
            raise _problem(
                status.HTTP_409_CONFLICT,
                "POLICY_VIOLATION",
                "Escrow lock amount must be positive.",
            )

        existing = _find_escrow_by_agreement(repository, agreement_id)
        if existing is not None:
            if existing.get("idempotencyKey") == key:
                return _ok(
                    {
                        "escrow": existing,
                        "receipt": _receipt_by_id(repository, existing.get("lockReceiptId")),
                    }
                )
            raise _problem(
                status.HTTP_409_CONFLICT,
                "ESCROW_ALREADY_LOCKED",
                f"Agreement {agreement_id} already has an escrow.",
            )

        _claim_idempotency(
            repository,
            key,
            payload={
                "op": "ESCROW_LOCK",
                "agreementId": agreement_id,
                "amount": locked_amount,
                "programId": settings.escrow_program_id,
                "mint": settings.usdc_mint,
            },
            owner_path=f"lock:{agreement_id}",
        )

        now = _now()
        escrow_id = f"escrow-{uuid4()}"
        receipt_id = f"receipt-{uuid4()}"
        operation_id = f"op-{uuid4()}"
        milestone_amounts = milestone_amounts_base_units(locked_amount, terms.milestones)
        gateway_receipt = _lock_with_web3_gateway(
            settings=settings,
            idempotency_key=key,
            agreement=agreement,
            escrow_id=escrow_id,
            locked_amount=locked_amount,
        )
        escrow = {
            "escrowId": escrow_id,
            "agreementId": agreement_id,
            "promotionId": agreement["promotionId"],
            "brandAgentId": agreement["brandAgentId"],
            "creatorAgentId": agreement["creatorAgentId"],
            "network": settings.escrow_network,
            "programId": settings.escrow_program_id,
            "mint": settings.usdc_mint,
            "escrowPda": None,
            "lockedAmountBaseUnits": str(locked_amount),
            "releasedAmountBaseUnits": "0",
            "platformFeeBps": PLATFORM_FEE_BPS,
            "termsHash": agreement["termsHash"],
            "milestoneAmounts": {mid: str(amount) for mid, amount in milestone_amounts.items()},
            "status": "LOCKED",
            "lockSignature": gateway_receipt.get("signature") if gateway_receipt else None,
            "lockReceiptId": receipt_id,
            "paymentOperationId": operation_id,
            "idempotencyKey": key,
            "createdAt": now,
            "updatedAt": now,
        }
        repository.save_raw_document(FirestorePaths.escrow(escrow_id), escrow)
        receipt = _record_operation(
            repository,
            operation_type="ESCROW_LOCK",
            operation_id=operation_id,
            receipt_id=receipt_id,
            escrow_id=escrow_id,
            agreement_id=agreement_id,
            idempotency_key=key,
            now=now,
            network=settings.escrow_network,
            receipt=(
                receipt_from_gateway(
                    receipt_id=receipt_id,
                    operation_id=operation_id,
                    gateway_receipt=gateway_receipt,
                    created_at=now,
                )
                if gateway_receipt
                else None
            ),
        )
        _append_promotion_event(
            repository,
            promotion_id=str(agreement["promotionId"]),
            event_type="ESCROW_LOCKED",
            data={
                "agreementId": agreement_id,
                "escrowId": escrow_id,
                "lockedAmountBaseUnits": str(locked_amount),
                "receiptStatus": receipt["status"],
            },
        )
        _append_audit(
            repository,
            action="ESCROW_LOCK",
            data={"escrowId": escrow_id, "agreementId": agreement_id, "operationId": operation_id},
        )
        return _ok({"escrow": escrow, "receipt": receipt})

    @router.get("/escrows/{escrow_id}")
    def get_escrow(escrow_id: str) -> dict[str, object]:
        escrow = repository.get_raw_document(FirestorePaths.escrow(escrow_id))
        if escrow is None:
            raise _not_found("escrow", escrow_id)
        return _ok({"escrow": escrow})

    @router.post("/escrows/{escrow_id}/milestones/{milestone_id}:release")
    def release_milestone(
        escrow_id: str,
        milestone_id: str,
        idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    ) -> dict[str, object]:
        key = _require_idempotency_key(idempotency_key)
        escrow = repository.get_raw_document(FirestorePaths.escrow(escrow_id))
        if escrow is None:
            raise _not_found("escrow", escrow_id)
        if escrow.get("status") != "LOCKED":
            raise _problem(
                status.HTTP_409_CONFLICT,
                "INVALID_STATE_TRANSITION",
                "Escrow is not in a releasable state.",
            )
        agreement_id = _require_document_str(escrow, "agreementId")
        promotion = _get_promotion(repository, _require_document_str(escrow, "promotionId"))
        if not promotion.autonomy.auto_release:
            raise _problem(
                status.HTTP_409_CONFLICT,
                "POLICY_VIOLATION",
                "Auto-release is disabled for this Promotion; human approval is required.",
            )
        milestone = _get_milestone_document(repository, agreement_id, milestone_id)

        existing_settlement = _find_settlement(repository, escrow_id, milestone_id)
        if existing_settlement is not None:
            if existing_settlement.get("idempotencyKey") == key:
                return _ok(
                    {
                        "settlement": existing_settlement,
                        "escrow": escrow,
                        "receipt": _receipt_by_id(repository, existing_settlement.get("receiptId")),
                    }
                )
            raise _problem(
                status.HTTP_409_CONFLICT,
                "MILESTONE_ALREADY_RELEASED",
                f"Milestone {milestone_id} was already released.",
            )

        if not _milestone_evidence_passed(repository, agreement_id, milestone_id):
            raise _problem(
                status.HTTP_409_CONFLICT,
                "POLICY_VIOLATION",
                "Milestone evidence has not passed verification.",
            )

        # The milestone→amount split was computed and stored on the escrow at lock time.
        locked = int(str(escrow["lockedAmountBaseUnits"]))
        milestone_amounts = escrow.get("milestoneAmounts")
        if not isinstance(milestone_amounts, dict) or milestone_id not in milestone_amounts:
            raise _not_found("milestone", milestone_id)
        amount = int(str(milestone_amounts[milestone_id]))
        released = int(str(escrow.get("releasedAmountBaseUnits", "0")))
        if released + amount > locked:
            raise _problem(
                status.HTTP_409_CONFLICT,
                "POLICY_VIOLATION",
                "Release amount exceeds the locked balance.",
            )

        _claim_idempotency(
            repository,
            key,
            payload={
                "op": "MILESTONE_RELEASE",
                "escrowId": escrow_id,
                "milestoneId": milestone_id,
                "amount": amount,
            },
            owner_path=f"release:{escrow_id}:{milestone_id}",
        )

        now = _now()
        settlement_id = f"settlement-{uuid4()}"
        receipt_id = f"receipt-{uuid4()}"
        operation_id = f"op-{uuid4()}"
        new_released = released + amount
        gateway_receipt = _release_with_web3_gateway(
            settings=settings,
            idempotency_key=key,
            escrow=escrow,
            agreement_id=agreement_id,
            milestone_id=milestone_id,
            amount=amount,
        )
        settlement = {
            "settlementId": settlement_id,
            "escrowId": escrow_id,
            "agreementId": agreement_id,
            "milestoneId": milestone_id,
            "amountBaseUnits": str(amount),
            "network": settings.escrow_network,
            "status": gateway_receipt.get("status") if gateway_receipt else "SIMULATED",
            "signature": gateway_receipt.get("signature") if gateway_receipt else None,
            "receiptId": receipt_id,
            "paymentOperationId": operation_id,
            "idempotencyKey": key,
            "createdAt": now,
        }
        updated_escrow = {
            **escrow,
            "releasedAmountBaseUnits": str(new_released),
            "status": "COMPLETED" if new_released >= locked else "LOCKED",
            "updatedAt": now,
        }
        updated_milestone = {
            **milestone,
            "status": "RELEASED",
            "releasedAmountBaseUnits": str(amount),
            "settlementId": settlement_id,
            "releaseReceiptId": receipt_id,
            "releasedAt": now,
            "updatedAt": now,
        }
        repository.save_raw_document(FirestorePaths.settlement(settlement_id), settlement)
        repository.save_raw_document(FirestorePaths.escrow(escrow_id), updated_escrow)
        repository.save_raw_document(
            FirestorePaths.milestone(agreement_id, milestone_id),
            updated_milestone,
        )
        receipt = _record_operation(
            repository,
            operation_type="MILESTONE_RELEASE",
            operation_id=operation_id,
            receipt_id=receipt_id,
            escrow_id=escrow_id,
            agreement_id=agreement_id,
            idempotency_key=key,
            now=now,
            network=settings.escrow_network,
            extra={"settlementId": settlement_id, "milestoneId": milestone_id},
            receipt=(
                receipt_from_gateway(
                    receipt_id=receipt_id,
                    operation_id=operation_id,
                    gateway_receipt=gateway_receipt,
                    created_at=now,
                )
                if gateway_receipt
                else None
            ),
        )
        _append_promotion_event(
            repository,
            promotion_id=str(escrow["promotionId"]),
            event_type="MILESTONE_RELEASED",
            data={
                "escrowId": escrow_id,
                "milestoneId": milestone_id,
                "amountBaseUnits": str(amount),
                "settlementId": settlement_id,
                "receiptStatus": receipt["status"],
            },
        )
        _append_audit(
            repository,
            action="MILESTONE_RELEASE",
            data={
                "escrowId": escrow_id,
                "milestoneId": milestone_id,
                "settlementId": settlement_id,
                "operationId": operation_id,
            },
        )
        return _ok({"settlement": settlement, "escrow": updated_escrow, "receipt": receipt})

    @router.get("/transaction-receipts/{receipt_id}")
    def get_transaction_receipt(receipt_id: str) -> dict[str, object]:
        receipt = repository.get_raw_document(FirestorePaths.transaction_receipt(receipt_id))
        if receipt is None:
            raise _not_found("transactionReceipt", receipt_id)
        return _ok({"receipt": receipt})

    return router


def _get_promotion(repository: KnotRepository, promotion_id: str) -> Promotion:
    promotion = repository.get_promotion(promotion_id)
    if promotion is None:
        raise _not_found("promotion", promotion_id)
    return promotion


def _find_user_by_email(
    repository: KnotRepository,
    email: str,
) -> tuple[str, dict[str, object] | None]:
    for user in repository.list_raw_documents(COLLECTIONS.users):
        if user.get("email") == email:
            return FirestorePaths.user(_require_document_str(user, "userId")), user
    return "", None


def _append_unique_str(value: object, item: str) -> list[str]:
    items = [entry for entry in value if isinstance(entry, str)] if isinstance(value, list) else []
    if item not in items:
        items.append(item)
    return items


def _attach_role_context(
    repository: KnotRepository,
    user_id: str,
    *,
    role: str,
    entity_id: str,
    agent_id: str,
) -> None:
    path = FirestorePaths.user(user_id)
    user = repository.get_raw_document(path)
    if user is None:
        return
    roles = _append_unique_str(user.get("roles"), role)
    context_field = "brandId" if role == "brand" else "creatorId"
    agent_field = "brandAgentId" if role == "brand" else "creatorAgentId"
    repository.save_raw_document(
        path,
        {
            **user,
            "roles": roles,
            "activeRole": role,
            context_field: entity_id,
            agent_field: agent_id,
            "updatedAt": _now(),
        },
    )


def _role_session(
    role: str,
    owner: dict[str, object],
    agent: dict[str, object],
) -> dict[str, object]:
    display_name = str(owner.get("displayName") or owner.get("brandName") or "KNOT workspace")
    agent_id = str(agent.get("agentId") or "")
    agent_label = str(agent.get("displayName") or agent_id)
    profile_summary = (
        f"{display_name} profile is stored in the Product API repository. "
        "Agent negotiation uses persisted policy and public profile snapshots."
    )
    return {
        "role": role,
        "userLabel": display_name,
        "organizationLabel": display_name,
        "agentId": agent_id,
        "agentLabel": agent_label,
        "profileSummary": profile_summary,
        "walletAddress": "not-connected",
    }


def _preferred_formats(preferred_content: list[str]) -> list[str]:
    lowered = " ".join(preferred_content).lower()
    formats = []
    if "reel" in lowered or "릴스" in lowered:
        formats.append("reel")
    if "story" in lowered or "스토리" in lowered:
        formats.append("story")
    if "ugc" in lowered:
        formats.append("short")
    return formats or ["reel", "story"]


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


def _send_creator_a2a_task(
    *,
    settings: Settings,
    creator_agent_id: str,
    message: A2AMessage,
    context: CreatorNegotiationContext,
) -> A2ATask:
    if settings.creator_a2a_mode == "http":
        return CreatorA2AClient(settings.creator_agent_base_url).send_message(
            tenant=creator_agent_id,
            message=message,
        )
    store = InMemoryA2ATaskStore(
        {creator_agent_id: context},
        rationale_provider=lambda ctx, payload, decision: creator_rationale(
            settings=settings,
            context=ctx,
            payload=payload,
            decision=decision,
        ),
    )
    return store.send_message(creator_agent_id, message)


def _decision_type_from_document(document: dict[str, object]) -> NegotiationMessageType:
    value = document.get("type")
    if not isinstance(value, str):
        raise _problem(
            status.HTTP_409_CONFLICT,
            "INVALID_STATE_TRANSITION",
            "Creator A2A response is missing negotiation decision type.",
        )
    try:
        return NegotiationMessageType(value)
    except ValueError as exc:
        raise _problem(
            status.HTTP_409_CONFLICT,
            "INVALID_STATE_TRANSITION",
            f"Unsupported Creator A2A decision type: {value}.",
        ) from exc


def _artifact_part_data(artifact: A2AArtifact) -> dict[str, object]:
    if not artifact.parts or artifact.parts[0].data is None:
        raise _problem(
            status.HTTP_409_CONFLICT,
            "INVALID_STATE_TRANSITION",
            "A2A Artifact is missing Part.data.",
        )
    return artifact.parts[0].data


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


def _a2a_artifact_document(
    *,
    artifact: A2AArtifact,
    task_id: str,
    negotiation_id: str,
    created_at: str,
) -> dict[str, object]:
    return {
        **artifact.model_dump(by_alias=True, mode="json"),
        "taskId": task_id,
        "negotiationId": negotiation_id,
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


def _append_promotion_event(
    repository: KnotRepository,
    *,
    promotion_id: str,
    event_type: str,
    data: dict[str, object],
) -> None:
    event_id = f"event-{uuid4()}"
    event = {
        "eventId": event_id,
        "promotionId": promotion_id,
        "type": event_type,
        "data": data,
        "createdAt": _now(),
    }
    repository.save_raw_document(FirestorePaths.promotion_event(promotion_id, event_id), event)


def _candidate_explanation(
    *,
    settings: Settings,
    promotion: Promotion,
    creator: CreatorProfile,
    candidate: dict[str, object],
) -> AnalysisText:
    if candidate["eligible"]:
        fallback = "Category, rate, schedule, deliverable and usage rights fit the Promotion."
    else:
        hard_filter_reasons = cast(Sequence[object], candidate["hardFilterReasons"])
        reasons = ", ".join(str(reason) for reason in hard_filter_reasons)
        fallback = f"Excluded by deterministic hard filters: {reasons}."
    return candidate_explanation(
        settings=settings,
        promotion=promotion,
        creator=creator,
        candidate=candidate,
        fallback=fallback,
    )


def _find_escrow_by_agreement(
    repository: KnotRepository,
    agreement_id: str,
) -> dict[str, object] | None:
    for document in repository.list_raw_documents(COLLECTIONS.escrows):
        if document.get("agreementId") == agreement_id:
            return document
    return None


def _find_agreement_by_negotiation(
    repository: KnotRepository,
    negotiation_id: str,
) -> dict[str, object] | None:
    for document in repository.list_raw_documents(COLLECTIONS.agreements):
        if document.get("negotiationId") == negotiation_id:
            return document
    return None


def _find_settlement(
    repository: KnotRepository,
    escrow_id: str,
    milestone_id: str,
) -> dict[str, object] | None:
    for document in repository.list_raw_documents(COLLECTIONS.settlements):
        if document.get("escrowId") == escrow_id and document.get("milestoneId") == milestone_id:
            return document
    return None


def _milestone_evidence_passed(
    repository: KnotRepository,
    agreement_id: str,
    milestone_id: str,
) -> bool:
    for document in repository.list_raw_documents(COLLECTIONS.evidence):
        if (
            document.get("agreementId") == agreement_id
            and document.get("milestoneId") == milestone_id
            and document.get("status") == "PASSED"
        ):
            return True
    return False


def _receipt_by_id(repository: KnotRepository, receipt_id: object) -> dict[str, object] | None:
    if not isinstance(receipt_id, str):
        return None
    return repository.get_raw_document(FirestorePaths.transaction_receipt(receipt_id))


def _lock_with_web3_gateway(
    *,
    settings: Settings,
    idempotency_key: str,
    agreement: dict[str, object],
    escrow_id: str,
    locked_amount: int,
) -> dict[str, object] | None:
    if settings.web3_mode != "gateway":
        return None
    try:
        return Web3GatewayClient(settings.web3_gateway_base_url).lock_escrow(
            idempotency_key=idempotency_key,
            payload={
                "agreementId": agreement["agreementId"],
                "escrowId": escrow_id,
                "termsHash": agreement["termsHash"],
                "expectedAmountBaseUnits": str(locked_amount),
                "mint": settings.usdc_mint,
                "programId": settings.escrow_program_id,
                "network": settings.escrow_network,
                "brandAuthority": agreement["brandAgentId"],
                "creatorDestination": agreement["creatorAgentId"],
            },
        )
    except Web3GatewayError as exc:
        raise _problem(
            status.HTTP_502_BAD_GATEWAY,
            "WEB3_GATEWAY_UNAVAILABLE",
            f"Web3 gateway lock failed: {exc}",
        ) from exc


def _release_with_web3_gateway(
    *,
    settings: Settings,
    idempotency_key: str,
    escrow: dict[str, object],
    agreement_id: str,
    milestone_id: str,
    amount: int,
) -> dict[str, object] | None:
    if settings.web3_mode != "gateway":
        return None
    try:
        return Web3GatewayClient(settings.web3_gateway_base_url).release_milestone(
            escrow_id=_require_document_str(escrow, "escrowId"),
            milestone_id=milestone_id,
            idempotency_key=idempotency_key,
            payload={
                "agreementId": agreement_id,
                "escrowId": escrow["escrowId"],
                "milestoneId": milestone_id,
                "termsHash": escrow["termsHash"],
                "expectedAmountBaseUnits": str(amount),
                "mint": settings.usdc_mint,
                "programId": settings.escrow_program_id,
                "network": settings.escrow_network,
                "creatorDestination": escrow["creatorAgentId"],
            },
        )
    except Web3GatewayError as exc:
        raise _problem(
            status.HTTP_502_BAD_GATEWAY,
            "WEB3_GATEWAY_UNAVAILABLE",
            f"Web3 gateway release failed: {exc}",
        ) from exc


def _simulated_receipt(
    receipt_id: str,
    operation_id: str,
    network: str,
    created_at: str,
) -> dict[str, object]:
    return {
        "receiptId": receipt_id,
        "paymentOperationId": operation_id,
        "network": network,
        "signature": None,
        "explorerUrl": None,
        "status": "SIMULATED",
        "detail": "On-chain signing is not wired yet; see docs/INTEGRATION_PLAN.md.",
        "createdAt": created_at,
    }


def _payload_hash(payload: dict[str, object]) -> str:
    return sha256_prefixed(canonical_json(payload))


def _append_audit(
    repository: KnotRepository,
    *,
    action: str,
    data: dict[str, object],
) -> None:
    event_id = f"audit-{uuid4()}"
    repository.create_audit_event(
        event_id,
        {"eventId": event_id, "action": action, "data": data, "createdAt": _now()},
    )


def _require_idempotency_key(idempotency_key: str | None) -> str:
    if not idempotency_key:
        raise _problem(
            status.HTTP_400_BAD_REQUEST,
            "VALIDATION_ERROR",
            "Idempotency-Key header is required.",
        )
    return idempotency_key


def _claim_idempotency(
    repository: KnotRepository,
    idempotency_key: str,
    *,
    payload: dict[str, object],
    owner_path: str,
) -> None:
    try:
        repository.claim_idempotency_record(
            idempotency_key,
            payload_hash=_payload_hash(payload),
            owner_path=owner_path,
        )
    except IdempotencyConflictError as error:
        raise _problem(
            status.HTTP_409_CONFLICT,
            "IDEMPOTENCY_CONFLICT",
            "Idempotency-Key was already used for a different request.",
        ) from error


def _record_operation(
    repository: KnotRepository,
    *,
    operation_type: str,
    operation_id: str,
    receipt_id: str,
    escrow_id: str,
    agreement_id: str,
    idempotency_key: str,
    now: str,
    network: str,
    extra: dict[str, object] | None = None,
    receipt: dict[str, object] | None = None,
) -> dict[str, object]:
    """Persist the transaction receipt and PaymentOperation for a settlement action."""
    receipt = receipt or _simulated_receipt(receipt_id, operation_id, network, now)
    operation = {
        "operationId": operation_id,
        "operationType": operation_type,
        "escrowId": escrow_id,
        "agreementId": agreement_id,
        "idempotencyKey": idempotency_key,
        "idempotencyRecordPath": FirestorePaths.idempotency_record(idempotency_key),
        "receiptId": receipt_id,
        "status": receipt["status"],
        "createdAt": now,
        **(extra or {}),
    }
    repository.save_raw_document(FirestorePaths.transaction_receipt(receipt_id), receipt)
    repository.save_raw_document(FirestorePaths.payment_operation(operation_id), operation)
    return receipt


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
