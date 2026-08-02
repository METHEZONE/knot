import ipaddress
import json
from collections.abc import Sequence
from datetime import UTC, date, datetime
from subprocess import TimeoutExpired
from typing import cast
from urllib.parse import urlparse
from uuid import NAMESPACE_URL, uuid4, uuid5

from fastapi import APIRouter, Header, HTTPException, status

from apps.api.schemas import (
    AnalysisConfirmRequest,
    BrandOnboardingRequest,
    BrandPromotionCreateRequest,
    BrandSourceAnalysisRequest,
    CreatorCriteriaRequest,
    CreatorOnboardingRequest,
    CreatorProfileAnalysisRequest,
    CurrentUserBrandProfileRequest,
    CurrentUserCreatorProfileRequest,
    CurrentUserRoleRequest,
    CurrentUserWalletRequest,
    EvidenceObservations,
    EvidenceSubmissionRequest,
    EvidenceVerificationRequest,
    OnboardingPatchRequest,
    ProductAnalysisRequest,
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
from libs.a2a.registry import creator_agent_registry_entry
from libs.a2a.store import InMemoryA2ATaskStore
from libs.agents.brand import build_initial_terms
from libs.agents.discovery import (
    DETAIL_READ_LIMIT,
    DISCOVERY_LIMIT,
    DISCOVERY_RANKING_VERSION,
    FirestoreCreatorDiscoveryRepository,
    RankedDiscoveryCandidate,
    detail_candidates,
    rank_discovery_candidates,
)
from libs.agents.matching import MATCHING_WEIGHTS_VERSION, hard_filter_creator
from libs.agents.negotiation import CreatorNegotiationContext
from libs.ai.gemini import AnalysisText, candidate_explanation, creator_rationale
from libs.auth.firebase import AuthenticatedUser, AuthError, FirebaseTokenVerifier
from libs.domain.discovery import (
    build_creator_discovery_projection,
    non_negative_int,
    positive_int,
)
from libs.domain.hashing import (
    canonical_json,
    canonical_terms_json,
    sha256_prefixed,
    terms_hash,
)
from libs.domain.models import AgreementTerms, CreatorProfile, Promotion, RateCard, UsageRights
from libs.payments.paysh import PayCliNotFound
from libs.payments.paysh import fetch as fetch_paysh
from libs.payments.settlement import (
    PLATFORM_FEE_BPS,
    lock_amount_base_units,
    milestone_amounts_base_units,
)
from libs.policies.brand import validate_brand_terms
from libs.policies.evidence import validate_evidence_observations
from libs.repositories.firestore_paths import COLLECTIONS, FirestorePaths
from libs.repositories.serialization import model_to_document
from libs.repositories.store import DocumentQueryFilter, IdempotencyConflictError, KnotRepository
from libs.settings.config import Settings, get_settings
from libs.web3.client import Web3GatewayClient, Web3GatewayError, receipt_from_gateway


def build_api_router(
    repository: KnotRepository,
    settings: Settings | None = None,
) -> APIRouter:
    settings = settings or get_settings()
    router = APIRouter(prefix="/api/v1")
    token_verifier = FirebaseTokenVerifier(settings)

    @router.get("")
    def api_root() -> dict[str, object]:
        return _ok({"service": "knot-api"})

    @router.get("/me")
    def get_me(
        authorization: str | None = Header(default=None, alias="Authorization"),
    ) -> dict[str, object]:
        auth_user = _require_auth_user(token_verifier, authorization)
        user = _bootstrap_authenticated_user(repository, auth_user)
        return _ok(_current_user_payload(repository, user))

    @router.get("/onboarding")
    def get_onboarding(
        authorization: str | None = Header(default=None, alias="Authorization"),
    ) -> dict[str, object]:
        auth_user = _require_auth_user(token_verifier, authorization)
        user = _bootstrap_authenticated_user(repository, auth_user)
        session = _onboarding_session(repository, auth_user.uid, user)
        return _ok({"onboarding": session})

    @router.patch("/onboarding")
    def patch_onboarding(
        payload: OnboardingPatchRequest,
        authorization: str | None = Header(default=None, alias="Authorization"),
    ) -> dict[str, object]:
        auth_user = _require_auth_user(token_verifier, authorization)
        user = _bootstrap_authenticated_user(repository, auth_user)
        if user.get("role") not in {None, payload.role}:
            raise _problem(
                status.HTTP_403_FORBIDDEN,
                "FORBIDDEN",
                "Onboarding role does not match the authenticated account.",
            )
        now = _now()
        existing = _onboarding_session(repository, auth_user.uid, user)
        session = {
            **existing,
            **payload.model_dump(by_alias=True, mode="json"),
            "ownerUid": auth_user.uid,
            "draftVersion": _next_draft_version(existing),
            "updatedAt": now,
        }
        repository.save_raw_document(FirestorePaths.onboarding_session(auth_user.uid), session)
        return _ok({"onboarding": session})

    @router.post("/analyses/product", status_code=status.HTTP_202_ACCEPTED)
    def analyze_product(
        payload: ProductAnalysisRequest,
        authorization: str | None = Header(default=None, alias="Authorization"),
        idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    ) -> dict[str, object]:
        auth_user = _require_auth_user(token_verifier, authorization)
        user = _require_role(repository, auth_user, "BRAND")
        return _ok(
            {
                "analysis": _create_analysis_job(
                    repository=repository,
                    settings=settings,
                    owner_uid=auth_user.uid,
                    role="BRAND",
                    analysis_type="PRODUCT",
                    source_url=payload.source_url,
                    idempotency_key=idempotency_key,
                    user=user,
                )
            }
        )

    @router.post("/onboarding/brand/analyze-source", status_code=status.HTTP_202_ACCEPTED)
    def analyze_brand_source(
        payload: BrandSourceAnalysisRequest,
        authorization: str | None = Header(default=None, alias="Authorization"),
        idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    ) -> dict[str, object]:
        try:
            source_url = payload.source_url()
        except ValueError as exc:
            raise _problem(status.HTTP_400_BAD_REQUEST, "VALIDATION_ERROR", str(exc)) from exc
        auth_user = _require_auth_user(token_verifier, authorization)
        user = _require_role(repository, auth_user, "BRAND")
        analysis = _create_analysis_job(
            repository=repository,
            settings=settings,
            owner_uid=auth_user.uid,
            role="BRAND",
            analysis_type="PRODUCT",
            source_url=source_url,
            idempotency_key=idempotency_key,
            user=user,
        )
        draft = analysis.get("draft")
        return _ok(cast(dict[str, object], draft if isinstance(draft, dict) else analysis))

    @router.post("/analyses/creator-profile", status_code=status.HTTP_202_ACCEPTED)
    def analyze_creator_profile(
        payload: CreatorProfileAnalysisRequest,
        authorization: str | None = Header(default=None, alias="Authorization"),
        idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    ) -> dict[str, object]:
        auth_user = _require_auth_user(token_verifier, authorization)
        user = _require_role(repository, auth_user, "CREATOR")
        return _ok(
            {
                "analysis": _create_analysis_job(
                    repository=repository,
                    settings=settings,
                    owner_uid=auth_user.uid,
                    role="CREATOR",
                    analysis_type="CREATOR_PROFILE",
                    source_url=payload.source_url,
                    idempotency_key=idempotency_key,
                    user=user,
                )
            }
        )

    @router.get("/analyses/{analysis_id}")
    def get_analysis(
        analysis_id: str,
        authorization: str | None = Header(default=None, alias="Authorization"),
    ) -> dict[str, object]:
        auth_user = _require_auth_user(token_verifier, authorization)
        analysis = _require_owned_analysis(repository, auth_user.uid, analysis_id)
        return _ok({"analysis": analysis})

    @router.post("/analyses/{analysis_id}:confirm")
    def confirm_analysis(
        analysis_id: str,
        payload: AnalysisConfirmRequest,
        authorization: str | None = Header(default=None, alias="Authorization"),
        idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    ) -> dict[str, object]:
        auth_user = _require_auth_user(token_verifier, authorization)
        analysis = _require_owned_analysis(repository, auth_user.uid, analysis_id)
        key = _require_idempotency_key(idempotency_key)
        _claim_idempotency(
            repository,
            key,
            payload={
                "uid": auth_user.uid,
                "analysisId": analysis_id,
                **payload.model_dump(by_alias=True, mode="json"),
            },
            owner_path=FirestorePaths.analysis_job(analysis_id),
        )
        now = _now()
        confirmed = {
            **analysis,
            "status": "CONFIRMED",
            "confirmedFields": payload.confirmed_fields,
            "edits": payload.edits,
            "confirmedAt": now,
            "updatedAt": now,
        }
        repository.save_raw_document(FirestorePaths.analysis_job(analysis_id), confirmed)
        session = _onboarding_session(repository, auth_user.uid, {"role": analysis.get("role")})
        completed_cards = _append_unique_str(session.get("completedCards"), "ANALYSIS")
        repository.save_raw_document(
            FirestorePaths.onboarding_session(auth_user.uid),
            {
                **session,
                "analysisJobId": analysis_id,
                "completedCards": completed_cards,
                "draftVersion": _next_draft_version(session),
                "updatedAt": now,
            },
        )
        return _ok({"analysis": confirmed})

    @router.post("/me/role")
    def select_current_user_role(
        payload: CurrentUserRoleRequest,
        authorization: str | None = Header(default=None, alias="Authorization"),
        idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    ) -> dict[str, object]:
        auth_user = _require_auth_user(token_verifier, authorization)
        user = _bootstrap_authenticated_user(repository, auth_user)
        existing_role = user.get("role")
        if isinstance(existing_role, str) and existing_role:
            if existing_role != payload.role:
                raise _problem(
                    status.HTTP_409_CONFLICT,
                    "ROLE_ALREADY_SELECTED",
                    "A KNOT v1 account can only have one role.",
                )
            return _ok(_current_user_payload(repository, user))

        key = _require_idempotency_key(idempotency_key)
        _claim_idempotency(
            repository,
            key,
            payload={"uid": auth_user.uid, "role": payload.role},
            owner_path=FirestorePaths.user(auth_user.uid),
        )

        now = _now()
        role = payload.role
        agent_id = f"{role.lower()}-agent-{auth_user.uid}"
        agent = {
            "agentId": agent_id,
            "agentType": role,
            "ownerUid": auth_user.uid,
            "ownerId": None,
            "ownerType": role,
            "displayName": f"{_account_label(user)} Agent",
            "service": "knot-api" if role == "BRAND" else "knot-creator-agent",
            "status": "DRAFT",
            "active": False,
            "createdAt": now,
            "updatedAt": now,
        }
        if settings.agent_wallet_provision:
            from libs.web3.agent_wallet import provision_agent_wallet

            _wallet = provision_agent_wallet(agent_id, project_id=settings.firestore_project_id)
            agent["walletPubkey"] = _wallet.pubkey
        updated = {
            **user,
            "role": role,
            "onboardingStatus": "PROFILE_REQUIRED",
            "agentId": agent_id,
            "updatedAt": now,
        }
        repository.save_raw_document(FirestorePaths.agent(agent_id), agent)
        repository.save_raw_document(FirestorePaths.user(auth_user.uid), updated)
        _append_audit(
            repository,
            action="USER_ROLE_SELECTED",
            data={"uid": auth_user.uid, "role": role, "agentId": agent_id},
        )
        return _ok(_current_user_payload(repository, updated))

    @router.post("/me/wallet")
    def set_current_user_wallet(
        payload: CurrentUserWalletRequest,
        authorization: str | None = Header(default=None, alias="Authorization"),
    ) -> dict[str, object]:
        auth_user = _require_auth_user(token_verifier, authorization)
        user = _bootstrap_authenticated_user(repository, auth_user)
        updated = {**user, "walletAddress": payload.wallet_address, "updatedAt": _now()}
        repository.save_raw_document(FirestorePaths.user(auth_user.uid), updated)
        if updated.get("role") == "BRAND" and isinstance(updated.get("brandId"), str):
            brand_path = FirestorePaths.brand(str(updated["brandId"]))
            brand = repository.get_raw_document(brand_path)
            if brand is not None:
                repository.save_raw_document(
                    brand_path,
                    {
                        **brand,
                        "walletAddress": payload.wallet_address,
                        "updatedAt": updated["updatedAt"],
                    },
                )
        if updated.get("role") == "CREATOR" and isinstance(updated.get("creatorId"), str):
            creator_path = FirestorePaths.creator_profile(str(updated["creatorId"]))
            creator = repository.get_raw_document(creator_path)
            if creator is not None:
                repository.save_raw_document(
                    creator_path,
                    {
                        **creator,
                        "walletAddress": payload.wallet_address,
                        "updatedAt": updated["updatedAt"],
                    },
                )
        _append_audit(
            repository,
            action="USER_WALLET_SET",
            data={"uid": auth_user.uid, "walletAddress": payload.wallet_address},
        )
        result = _current_user_payload(repository, updated)
        faucet = _fund_local_wallet(settings, payload.wallet_address)
        if faucet is not None:
            result["faucet"] = faucet
        return _ok(result)

    @router.get("/me/wallet/balance")
    def get_current_user_wallet_balance(
        authorization: str | None = Header(default=None, alias="Authorization"),
    ) -> dict[str, object]:
        """연결된 지갑의 SOL/USDC 잔고. 마이페이지에서 top-up 가능 여부를 눈으로 확인하는 용도."""
        auth_user = _require_auth_user(token_verifier, authorization)
        user = _bootstrap_authenticated_user(repository, auth_user)
        address = user.get("walletAddress")
        if not isinstance(address, str) or not address:
            return _ok({"connected": False})
        try:
            balance = Web3GatewayClient(settings.web3_gateway_base_url).wallet_balance(
                address=address
            )
        except Web3GatewayError as exc:
            # 잔고는 부가 정보다 — 게이트웨이가 죽어도 화면이 깨지지 않게 사유만 싣는다.
            return _ok({"connected": True, "address": address, "error": str(exc)[:200]})
        return _ok({"connected": True, **balance})

    @router.get("/me/notifications")
    def list_current_user_notifications(
        authorization: str | None = Header(default=None, alias="Authorization"),
    ) -> dict[str, object]:
        auth_user = _require_auth_user(token_verifier, authorization)
        items = repository.list_raw_documents(
            FirestorePaths.user_notifications(auth_user.uid)
        )
        items.sort(key=lambda item: str(item.get("createdAt", "")), reverse=True)
        return _ok({"notifications": items})

    @router.post("/me/brand-profile", status_code=status.HTTP_201_CREATED)
    def create_current_brand_profile(
        payload: CurrentUserBrandProfileRequest,
        authorization: str | None = Header(default=None, alias="Authorization"),
        idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    ) -> dict[str, object]:
        auth_user = _require_auth_user(token_verifier, authorization)
        user = _require_role(repository, auth_user, "BRAND")
        existing_brand_id = user.get("brandId")
        if isinstance(existing_brand_id, str) and existing_brand_id:
            brand = repository.get_raw_document(FirestorePaths.brand(existing_brand_id))
            agent = repository.get_raw_document(FirestorePaths.agent(str(user.get("agentId"))))
            return _ok({"brand": brand, "agent": agent, **_current_user_payload(repository, user)})

        key = _require_idempotency_key(idempotency_key)
        _claim_idempotency(
            repository,
            key,
            payload=payload.model_dump(by_alias=True, mode="json") | {"uid": auth_user.uid},
            owner_path=FirestorePaths.user(auth_user.uid),
        )

        now = _now()
        brand_id = f"brand-{uuid4()}"
        agent_id = str(user.get("agentId") or f"brand-agent-{auth_user.uid}")
        brand = {
            "brandId": brand_id,
            "ownerUid": auth_user.uid,
            "name": payload.brand_name,
            "displayName": payload.brand_name,
            "websiteUrl": payload.website_url,
            "category": payload.categories[0],
            "categories": _with_custom_category(payload.categories, payload.custom_category),
            "targetAudience": payload.target_audience,
            "description": payload.description,
            "restrictedClaims": payload.restricted_claims,
            "status": "ACTIVE",
            "active": True,
            "createdAt": now,
            "updatedAt": now,
        }
        agent = {
            "agentId": agent_id,
            "agentType": "BRAND",
            "ownerUid": auth_user.uid,
            "ownerId": brand_id,
            "ownerType": "BRAND",
            "displayName": f"{payload.brand_name} Agent",
            "service": "knot-api",
            "status": "ACTIVE",
            "active": True,
            "createdAt": now,
            "updatedAt": now,
        }
        updated_user = {
            **user,
            "brandId": brand_id,
            "agentId": agent_id,
            "brandAgentId": agent_id,
            "onboardingStatus": "COMPLETED",
            "updatedAt": now,
        }
        repository.save_raw_document(FirestorePaths.brand(brand_id), brand)
        repository.save_raw_document(FirestorePaths.agent(agent_id), agent)
        repository.save_raw_document(FirestorePaths.user(auth_user.uid), updated_user)
        _append_audit(
            repository,
            action="BRAND_PROFILE_CREATED",
            data={"uid": auth_user.uid, "brandId": brand_id, "agentId": agent_id},
        )
        return _ok(
            {
                "brand": brand,
                "agent": agent,
                **_current_user_payload(repository, updated_user),
            }
        )

    @router.post("/me/creator-profile", status_code=status.HTTP_201_CREATED)
    def create_current_creator_profile(
        payload: CurrentUserCreatorProfileRequest,
        authorization: str | None = Header(default=None, alias="Authorization"),
        idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    ) -> dict[str, object]:
        auth_user = _require_auth_user(token_verifier, authorization)
        user = _require_role(repository, auth_user, "CREATOR")
        existing_creator_id = user.get("creatorId")
        if isinstance(existing_creator_id, str) and existing_creator_id:
            existing_creator = repository.get_raw_document(
                FirestorePaths.creator_profile(existing_creator_id)
            )
            agent = repository.get_raw_document(FirestorePaths.agent(str(user.get("agentId"))))
            return _ok(
                {
                    "creator": existing_creator,
                    "agent": agent,
                    **_current_user_payload(repository, user),
                }
            )

        key = _require_idempotency_key(idempotency_key)
        _claim_idempotency(
            repository,
            key,
            payload=payload.model_dump(by_alias=True, mode="json") | {"uid": auth_user.uid},
            owner_path=FirestorePaths.user(auth_user.uid),
        )

        now = _now()
        creator_id = f"creator-{uuid4()}"
        agent_id = str(user.get("agentId") or f"creator-agent-{auth_user.uid}")
        creator = CreatorProfile(
            creatorId=creator_id,
            creatorAgentId=agent_id,
            displayName=payload.creator_name,
            categories=_with_custom_category(payload.categories, payload.custom_category),
            prohibitedIndustries=payload.blocked_domains,
            supportedDeliverableFormats=_preferred_formats(payload.preferred_content),
            allowedUsageRights=[UsageRights.ORGANIC_ONLY, UsageRights.PAID_BOOST_30D],
            minDaysToPost=5,
            availableFrom=date.today(),
            monthlyCapacity=4,
            activeDeliverablesThisMonth=0,
            completedDealCount=0,
            rateCard=RateCard(
                minBaseUsdc=payload.minimum_usdc,
                maxBaseUsdc=max(payload.minimum_usdc, 800),
            ),
            active=True,
        )
        creator_doc = {
            **model_to_document(creator),
            "ownerUid": auth_user.uid,
            "socialLinks": [
                {"platform": _social_platform(payload.sns_url), "url": payload.sns_url}
            ],
            "publicRateBand": {
                "currency": "USDC",
                "minimum": payload.minimum_usdc,
                "maximum": max(payload.minimum_usdc, 800),
            },
            "walletAddress": payload.wallet_address,
            "receivingOffers": True,
            "status": "ACTIVE",
            "createdAt": now,
            "updatedAt": now,
        }
        policy = {
            "agentId": agent_id,
            "policyVersion": 1,
            "agentType": "CREATOR",
            "ownerUid": auth_user.uid,
            "creator": {
                "minBaseUsdc": payload.minimum_usdc,
                "blockedIndustries": payload.blocked_domains,
                "maxDeliverablesPerMonth": 4,
                "minDaysToPost": 5,
                "allowedUsageRights": ["organicOnly", "paidBoost30d"],
                "maxRevisionRounds": 1,
                "maxExclusivityDays": 0,
            },
            "preferredContent": payload.preferred_content,
            "active": True,
            "createdAt": now,
        }
        agent = {
            "agentId": agent_id,
            "agentType": "CREATOR",
            "ownerUid": auth_user.uid,
            "ownerId": creator_id,
            "ownerType": "CREATOR",
            "displayName": f"{payload.creator_name} Agent",
            "service": "knot-creator-agent",
            "a2aEndpoint": "/a2a/v1",
            "status": "ACTIVE",
            "publicationStatus": "DRAFT",
            "acceptingOffers": False,
            "availability": "UNAVAILABLE",
            "activeNegotiations": 0,
            "maxConcurrentNegotiations": 1,
            "activeCollaborations": 0,
            "maxActiveCollaborations": 1,
            "active": True,
            "createdAt": now,
            "updatedAt": now,
        }
        updated_user = {
            **user,
            "creatorId": creator_id,
            "agentId": agent_id,
            "creatorAgentId": agent_id,
            "onboardingStatus": "COMPLETED",
            "updatedAt": now,
        }
        repository.save_raw_document(FirestorePaths.creator_profile(creator_id), creator_doc)
        repository.save_raw_document(FirestorePaths.agent_policy(agent_id), policy)
        repository.save_raw_document(FirestorePaths.agent(agent_id), agent)
        repository.save_raw_document(FirestorePaths.user(auth_user.uid), updated_user)
        _append_audit(
            repository,
            action="CREATOR_PROFILE_CREATED",
            data={"uid": auth_user.uid, "creatorId": creator_id, "agentId": agent_id},
        )
        return _ok(
            {
                "creator": creator_doc,
                "agent": agent,
                "policy": policy,
                **_current_user_payload(repository, updated_user),
            }
        )

    @router.post("/logout/revoke")
    def revoke_logout(
        authorization: str | None = Header(default=None, alias="Authorization"),
    ) -> dict[str, object]:
        auth_user = _require_auth_user(token_verifier, authorization)
        if settings.auth_mode.lower() == "firebase":
            try:
                from firebase_admin import auth  # type: ignore[import-untyped]

                auth.revoke_refresh_tokens(auth_user.uid)
            except Exception as exc:
                raise _problem(
                    status.HTTP_502_BAD_GATEWAY,
                    "AUTH_REVOKE_FAILED",
                    f"Firebase token revocation failed: {exc}",
                ) from exc
        return _ok({"revoked": True, "uid": auth_user.uid})

    @router.get("/dev-admin/overview")
    def dev_admin_overview(
        authorization: str | None = Header(default=None, alias="Authorization"),
    ) -> dict[str, object]:
        admin = _require_dev_admin(repository, settings, token_verifier, authorization)
        return _ok(
            {
                "overview": {
                    "enabled": True,
                    "actorUid": admin.uid,
                    "counts": _admin_counts(repository),
                    "latestFailures": _latest_failures(repository),
                }
            }
        )

    @router.get("/dev-admin/users")
    def dev_admin_users(
        q: str | None = None,
        authorization: str | None = Header(default=None, alias="Authorization"),
    ) -> dict[str, object]:
        _require_dev_admin(repository, settings, token_verifier, authorization)
        users = repository.list_raw_documents(COLLECTIONS.users)
        if q:
            needle = q.lower()
            users = [
                user
                for user in users
                if needle in str(user.get("uid") or user.get("userId") or "").lower()
                or needle in str(user.get("email") or "").lower()
            ]
        users.sort(key=lambda item: str(item.get("createdAt", "")), reverse=True)
        return _ok({"users": [_admin_user_projection(user) for user in users[:50]]})

    @router.get("/dev-admin/users/{uid}")
    def dev_admin_user_detail(
        uid: str,
        authorization: str | None = Header(default=None, alias="Authorization"),
    ) -> dict[str, object]:
        _require_dev_admin(repository, settings, token_verifier, authorization)
        user = repository.get_raw_document(FirestorePaths.user(uid))
        if user is None:
            raise _not_found("user", uid)
        return _ok(
            {
                "user": _admin_user_projection(user),
                "inventory": _admin_inventory(repository, user),
            }
        )

    @router.post("/dev-admin/users/{uid}:disable")
    def dev_admin_disable_user(
        uid: str,
        authorization: str | None = Header(default=None, alias="Authorization"),
    ) -> dict[str, object]:
        admin = _require_dev_admin(repository, settings, token_verifier, authorization)
        user = _require_user_document(repository, uid)
        updated = {**user, "status": "DISABLED", "disabledAt": _now(), "updatedAt": _now()}
        repository.save_raw_document(FirestorePaths.user(uid), updated)
        _append_audit(
            repository,
            action="DEV_ADMIN_USER_DISABLED",
            data={"actorUid": admin.uid, "targetUid": uid},
        )
        return _ok({"user": _admin_user_projection(updated)})

    @router.post("/dev-admin/users/{uid}:enable")
    def dev_admin_enable_user(
        uid: str,
        authorization: str | None = Header(default=None, alias="Authorization"),
    ) -> dict[str, object]:
        admin = _require_dev_admin(repository, settings, token_verifier, authorization)
        user = _require_user_document(repository, uid)
        updated = {**user, "status": "ACTIVE", "enabledAt": _now(), "updatedAt": _now()}
        repository.save_raw_document(FirestorePaths.user(uid), updated)
        _append_audit(
            repository,
            action="DEV_ADMIN_USER_ENABLED",
            data={"actorUid": admin.uid, "targetUid": uid},
        )
        return _ok({"user": _admin_user_projection(updated)})

    @router.post("/dev-admin/users/{uid}:delete")
    def dev_admin_delete_user(
        uid: str,
        payload: dict[str, object] | None = None,
        authorization: str | None = Header(default=None, alias="Authorization"),
        idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    ) -> dict[str, object]:
        admin = _require_dev_admin(repository, settings, token_verifier, authorization)
        user = _require_user_document(repository, uid)
        confirm = bool((payload or {}).get("confirm"))
        key = _require_idempotency_key(idempotency_key) if confirm else f"dry-run:{uid}:{uuid4()}"
        job_id = f"deletion-{uuid4()}"
        inventory = _admin_inventory(repository, user)
        demo_tagged = _is_demo_document(user)
        if confirm:
            _claim_idempotency(
                repository,
                key,
                payload={"op": "DEV_ADMIN_DELETE_USER", "uid": uid},
                owner_path=f"delete:{uid}",
            )
        if confirm and not demo_tagged:
            raise _problem(
                status.HTTP_409_CONFLICT,
                "REAL_USER_DELETE_FORBIDDEN",
                "Only disposable demo-tagged users can be deleted by dev admin.",
            )
        now = _now()
        job = {
            "jobId": job_id,
            "targetUid": uid,
            "actorUid": admin.uid,
            "dryRun": not confirm,
            "status": "DRY_RUN" if not confirm else "COMPLETED",
            "idempotencyKey": key,
            "inventory": inventory,
            "retainedRecords": inventory["retainedRecords"],
            "deletedRecords": [] if not confirm else inventory["safeDeleteRecords"],
            "createdAt": now,
            "updatedAt": now,
        }
        if confirm:
            redacted = {
                **user,
                "email": None,
                "displayName": None,
                "photoUrl": None,
                "status": "DELETED",
                "deletedAt": now,
                "updatedAt": now,
                "deletionJobId": job_id,
            }
            repository.save_raw_document(FirestorePaths.user(uid), redacted)
        repository.save_raw_document(FirestorePaths.deletion_job(job_id), job)
        _append_audit(
            repository,
            action="DEV_ADMIN_USER_DELETE_DRY_RUN" if not confirm else "DEV_ADMIN_USER_DELETED",
            data={"actorUid": admin.uid, "targetUid": uid, "jobId": job_id},
        )
        return _ok({"deletionJob": job})

    @router.get("/dev-admin/deletion-jobs/{job_id}")
    def dev_admin_deletion_job(
        job_id: str,
        authorization: str | None = Header(default=None, alias="Authorization"),
    ) -> dict[str, object]:
        _require_dev_admin(repository, settings, token_verifier, authorization)
        job = repository.get_raw_document(FirestorePaths.deletion_job(job_id))
        if job is None:
            raise _not_found("deletionJob", job_id)
        return _ok({"deletionJob": job})

    @router.get("/dev-admin/commerce")
    def dev_admin_commerce(
        authorization: str | None = Header(default=None, alias="Authorization"),
    ) -> dict[str, object]:
        _require_dev_admin(repository, settings, token_verifier, authorization)
        return _ok(
            {
                "counts": {
                    name: len(repository.list_raw_documents(name))
                    for name in (
                        COLLECTIONS.promotions,
                        COLLECTIONS.match_runs,
                        COLLECTIONS.negotiations,
                        COLLECTIONS.agreements,
                        COLLECTIONS.evidence,
                    )
                }
            }
        )

    @router.get("/dev-admin/agents")
    def dev_admin_agents(
        authorization: str | None = Header(default=None, alias="Authorization"),
    ) -> dict[str, object]:
        _require_dev_admin(repository, settings, token_verifier, authorization)
        agents = repository.list_raw_documents(COLLECTIONS.agents)
        tasks = repository.list_raw_documents(COLLECTIONS.a2a_tasks)
        return _ok({"agentCount": len(agents), "a2aTaskCount": len(tasks)})

    @router.get("/dev-admin/escrows")
    def dev_admin_escrows(
        authorization: str | None = Header(default=None, alias="Authorization"),
    ) -> dict[str, object]:
        _require_dev_admin(repository, settings, token_verifier, authorization)
        return _ok(
            {
                "escrows": repository.list_raw_documents(COLLECTIONS.escrows),
                "receiptCount": len(
                    repository.list_raw_documents(COLLECTIONS.transaction_receipts)
                ),
            }
        )

    @router.get("/dev-admin/audit")
    def dev_admin_audit(
        authorization: str | None = Header(default=None, alias="Authorization"),
    ) -> dict[str, object]:
        _require_dev_admin(repository, settings, token_verifier, authorization)
        events = repository.list_raw_documents(COLLECTIONS.audit_events)
        events.sort(key=lambda item: str(item.get("createdAt", "")), reverse=True)
        return _ok({"events": events[:100]})

    @router.post("/dev-admin/demo:seed", status_code=status.HTTP_201_CREATED)
    def dev_admin_demo_seed(
        payload: dict[str, object] | None = None,
        authorization: str | None = Header(default=None, alias="Authorization"),
    ) -> dict[str, object]:
        admin = _require_dev_admin(repository, settings, token_verifier, authorization)
        seed_batch_id = str((payload or {}).get("seedBatchId") or f"seed-{uuid4()}")
        now = _now()
        uid = f"demo-user-{seed_batch_id}"
        user: dict[str, object] = {
            "uid": uid,
            "userId": uid,
            "email": f"{uid}@example.test",
            "displayName": "Disposable Demo User",
            "role": None,
            "onboardingStatus": "ROLE_REQUIRED",
            "status": "ACTIVE",
            "environment": "demo",
            "seedBatchId": seed_batch_id,
            "createdAt": now,
            "updatedAt": now,
        }
        repository.save_raw_document(FirestorePaths.user(uid), user)
        _append_audit(
            repository,
            action="DEV_ADMIN_DEMO_SEEDED",
            data={"actorUid": admin.uid, "seedBatchId": seed_batch_id},
        )
        return _ok({"seedBatchId": seed_batch_id, "users": [_admin_user_projection(user)]})

    @router.post("/dev-admin/demo:reset")
    def dev_admin_demo_reset(
        payload: dict[str, object],
        authorization: str | None = Header(default=None, alias="Authorization"),
    ) -> dict[str, object]:
        admin = _require_dev_admin(repository, settings, token_verifier, authorization)
        seed_batch_id = payload.get("seedBatchId")
        if not isinstance(seed_batch_id, str) or not seed_batch_id:
            raise _problem(
                status.HTTP_400_BAD_REQUEST,
                "VALIDATION_ERROR",
                "seedBatchId is required for scoped demo reset.",
            )
        users = [
            user
            for user in repository.list_raw_documents(COLLECTIONS.users)
            if user.get("seedBatchId") == seed_batch_id and user.get("environment") == "demo"
        ]
        now = _now()
        for user in users:
            uid = _require_document_str(user, "uid")
            repository.save_raw_document(
                FirestorePaths.user(uid),
                {
                    **user,
                    "email": None,
                    "displayName": None,
                    "status": "DELETED",
                    "deletedAt": now,
                    "updatedAt": now,
                },
            )
        job_id = f"admin-job-{uuid4()}"
        job = {
            "jobId": job_id,
            "type": "DEMO_RESET",
            "actorUid": admin.uid,
            "seedBatchId": seed_batch_id,
            "affectedUserCount": len(users),
            "status": "COMPLETED",
            "createdAt": now,
        }
        repository.save_raw_document(FirestorePaths.admin_job(job_id), job)
        _append_audit(
            repository,
            action="DEV_ADMIN_DEMO_RESET",
            data={"actorUid": admin.uid, "seedBatchId": seed_batch_id, "jobId": job_id},
        )
        return _ok({"job": job})

    @router.get("/brand/dashboard")
    def get_brand_dashboard(
        authorization: str | None = Header(default=None, alias="Authorization"),
    ) -> dict[str, object]:
        auth_user = _require_auth_user(token_verifier, authorization)
        user = _require_completed_role(repository, auth_user, "BRAND")
        return _ok({"dashboard": _brand_dashboard(repository, user)})

    @router.get("/creator/dashboard")
    def get_creator_dashboard(
        authorization: str | None = Header(default=None, alias="Authorization"),
    ) -> dict[str, object]:
        auth_user = _require_auth_user(token_verifier, authorization)
        user = _require_completed_role(repository, auth_user, "CREATOR")
        return _ok({"dashboard": _creator_dashboard(repository, user)})

    @router.get("/creator/agent")
    def get_creator_agent(
        authorization: str | None = Header(default=None, alias="Authorization"),
    ) -> dict[str, object]:
        auth_user = _require_auth_user(token_verifier, authorization)
        user = _require_completed_role(repository, auth_user, "CREATOR")
        agent, creator = _require_creator_agent_context(repository, user)
        discovery = repository.get_raw_document(
            FirestorePaths.creator_discovery_profile(creator.creator_id)
        )
        return _ok(
            {
                "agent": _creator_agent_view(agent, creator),
                "discoveryProfile": discovery,
            }
        )

    @router.post("/creator/agent:publish")
    def publish_creator_agent(
        authorization: str | None = Header(default=None, alias="Authorization"),
    ) -> dict[str, object]:
        auth_user = _require_auth_user(token_verifier, authorization)
        user = _require_completed_role(repository, auth_user, "CREATOR")
        agent, creator = _require_creator_agent_context(repository, user)
        now = _now()
        active_creator = creator.model_copy(update={"active": True})
        updated_agent = {
            **agent,
            "status": "ACTIVE",
            "publicationStatus": "PUBLISHED",
            "acceptingOffers": True,
            "availability": "AVAILABLE"
            if creator.remaining_capacity > 0
            else "AT_CAPACITY",
            "active": True,
            "updatedAt": now,
        }
        discovery = build_creator_discovery_projection(
            active_creator,
            updated_agent,
            updated_at=now,
        )
        repository.save_creator_profile(active_creator)
        repository.save_raw_document(
            FirestorePaths.agent(_require_document_str(updated_agent, "agentId")),
            updated_agent,
        )
        repository.save_raw_document(
            FirestorePaths.creator_discovery_profile(creator.creator_id),
            discovery,
        )
        repository.save_raw_document(
            FirestorePaths.agent_registry_entry(_require_document_str(updated_agent, "agentId")),
            creator_agent_registry_entry(updated_agent, updated_at=now),
        )
        _append_audit(
            repository,
            action="CREATOR_AGENT_PUBLISHED",
            data={"uid": auth_user.uid, "creatorId": creator.creator_id},
        )
        return _ok(
            {
                "agent": _creator_agent_view(updated_agent, creator),
                "discoveryProfile": discovery,
            }
        )

    @router.post("/creator/agent:pause")
    def pause_creator_agent(
        authorization: str | None = Header(default=None, alias="Authorization"),
    ) -> dict[str, object]:
        auth_user = _require_auth_user(token_verifier, authorization)
        user = _require_completed_role(repository, auth_user, "CREATOR")
        agent, creator = _require_creator_agent_context(repository, user)
        now = _now()
        updated_agent = {
            **agent,
            "publicationStatus": "PAUSED",
            "acceptingOffers": False,
            "availability": "UNAVAILABLE",
            "updatedAt": now,
        }
        discovery = build_creator_discovery_projection(
            creator,
            updated_agent,
            updated_at=now,
        )
        repository.save_raw_document(
            FirestorePaths.agent(_require_document_str(updated_agent, "agentId")),
            updated_agent,
        )
        repository.save_raw_document(
            FirestorePaths.creator_discovery_profile(creator.creator_id),
            discovery,
        )
        repository.save_raw_document(
            FirestorePaths.agent_registry_entry(_require_document_str(updated_agent, "agentId")),
            creator_agent_registry_entry(updated_agent, updated_at=now),
        )
        _append_audit(
            repository,
            action="CREATOR_AGENT_PAUSED",
            data={"uid": auth_user.uid, "creatorId": creator.creator_id},
        )
        return _ok(
            {
                "agent": _creator_agent_view(updated_agent, creator),
                "discoveryProfile": discovery,
            }
        )

    @router.post("/creator/agent:resume")
    def resume_creator_agent(
        authorization: str | None = Header(default=None, alias="Authorization"),
    ) -> dict[str, object]:
        return publish_creator_agent(authorization)

    @router.get("/brand/promotions")
    def list_brand_promotions(
        authorization: str | None = Header(default=None, alias="Authorization"),
    ) -> dict[str, object]:
        auth_user = _require_auth_user(token_verifier, authorization)
        user = _require_completed_role(repository, auth_user, "BRAND")
        brand_id = _require_document_str(user, "brandId")
        promotions = [
            _promotion_document_with_raw(repository, promotion)
            for promotion in repository.list_promotions()
            if promotion.brand_id == brand_id
            and not _promotion_is_deleted(repository, promotion.promotion_id)
        ]
        return _ok({"promotions": _sorted_recent(promotions)})

    @router.post("/brand/promotions", status_code=status.HTTP_201_CREATED)
    def create_brand_promotion(
        payload: BrandPromotionCreateRequest,
        authorization: str | None = Header(default=None, alias="Authorization"),
        idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    ) -> dict[str, object]:
        auth_user = _require_auth_user(token_verifier, authorization)
        user = _require_completed_role(repository, auth_user, "BRAND")
        brand_id = _require_document_str(user, "brandId")
        brand_agent_id = _require_document_str(user, "agentId")
        if payload.initial_offer > payload.maximum_per_creator:
            raise _problem(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "VALIDATION_ERROR",
                "initialOffer must be less than or equal to maximumPerCreator.",
            )
        if payload.auto_accept_ceiling > payload.maximum_per_creator:
            raise _problem(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "VALIDATION_ERROR",
                "autoAcceptCeiling must be less than or equal to maximumPerCreator.",
            )
        if payload.deadline <= date.today():
            raise _problem(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "VALIDATION_ERROR",
                "deadline must be after today.",
            )
        key = _require_idempotency_key(idempotency_key)
        request_payload = {
            "uid": auth_user.uid,
            "brandId": brand_id,
            **payload.model_dump(mode="json", by_alias=True),
        }
        _claim_idempotency(
            repository,
            key,
            payload=request_payload,
            owner_path=f"{FirestorePaths.brand(brand_id)}:promotion-create",
        )
        promotion_id = payload.promotion_id or (
            f"promotion-{uuid5(NAMESPACE_URL, f'{brand_id}:{key}')}"
        )
        existing = repository.get_raw_document(FirestorePaths.promotion(promotion_id))
        if existing is not None:
            existing_owner = existing.get("brandId")
            if existing_owner != brand_id:
                raise _problem(
                    status.HTTP_409_CONFLICT,
                    "IDEMPOTENCY_CONFLICT",
                    f"Promotion {promotion_id} already exists.",
                )
            return _ok({"promotion": existing})
        if repository.get_promotion(promotion_id) is not None:
            raise _problem(
                status.HTTP_409_CONFLICT,
                "IDEMPOTENCY_CONFLICT",
                f"Promotion {promotion_id} already exists.",
            )
        now = _now_datetime()
        promotion = payload.to_promotion(
            promotion_id=promotion_id,
            brand_id=brand_id,
            brand_agent_id=brand_agent_id,
            now=now,
        )
        document = {
            **model_to_document(promotion),
            "ownerUid": auth_user.uid,
            "productName": payload.product_name,
            "categories": payload.categories,
            "targetAudienceText": payload.target_audience,
            "currency": "USDC",
            "totalBudget": payload.total_budget,
            "initialOffer": payload.initial_offer,
            "maximumPerCreator": payload.maximum_per_creator,
            "autoAcceptCeiling": payload.auto_accept_ceiling,
            "maximumRounds": payload.maximum_rounds,
            "deadline": payload.deadline.isoformat(),
            "status": "OPEN",
            "updatedAt": _now(),
            "createdAt": _now(),
        }
        repository.save_raw_document(FirestorePaths.promotion(promotion_id), document)
        _append_promotion_event(
            repository,
            promotion_id=promotion_id,
            event_type="PROMOTION_CREATED",
            data={"status": "OPEN", "ownerUid": auth_user.uid, "idempotencyKey": key},
        )
        return _ok({"promotion": document})

    @router.get("/brand/promotions/{promotion_id}")
    def get_brand_promotion(
        promotion_id: str,
        authorization: str | None = Header(default=None, alias="Authorization"),
    ) -> dict[str, object]:
        auth_user = _require_auth_user(token_verifier, authorization)
        user = _require_completed_role(repository, auth_user, "BRAND")
        promotion = _require_brand_promotion_document(repository, user, promotion_id)
        agreement = _agreement_for_promotion(repository, promotion_id)
        agreements = _agreements_for_promotion(repository, promotion_id)
        return _ok(
            {
                "promotion": promotion,
                "agreement": agreement,
                "agreements": agreements,
                "activity": _promotion_events(repository, {promotion_id}, limit=20),
            }
        )

    @router.delete("/brand/promotions/{promotion_id}")
    def delete_brand_promotion(
        promotion_id: str,
        authorization: str | None = Header(default=None, alias="Authorization"),
        idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    ) -> dict[str, object]:
        auth_user = _require_auth_user(token_verifier, authorization)
        user = _require_completed_role(repository, auth_user, "BRAND")
        key = _require_idempotency_key(idempotency_key)
        promotion = _require_brand_promotion_document(repository, user, promotion_id)
        if promotion.get("deletedAt"):
            return _ok({"promotion": promotion, "deleted": True})
        _claim_idempotency(
            repository,
            key,
            payload={
                "uid": auth_user.uid,
                "promotionId": promotion_id,
                "action": "DELETE_PROMOTION",
            },
            owner_path=FirestorePaths.promotion(promotion_id),
        )
        if _agreement_for_promotion(repository, promotion_id) is not None:
            raise _problem(
                status.HTTP_409_CONFLICT,
                "PROMOTION_DELETE_BLOCKED",
                "계약 또는 정산 기록이 있는 프로모션은 삭제할 수 없습니다. "
                "프로모션을 종료하거나 보관해주세요.",
            )
        now = _now()
        deleted = {
            **promotion,
            "deletedAt": now,
            "deletedBy": auth_user.uid,
            "updatedAt": now,
        }
        repository.save_raw_document(FirestorePaths.promotion(promotion_id), deleted)
        _append_promotion_event(
            repository,
            promotion_id=promotion_id,
            event_type="PROMOTION_DELETED",
            data={"ownerUid": auth_user.uid, "idempotencyKey": key},
        )
        return _ok({"promotion": deleted, "deleted": True})

    @router.get("/brand/promotions/{promotion_id}/activity")
    def get_brand_promotion_activity(
        promotion_id: str,
        authorization: str | None = Header(default=None, alias="Authorization"),
    ) -> dict[str, object]:
        auth_user = _require_auth_user(token_verifier, authorization)
        user = _require_completed_role(repository, auth_user, "BRAND")
        _require_brand_promotion_document(repository, user, promotion_id)
        return _ok({"events": _promotion_events(repository, {promotion_id}, limit=50)})

    @router.get("/brand/agreements")
    def list_brand_agreements(
        authorization: str | None = Header(default=None, alias="Authorization"),
    ) -> dict[str, object]:
        auth_user = _require_auth_user(token_verifier, authorization)
        user = _require_completed_role(repository, auth_user, "BRAND")
        brand_id = _require_document_str(user, "brandId")
        agreements = [
            agreement
            for agreement in repository.list_raw_documents(COLLECTIONS.agreements)
            if agreement.get("brandId") == brand_id
            or _promotion_belongs_to_brand(repository, agreement.get("promotionId"), brand_id)
        ]
        return _ok({"agreements": _sorted_recent(agreements)})

    @router.get("/brand/agreements/{agreement_id}")
    def get_brand_agreement(
        agreement_id: str,
        authorization: str | None = Header(default=None, alias="Authorization"),
    ) -> dict[str, object]:
        auth_user = _require_auth_user(token_verifier, authorization)
        user = _require_completed_role(repository, auth_user, "BRAND")
        agreement = _require_brand_agreement_document(repository, user, agreement_id)
        return _ok(
            {
                "agreement": agreement,
                "escrow": _find_escrow_by_agreement(repository, agreement_id),
            }
        )

    @router.get("/creator/offers")
    def list_creator_offers(
        authorization: str | None = Header(default=None, alias="Authorization"),
    ) -> dict[str, object]:
        auth_user = _require_auth_user(token_verifier, authorization)
        user = _require_completed_role(repository, auth_user, "CREATOR")
        offers = _creator_offer_documents(repository, user)
        return _ok({"offers": offers})

    @router.get("/creator/offers/{negotiation_id}")
    def get_creator_offer(
        negotiation_id: str,
        authorization: str | None = Header(default=None, alias="Authorization"),
    ) -> dict[str, object]:
        auth_user = _require_auth_user(token_verifier, authorization)
        user = _require_completed_role(repository, auth_user, "CREATOR")
        negotiation = _require_creator_negotiation_document(repository, user, negotiation_id)
        promotion = repository.get_raw_document(
            FirestorePaths.promotion(_require_document_str(negotiation, "promotionId"))
        )
        return _ok({"offer": _offer_projection(negotiation, promotion), "negotiation": negotiation})

    @router.get("/creator/agreements")
    def list_creator_agreements(
        authorization: str | None = Header(default=None, alias="Authorization"),
    ) -> dict[str, object]:
        auth_user = _require_auth_user(token_verifier, authorization)
        user = _require_completed_role(repository, auth_user, "CREATOR")
        agreements = _creator_agreement_documents(repository, user)
        return _ok({"agreements": agreements})

    @router.get("/creator/agreements/{agreement_id}")
    def get_creator_agreement(
        agreement_id: str,
        authorization: str | None = Header(default=None, alias="Authorization"),
    ) -> dict[str, object]:
        auth_user = _require_auth_user(token_verifier, authorization)
        user = _require_completed_role(repository, auth_user, "CREATOR")
        agreement = _require_creator_agreement_document(repository, user, agreement_id)
        escrow = _find_escrow_by_agreement(repository, agreement_id)
        return _ok({"agreement": agreement, "escrow": escrow})

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
                "authProvider": "legacy-bootstrap",
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
            "status": "ACTIVE",
            "publicationStatus": "DRAFT",
            "acceptingOffers": False,
            "availability": "UNAVAILABLE",
            "activeNegotiations": 0,
            "maxConcurrentNegotiations": 1,
            "activeCollaborations": 0,
            "maxActiveCollaborations": 1,
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
    def run_matches(
        promotion_id: str,
        idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    ) -> dict[str, object]:
        promotion = _get_promotion(repository, promotion_id)
        if idempotency_key:
            payload_hash = sha256_prefixed(canonical_json({"promotionId": promotion_id}))
            created = repository.claim_idempotency_record(
                f"match-run:{promotion_id}:{idempotency_key}",
                payload_hash=payload_hash,
                owner_path=FirestorePaths.promotion(promotion_id),
            )
            if not created:
                existing = _match_run_by_idempotency_key(
                    repository,
                    promotion_id=promotion_id,
                    idempotency_key=idempotency_key,
                )
                if existing is not None:
                    return _ok({"matchRun": existing})
        active_run = _active_match_run_for_promotion(repository, promotion_id)
        if active_run is not None:
            return _ok({"matchRun": active_run})
        discovery_repository = FirestoreCreatorDiscoveryRepository(repository)
        search_result = discovery_repository.search(promotion, limit=DISCOVERY_LIMIT)
        public_ranked = rank_discovery_candidates(promotion, search_result.projections)
        detailed_candidates, detail_read_count = detail_candidates(
            repository,
            public_ranked,
            limit=DETAIL_READ_LIMIT,
        )
        ranked = _apply_private_eligibility(promotion, detailed_candidates)
        selected_pair = next(
            (
                (candidate, creator)
                for candidate, creator in ranked
                if candidate.eligible
            ),
            None,
        )
        selected = selected_pair[0] if selected_pair else None
        selected_creator = selected_pair[1] if selected_pair else None
        match_run_id = f"match-{uuid4()}"
        now = _now()
        match_run: dict[str, object] = {
            "matchRunId": match_run_id,
            "promotionId": promotion.promotion_id,
            "brandAgentId": promotion.brand_agent_id,
            "status": "COMPLETED",
            "stateHistory": ["READY", "DISCOVERING", "RANKING", "SELECTING", "COMPLETED"],
            "weightsVersion": MATCHING_WEIGHTS_VERSION,
            "rankingVersion": DISCOVERY_RANKING_VERSION,
            "discoveryLimit": search_result.metrics.query_limit,
            "discoveryReturnedCount": search_result.metrics.returned_count,
            "detailReadLimit": search_result.metrics.detail_read_limit,
            "detailReadCount": detail_read_count,
            "selectedCreatorId": selected_creator.creator_id if selected_creator else None,
            "selectedCreatorAgentId": selected.creator_agent_id if selected else None,
            "idempotencyKey": idempotency_key,
            "createdAt": now,
            "completedAt": now,
        }
        match_run_path = FirestorePaths.match_run(match_run_id)
        repository.save_raw_document(match_run_path, match_run)
        _append_match_run_event(
            repository,
            match_run_id=match_run_id,
            event_type="MATCH_RUN_READY",
            status_value="READY",
            data={"promotionId": promotion_id},
        )
        _append_match_run_event(
            repository,
            match_run_id=match_run_id,
            event_type="MATCH_RUN_DISCOVERING",
            status_value="DISCOVERING",
            data={"discoveryLimit": search_result.metrics.query_limit},
        )
        _append_match_run_event(
            repository,
            match_run_id=match_run_id,
            event_type="MATCH_RUN_RANKING",
            status_value="RANKING",
            data={"candidateCount": len(ranked)},
        )
        _append_match_run_event(
            repository,
            match_run_id=match_run_id,
            event_type="MATCH_RUN_SELECTING",
            status_value="SELECTING",
            data={"selectedCreatorAgentId": selected.creator_agent_id if selected else None},
        )
        for candidate, creator in ranked:
            document = _discovery_candidate_document(candidate)
            document["creatorId"] = creator.creator_id
            document["creatorDisplayName"] = creator.display_name
            document["categories"] = creator.categories
            document["supportedDeliverableFormats"] = creator.supported_deliverable_formats
            document["creatorProfilePath"] = FirestorePaths.creator_profile(creator.creator_id)
            document["profileVersion"] = candidate.projection.get("profileVersion")
            document["taxonomyVersion"] = candidate.projection.get("taxonomyVersion")
            document["embeddingVersion"] = candidate.projection.get("embeddingVersion")
            document["indexVersion"] = candidate.projection.get("indexVersion")
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
        paid_verification = _run_paid_verification(
            repository=repository,
            settings=settings,
            match_run_id=match_run_id,
            promotion_id=promotion_id,
            selected_creator_agent_id=selected.creator_agent_id if selected else None,
        )
        match_run = {**match_run, "paidVerification": paid_verification}
        repository.save_raw_document(match_run_path, match_run)
        _append_match_run_event(
            repository,
            match_run_id=match_run_id,
            event_type="MATCH_RUN_COMPLETED",
            status_value="COMPLETED",
            data={"selectedCreatorAgentId": selected.creator_agent_id if selected else None},
        )
        _append_promotion_event(
            repository,
            promotion_id=promotion_id,
            event_type="API_PAYMENT",
            data=paid_verification,
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

    @router.post("/promotions/{promotion_id}/match-runs", status_code=status.HTTP_201_CREATED)
    def create_match_run(
        promotion_id: str,
        idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    ) -> dict[str, object]:
        return run_matches(promotion_id, idempotency_key)

    @router.get("/match-runs/{match_run_id}")
    def get_match_run(match_run_id: str) -> dict[str, object]:
        match_run = repository.get_raw_document(FirestorePaths.match_run(match_run_id))
        if match_run is None:
            raise _not_found("matchRun", match_run_id)
        return _ok({"matchRun": match_run})

    @router.get("/match-runs/{match_run_id}/timeline")
    def get_match_run_timeline(match_run_id: str) -> dict[str, object]:
        match_run = repository.get_raw_document(FirestorePaths.match_run(match_run_id))
        if match_run is None:
            raise _not_found("matchRun", match_run_id)
        match_run_events = _match_run_events(repository, match_run_id, limit=50)
        if match_run_events:
            return _ok({"events": match_run_events})
        promotion_id = _require_document_str(match_run, "promotionId")
        return _ok({"events": _promotion_events(repository, {promotion_id}, limit=50)})

    @router.get("/match-runs/{match_run_id}/events")
    def get_match_run_events(match_run_id: str) -> dict[str, object]:
        return get_match_run_timeline(match_run_id)

    @router.post("/match-runs/{match_run_id}:cancel")
    def cancel_match_run(match_run_id: str) -> dict[str, object]:
        match_run_path = FirestorePaths.match_run(match_run_id)
        match_run = repository.get_raw_document(match_run_path)
        if match_run is None:
            raise _not_found("matchRun", match_run_id)
        if match_run.get("status") in {
            "AGREED",
            "ESCROW_PREPARING",
            "ESCROW_SUBMITTED",
            "ESCROW_CONFIRMED",
            "COMPLETED",
            "EXHAUSTED",
            "CANCELED",
            "FAILED",
        }:
            raise _problem(
                status.HTTP_409_CONFLICT,
                "INVALID_STATE_TRANSITION",
                "Terminal Match Runs cannot be canceled.",
            )
        now = _now()
        canceled = {
            **match_run,
            "status": "CANCELED",
            "canceledAt": now,
            "completedAt": now,
        }
        repository.save_raw_document(match_run_path, canceled)
        _append_match_run_event(
            repository,
            match_run_id=match_run_id,
            event_type="MATCH_RUN_CANCELED",
            status_value="CANCELED",
            data={},
        )
        return _ok({"matchRun": canceled})

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
        promotion_document = (
            repository.get_raw_document(FirestorePaths.promotion(promotion_id))
            or model_to_document(promotion)
        )
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
        registry_entry = _require_creator_agent_registry_entry(repository, creator_agent_id)
        creator_a2a_base_url = _creator_a2a_base_url(settings, registry_entry)
        brand = repository.get_raw_document(FirestorePaths.brand(promotion.brand_id))

        terms = build_initial_terms(
            promotion,
            creator,
            base_amount_usdc=_promotion_initial_offer_usdc(promotion_document),
        )
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
        creator_context = CreatorNegotiationContext(
            creatorAgentId=creator_agent_id,
            policy=agent_policy.creator,
            today=_policy_today(promotion),
            currentMonthDeliverables=creator.active_deliverables_this_month,
            maxRounds=promotion.autonomy.max_negotiation_rounds,
        )
        agent_card = _discover_creator_agent_card(settings=settings, base_url=creator_a2a_base_url)
        _validate_creator_agent_card(agent_card, creator_agent_id)
        try:
            initial_task = _send_creator_a2a_task(
                settings=settings,
                base_url=creator_a2a_base_url,
                creator_agent_id=creator_agent_id,
                message=offer_message,
                context=creator_context,
            )
        except CreatorA2AClientError as exc:
            raise _problem(
                status.HTTP_502_BAD_GATEWAY,
                "A2A_CREATOR_AGENT_UNAVAILABLE",
                f"Creator A2A negotiation failed: {exc}",
            ) from exc

        a2a_task = initial_task
        task_id = initial_task.id
        response_message = initial_task.status.message
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
        response_terms = creator_decision_document.get("terms")
        current_terms = (
            response_terms
            if isinstance(response_terms, dict)
            else payload.terms.model_dump(by_alias=True, mode="json")
        )
        persisted_messages: list[dict[str, object]] = [
            {
                "messageId": offer_message_id,
                "contextId": context_id,
                "taskId": task_id,
                "role": "ROLE_USER",
                "sequence": 1,
                "payload": payload.model_dump(by_alias=True, mode="json"),
                "a2aMessage": offer_message.model_dump(by_alias=True, mode="json"),
                "createdAt": now,
            }
        ]
        persisted_decisions: list[dict[str, object]] = []
        if response_message is not None:
            persisted_messages.append(
                {
                    "messageId": response_message_id,
                    "contextId": context_id,
                    "taskId": task_id,
                    "role": "ROLE_AGENT",
                    "sequence": 2,
                    "payload": creator_decision_document,
                    "a2aMessage": response_message.model_dump(by_alias=True, mode="json"),
                    "createdAt": now,
                }
            )
        persisted_decisions.append(
            {
                "decisionId": decision_id,
                "messageId": response_message_id,
                "type": decision_type.value,
                "policyDecision": creator_decision_document.get("policyDecision"),
                "createdAt": now,
            }
        )
        final_brand_decision = brand_decision
        if decision_type == NegotiationMessageType.COUNTER:
            counter_terms = AgreementTerms.model_validate(current_terms)
            final_brand_decision = validate_brand_terms(
                promotion,
                creator,
                counter_terms,
                current_round=2,
            )
            persisted_decisions.append(
                {
                    "decisionId": f"decision-{uuid4()}",
                    "messageId": response_message_id,
                    "type": "BRAND_POLICY_EVALUATION",
                    "policyDecision": final_brand_decision.model_dump(
                        by_alias=True,
                        mode="json",
                    ),
                    "createdAt": now,
                }
            )
            if final_brand_decision.allowed:
                changed_fields_value = creator_decision_document.get("changedFields")
                changed_fields = (
                    [item for item in changed_fields_value if isinstance(item, str)]
                    if isinstance(changed_fields_value, list)
                    else []
                )
                accept_payload = NegotiationPayload(
                    type=NegotiationMessageType.ACCEPT,
                    round=2,
                    promotion=promotion,
                    terms=counter_terms,
                    changedFields=changed_fields,
                    rationale="Brand policy accepted Creator counteroffer.",
                )
                accept_message_id = f"message-{uuid4()}"
                accept_message = A2AMessage(
                    messageId=accept_message_id,
                    contextId=context_id,
                    taskId=task_id,
                    role=A2ARole.USER,
                    parts=[
                        A2APart(
                            mediaType="application/json",
                            data=accept_payload.model_dump(by_alias=True, mode="json"),
                        )
                    ],
                )
                try:
                    a2a_task = _send_creator_a2a_task(
                        settings=settings,
                        base_url=creator_a2a_base_url,
                        creator_agent_id=creator_agent_id,
                        message=accept_message,
                        context=creator_context,
                    )
                except CreatorA2AClientError as exc:
                    raise _problem(
                        status.HTTP_502_BAD_GATEWAY,
                        "A2A_CREATOR_AGENT_UNAVAILABLE",
                        f"Creator A2A accept failed: {exc}",
                    ) from exc
                persisted_messages.append(
                    {
                        "messageId": accept_message_id,
                        "contextId": context_id,
                        "taskId": task_id,
                        "role": "ROLE_USER",
                        "sequence": 3,
                        "payload": accept_payload.model_dump(by_alias=True, mode="json"),
                        "a2aMessage": accept_message.model_dump(by_alias=True, mode="json"),
                        "createdAt": now,
                    }
                )
                response_message = a2a_task.status.message
                try:
                    creator_decision_document = first_part_data(response_message)
                except CreatorA2AClientError as exc:
                    raise _problem(
                        status.HTTP_409_CONFLICT,
                        "INVALID_STATE_TRANSITION",
                        f"Creator A2A final response is invalid: {exc}",
                    ) from exc
                decision_type = _decision_type_from_document(creator_decision_document)
                response_message_id = (
                    response_message.message_id if response_message else f"message-{uuid4()}"
                )
                response_terms = creator_decision_document.get("terms")
                current_terms = (
                    response_terms if isinstance(response_terms, dict) else current_terms
                )
                if response_message is not None:
                    persisted_messages.append(
                        {
                            "messageId": response_message_id,
                            "contextId": context_id,
                            "taskId": task_id,
                            "role": "ROLE_AGENT",
                            "sequence": 4,
                            "payload": creator_decision_document,
                            "a2aMessage": response_message.model_dump(
                                by_alias=True,
                                mode="json",
                            ),
                            "createdAt": now,
                        }
                    )
                persisted_decisions.append(
                    {
                        "decisionId": f"decision-{uuid4()}",
                        "messageId": response_message_id,
                        "type": decision_type.value,
                        "policyDecision": creator_decision_document.get("policyDecision"),
                        "createdAt": now,
                    }
                )
        negotiation_status = _negotiation_status(decision_type)
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
        negotiation: dict[str, object] = {
            "negotiationId": negotiation_id,
            "matchRunId": match_run_id,
            "matchCandidateId": match_candidate_id,
            "matchCandidatePath": candidate_path,
            "promotionId": promotion.promotion_id,
            "promotionTitle": promotion.title,
            "productName": promotion_document.get("productName") or promotion.title,
            "brandId": promotion.brand_id,
            "brandAgentId": promotion.brand_agent_id,
            "brandDisplayName": _brand_display_name(brand, fallback=promotion.brand_id),
            "brandSnapshot": _public_brand_snapshot(brand),
            "creatorId": creator.creator_id,
            "creatorAgentId": creator_agent_id,
            "creatorDisplayName": creator.display_name,
            "creatorSnapshot": _public_creator_snapshot(creator),
            "promotionSnapshot": _public_promotion_snapshot(promotion_document),
            "contextId": context_id,
            "taskId": task_id,
            "status": negotiation_status,
            "currentRound": 2 if len(persisted_messages) >= 3 else 1,
            "maxRounds": promotion.autonomy.max_negotiation_rounds,
            "currentTerms": current_terms,
            "initialAmountUsdc": terms.compensation.base_amount_usdc,
            "currentAmountUsdc": _terms_base_amount_usdc(current_terms),
            "workItems": _terms_work_items(current_terms),
            "deliverableSummary": _terms_deliverable_summary(current_terms),
            "brandPolicySnapshot": {
                "ruleVersion": final_brand_decision.rule_version,
                "decision": final_brand_decision.model_dump(by_alias=True, mode="json"),
            },
            "creatorPolicySnapshot": {"redacted": True},
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
        _write_a2a_task_events(
            repository,
            task_id=task_id,
            negotiation_id=negotiation_id,
            persisted_messages=persisted_messages,
            final_state=str(a2a_task.status.state.value),
            created_at=now,
        )
        for message_document in persisted_messages:
            message_document["transport"] = (
                "HTTP_A2A" if settings.creator_a2a_mode == "http" else "IN_PROCESS_A2A"
            )
            message_document["a2aEndpoint"] = creator_a2a_base_url
            repository.save_raw_document(
                FirestorePaths.negotiation_message(
                    negotiation_id,
                    _require_document_str(message_document, "messageId"),
                ),
                message_document,
            )
        for decision_document in persisted_decisions:
            repository.save_raw_document(
                FirestorePaths.negotiation_decision(
                    negotiation_id,
                    _require_document_str(decision_document, "decisionId"),
                ),
                decision_document,
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
            promotion=promotion_document,
            brand=brand,
            creator=creator,
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
        if agent_card is not None:
            _append_promotion_event(
                repository,
                promotion_id=promotion_id,
                event_type="A2A_AGENT_CARD_DISCOVERED",
                data={
                    "creatorAgentId": creator_agent_id,
                    "name": agent_card.get("name"),
                    "version": agent_card.get("version"),
                },
            )
        _append_promotion_event(
            repository,
            promotion_id=promotion_id,
            event_type="A2A_OFFER_SENT",
            data={
                "negotiationId": negotiation_id,
                "contextId": context_id,
                "taskId": task_id,
                "messageId": offer_message_id,
            },
        )
        if any(
            decision["type"] == NegotiationMessageType.COUNTER.value
            for decision in persisted_decisions
        ):
            _append_promotion_event(
                repository,
                promotion_id=promotion_id,
                event_type="A2A_COUNTER_RECEIVED",
                data={
                    "negotiationId": negotiation_id,
                    "contextId": context_id,
                    "taskId": task_id,
                },
            )
        if len(persisted_messages) >= 3:
            _append_promotion_event(
                repository,
                promotion_id=promotion_id,
                event_type="A2A_ACCEPT_SENT",
                data={
                    "negotiationId": negotiation_id,
                    "contextId": context_id,
                    "taskId": task_id,
                },
            )
        if agreement is not None:
            _append_promotion_event(
                repository,
                promotion_id=promotion_id,
                event_type="AGREEMENT_CREATED",
                data={
                    "negotiationId": negotiation_id,
                    "agreementId": agreement["agreementId"],
                    "taskId": task_id,
                },
            )
        auto_escrow: dict[str, object] | None = None
        if agreement is not None and settings.agent_auto_settlement:
            agreement_id = str(agreement["agreementId"])
            try:
                lock_response = lock_escrow(
                    agreement_id,
                    idempotency_key=f"agent-lock-{agreement_id}",
                )
                lock_data = lock_response.get("data")
                auto_escrow = {
                    "action": "ESCROW_LOCK",
                    "status": "LOCKED",
                    **(lock_data if isinstance(lock_data, dict) else {}),
                }
            except HTTPException as exc:
                auto_escrow = _agent_action_error("ESCROW_LOCK", exc)
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
        return _ok(
            {
                "negotiation": negotiation,
                "agreement": agreement,
                "autoEscrow": auto_escrow,
            }
        )

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
        escrow = _require_funded_escrow_for_agreement(repository, agreement_id)
        existing_evidence = _find_evidence_for_milestone(
            repository,
            agreement_id=agreement_id,
            milestone_id=payload.milestone_id,
        )
        if existing_evidence is not None:
            raise _problem(
                status.HTTP_409_CONFLICT,
                "EVIDENCE_ALREADY_SUBMITTED",
                "Evidence was already submitted for this milestone.",
            )

        evidence_id = f"evidence-{uuid4()}"
        now = _now()
        normalized_url = _validate_external_https_url(payload.url)
        source_digest = sha256_prefixed(normalized_url)
        evidence = {
            "evidenceId": evidence_id,
            "agreementId": agreement_id,
            "milestoneId": payload.milestone_id,
            "milestonePath": FirestorePaths.milestone(agreement_id, payload.milestone_id),
            "milestoneSnapshot": milestone,
            "promotionId": agreement["promotionId"],
            "escrowId": escrow["escrowId"],
            "creatorAgentId": creator_agent_id,
            "submittedByAgentId": payload.submitted_by_agent_id,
            "url": normalized_url,
            "sourceDigest": source_digest,
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
        verification_status = "PASSED" if policy_decision.allowed else "FAILED"
        verified = {
            **evidence,
            "status": verification_status,
            "observations": observations,
            "policyDecision": policy_decision.model_dump(by_alias=True, mode="json"),
            "verifiedAt": _now(),
            "updatedAt": _now(),
        }
        repository.save_raw_document(evidence_path, verified)
        verification_result = {
            "verificationResultId": f"verification-{evidence_id}",
            "evidenceId": evidence_id,
            "agreementId": verified["agreementId"],
            "milestoneId": verified["milestoneId"],
            "sourceDigest": verified.get("sourceDigest"),
            "provider": "deterministic-url-policy",
            "model": None,
            "status": "VERIFIED" if policy_decision.allowed else "REJECTED",
            "observations": observations,
            "policyDecision": policy_decision.model_dump(by_alias=True, mode="json"),
            "createdAt": verified["verifiedAt"],
        }
        repository.save_raw_document(
            FirestorePaths.verification_result(
                _require_document_str(verification_result, "verificationResultId")
            ),
            verification_result,
        )
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
        auto_release: dict[str, object] | None = None
        if settings.agent_auto_settlement:
            agreement_id = _require_document_str(verified, "agreementId")
            milestone_id = _require_document_str(verified, "milestoneId")
            escrow = _find_escrow_by_agreement(repository, agreement_id)
            if escrow is None:
                auto_release = {
                    "action": "MILESTONE_RELEASE",
                    "status": "SKIPPED",
                    "reason": "ESCROW_NOT_LOCKED",
                }
            elif escrow.get("status") == "LOCKED":
                escrow_id = _require_document_str(escrow, "escrowId")
                try:
                    release_response = release_milestone(
                        escrow_id,
                        milestone_id,
                        idempotency_key=f"agent-release-{escrow_id}-{milestone_id}",
                    )
                    release_data = release_response.get("data")
                    auto_release = {
                        "action": "MILESTONE_RELEASE",
                        "status": "RELEASED",
                        **(release_data if isinstance(release_data, dict) else {}),
                    }
                except HTTPException as exc:
                    auto_release = _agent_action_error("MILESTONE_RELEASE", exc)
            else:
                auto_release = {
                    "action": "MILESTONE_RELEASE",
                    "status": "SKIPPED",
                    "reason": f"ESCROW_{escrow.get('status', 'UNKNOWN')}",
                }
        return _ok({"evidence": verified, "autoRelease": auto_release})

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

        milestone_amounts = milestone_amounts_base_units(locked_amount, terms.milestones)
        brand_authority_wallet = _brand_authority_wallet(repository, agreement)
        creator_destination_wallet = _creator_settlement_wallet(repository, agreement)

        _claim_idempotency(
            repository,
            key,
            payload={
                "op": "ESCROW_LOCK",
                "agreementId": agreement_id,
                "amount": locked_amount,
                "programId": settings.escrow_program_id,
                "mint": settings.usdc_mint,
                "brandAuthorityWallet": brand_authority_wallet,
                "creatorDestinationWallet": creator_destination_wallet,
            },
            owner_path=f"lock:{agreement_id}",
        )

        now = _now()
        escrow_id = f"escrow-{uuid4()}"
        receipt_id = f"receipt-{uuid4()}"
        operation_id = f"op-{uuid4()}"
        try:
            gateway_receipt = _require_confirmed_gateway_receipt(
                _lock_with_web3_gateway(
                    settings=settings,
                    idempotency_key=key,
                    agreement=agreement,
                    escrow_id=escrow_id,
                    locked_amount=locked_amount,
                    milestone_amounts=milestone_amounts,
                    brand_authority_wallet=brand_authority_wallet,
                    creator_destination_wallet=creator_destination_wallet,
                ),
                expected={
                    "agreementId": agreement_id,
                    "escrowId": escrow_id,
                    "termsHash": agreement["termsHash"],
                    "lockedAmountBaseUnits": str(locked_amount),
                    "mint": settings.usdc_mint,
                    "programId": settings.escrow_program_id,
                    "network": settings.escrow_network,
                },
            )
        except HTTPException as exc:
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
                receipt=_failed_receipt(
                    receipt_id=receipt_id,
                    operation_id=operation_id,
                    network=settings.escrow_network,
                    detail=str(exc.detail),
                    created_at=now,
                ),
            )
            _append_promotion_event(
                repository,
                promotion_id=str(agreement["promotionId"]),
                event_type="ESCROW_LOCK_FAILED",
                data={
                    "agreementId": agreement_id,
                    "escrowId": escrow_id,
                    "receiptId": receipt["receiptId"],
                    "receiptStatus": receipt["status"],
                },
            )
            _append_audit(
                repository,
                action="ESCROW_LOCK_FAILED",
                data={"escrowId": escrow_id, "agreementId": agreement_id},
            )
            raise
        escrow = {
            "escrowId": escrow_id,
            "agreementId": agreement_id,
            "promotionId": agreement["promotionId"],
            "brandAgentId": agreement["brandAgentId"],
            "creatorAgentId": agreement["creatorAgentId"],
            "creatorDestinationWallet": creator_destination_wallet,
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
            receipt=receipt_from_gateway(
                receipt_id=receipt_id,
                operation_id=operation_id,
                gateway_receipt=gateway_receipt,
                created_at=now,
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
        agreement_id = _require_document_str(escrow, "agreementId")
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
        if escrow.get("status") != "LOCKED":
            raise _problem(
                status.HTTP_409_CONFLICT,
                "INVALID_STATE_TRANSITION",
                "Escrow is not in a releasable state.",
            )
        promotion = _get_promotion(repository, _require_document_str(escrow, "promotionId"))
        if not promotion.autonomy.auto_release:
            raise _problem(
                status.HTTP_409_CONFLICT,
                "POLICY_VIOLATION",
                "Auto-release is disabled for this Promotion; human approval is required.",
            )
        milestone = _get_milestone_document(repository, agreement_id, milestone_id)

        passed_evidence = _passed_evidence_for_milestone(repository, agreement_id, milestone_id)
        if passed_evidence is None:
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
        try:
            gateway_receipt = _require_confirmed_gateway_receipt(
                _release_with_web3_gateway(
                    settings=settings,
                    repository=repository,
                    idempotency_key=key,
                    escrow=escrow,
                    agreement_id=agreement_id,
                    milestone_id=milestone_id,
                    amount=amount,
                ),
                expected={
                    "agreementId": agreement_id,
                    "escrowId": escrow_id,
                    "milestoneId": milestone_id,
                    "termsHash": escrow["termsHash"],
                    "releasedAmountBaseUnits": str(amount),
                    "mint": settings.usdc_mint,
                    "programId": settings.escrow_program_id,
                    "network": settings.escrow_network,
                },
            )
        except HTTPException as exc:
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
                extra={"milestoneId": milestone_id},
                receipt=_failed_receipt(
                    receipt_id=receipt_id,
                    operation_id=operation_id,
                    network=settings.escrow_network,
                    detail=str(exc.detail),
                    created_at=now,
                ),
            )
            _append_promotion_event(
                repository,
                promotion_id=str(escrow["promotionId"]),
                event_type="MILESTONE_RELEASE_FAILED",
                data={
                    "escrowId": escrow_id,
                    "milestoneId": milestone_id,
                    "receiptId": receipt["receiptId"],
                    "receiptStatus": receipt["status"],
                },
            )
            _append_audit(
                repository,
                action="MILESTONE_RELEASE_FAILED",
                data={"escrowId": escrow_id, "milestoneId": milestone_id},
            )
            raise
        settlement = {
            "settlementId": settlement_id,
            "escrowId": escrow_id,
            "agreementId": agreement_id,
            "milestoneId": milestone_id,
            "amountBaseUnits": str(amount),
            "network": settings.escrow_network,
            "creatorDestinationWallet": escrow.get("creatorDestinationWallet"),
            "status": gateway_receipt["status"],
            "signature": gateway_receipt["signature"],
            "evidenceId": passed_evidence["evidenceId"],
            "sourceDigest": passed_evidence.get("sourceDigest"),
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
            "evidenceId": passed_evidence["evidenceId"],
            "sourceDigest": passed_evidence.get("sourceDigest"),
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
            receipt=receipt_from_gateway(
                receipt_id=receipt_id,
                operation_id=operation_id,
                gateway_receipt=gateway_receipt,
                created_at=now,
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
                "evidenceId": passed_evidence["evidenceId"],
                "sourceDigest": passed_evidence.get("sourceDigest"),
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


def _promotion_initial_offer_usdc(promotion: dict[str, object]) -> int | None:
    initial_offer = promotion.get("initialOffer")
    if isinstance(initial_offer, int) and initial_offer > 0:
        return initial_offer
    return None


def _terms_base_amount_usdc(terms: dict[str, object]) -> int | None:
    compensation = terms.get("compensation")
    if not isinstance(compensation, dict):
        return None
    amount = compensation.get("baseAmountUsdc")
    if isinstance(amount, int):
        return amount
    if isinstance(amount, str) and amount.isdigit():
        return int(amount)
    return None


def _terms_work_items(terms: dict[str, object]) -> list[dict[str, object]]:
    deliverables = terms.get("deliverables")
    if not isinstance(deliverables, list):
        return []
    items: list[dict[str, object]] = []
    for deliverable in deliverables:
        if not isinstance(deliverable, dict):
            continue
        count = deliverable.get("count")
        if not isinstance(count, int) or count <= 0:
            continue
        items.append(
            {
                "format": deliverable.get("format"),
                "count": count,
                "postWindow": deliverable.get("postWindow"),
                "revisionRounds": deliverable.get("revisionRounds"),
            }
        )
    return items


def _terms_deliverable_summary(terms: dict[str, object]) -> str:
    labels = {
        "reel": "릴스",
        "short": "숏츠",
        "post": "게시글",
        "story": "스토리",
    }
    parts: list[str] = []
    for item in _terms_work_items(terms):
        format_value = str(item.get("format") or "content")
        count = item.get("count")
        label = labels.get(format_value, format_value)
        parts.append(f"{label} {count}개")
    return ", ".join(parts) if parts else "작업 조건 미정"


def _require_auth_user(
    token_verifier: FirebaseTokenVerifier,
    authorization: str | None,
) -> AuthenticatedUser:
    try:
        return token_verifier.verify_authorization_header(authorization)
    except AuthError as exc:
        raise _problem(status.HTTP_401_UNAUTHORIZED, "UNAUTHENTICATED", str(exc)) from exc


def _require_dev_admin(
    repository: KnotRepository,
    settings: Settings,
    token_verifier: FirebaseTokenVerifier,
    authorization: str | None,
) -> AuthenticatedUser:
    auth_user = _require_auth_user(token_verifier, authorization)
    _bootstrap_authenticated_user(repository, auth_user)
    if not settings.dev_admin_enabled:
        raise _problem(
            status.HTTP_403_FORBIDDEN,
            "FORBIDDEN",
            "Dev admin is disabled.",
        )
    claims = auth_user.claims or {}
    allowlist = {item.lower() for item in settings.dev_admin_allowlist}
    is_claim_admin = claims.get("admin") is True
    is_allowlisted = auth_user.uid.lower() in allowlist or (
        auth_user.email is not None and auth_user.email.lower() in allowlist
    )
    if not is_claim_admin and not is_allowlisted:
        raise _problem(
            status.HTTP_403_FORBIDDEN,
            "FORBIDDEN",
            "Dev admin access requires admin claim or allowlist.",
        )
    return auth_user


def _require_user_document(repository: KnotRepository, uid: str) -> dict[str, object]:
    user = repository.get_raw_document(FirestorePaths.user(uid))
    if user is None:
        raise _not_found("user", uid)
    return user


def _admin_counts(repository: KnotRepository) -> dict[str, int]:
    return {
        "users": len(repository.list_raw_documents(COLLECTIONS.users)),
        "brands": len(repository.list_raw_documents(COLLECTIONS.brands)),
        "creatorProfiles": len(repository.list_raw_documents(COLLECTIONS.creator_profiles)),
        "promotions": len(repository.list_raw_documents(COLLECTIONS.promotions)),
        "negotiations": len(repository.list_raw_documents(COLLECTIONS.negotiations)),
        "agreements": len(repository.list_raw_documents(COLLECTIONS.agreements)),
        "escrows": len(repository.list_raw_documents(COLLECTIONS.escrows)),
        "transactionReceipts": len(repository.list_raw_documents(COLLECTIONS.transaction_receipts)),
        "auditEvents": len(repository.list_raw_documents(COLLECTIONS.audit_events)),
    }


def _latest_failures(repository: KnotRepository) -> list[dict[str, object]]:
    failures: list[dict[str, object]] = []
    for receipt in repository.list_raw_documents(COLLECTIONS.transaction_receipts):
        if receipt.get("status") == "FAILED":
            failures.append(
                {
                    "type": "TRANSACTION_RECEIPT",
                    "receiptId": receipt.get("receiptId"),
                    "createdAt": receipt.get("createdAt"),
                    "detail": receipt.get("detail"),
                }
            )
    failures.sort(key=lambda item: str(item.get("createdAt", "")), reverse=True)
    return failures[:10]


def _admin_user_projection(user: dict[str, object]) -> dict[str, object]:
    return {
        "uid": user.get("uid") or user.get("userId"),
        "email": user.get("email"),
        "displayName": user.get("displayName"),
        "role": user.get("role"),
        "status": user.get("status"),
        "onboardingStatus": user.get("onboardingStatus"),
        "brandId": user.get("brandId"),
        "creatorId": user.get("creatorId"),
        "agentId": user.get("agentId"),
        "environment": user.get("environment"),
        "seedBatchId": user.get("seedBatchId"),
        "createdAt": user.get("createdAt"),
        "updatedAt": user.get("updatedAt"),
    }


def _admin_inventory(
    repository: KnotRepository,
    user: dict[str, object],
) -> dict[str, object]:
    uid = str(user.get("uid") or user.get("userId"))
    brand_id = user.get("brandId")
    creator_id = user.get("creatorId")
    agent_id = user.get("agentId")
    safe_records = [FirestorePaths.user(uid)] if _is_demo_document(user) else []
    retained_records: list[str] = []
    for collection in (
        COLLECTIONS.agreements,
        COLLECTIONS.escrows,
        COLLECTIONS.settlements,
        COLLECTIONS.transaction_receipts,
        COLLECTIONS.payment_operations,
    ):
        for document in repository.list_raw_documents(collection):
            if (
                document.get("brandId") == brand_id
                or document.get("creatorId") == creator_id
                or document.get("brandAgentId") == agent_id
                or document.get("creatorAgentId") == agent_id
                or document.get("agreementId") in {brand_id, creator_id, agent_id}
            ):
                document_id = document.get(collection[:-1] + "Id", "unknown")
                retained_records.append(f"{collection}/{document_id}")
    return {
        "safeDeleteRecords": safe_records,
        "retainedRecords": retained_records,
        "retainedFinancialRecordCount": len(retained_records),
        "demoTagged": _is_demo_document(user),
    }


def _is_demo_document(document: dict[str, object]) -> bool:
    return document.get("environment") == "demo" or isinstance(document.get("seedBatchId"), str)


def _bootstrap_authenticated_user(
    repository: KnotRepository,
    auth_user: AuthenticatedUser,
) -> dict[str, object]:
    path = FirestorePaths.user(auth_user.uid)
    now = _now()
    existing = repository.get_raw_document(path)
    if existing is None:
        user: dict[str, object] = {
            "uid": auth_user.uid,
            "userId": auth_user.uid,
            "email": auth_user.email,
            "displayName": auth_user.display_name or _email_label(auth_user.email),
            "photoUrl": auth_user.photo_url,
            "role": None,
            "onboardingStatus": "ROLE_REQUIRED",
            "status": "ACTIVE",
            "brandId": None,
            "creatorId": None,
            "agentId": None,
            "schemaVersion": 2,
            "createdAt": now,
            "updatedAt": now,
            "lastLoginAt": now,
        }
        repository.save_raw_document(path, user)
        _append_audit(repository, action="USER_BOOTSTRAPPED", data={"uid": auth_user.uid})
        return user

    user = dict(existing)
    role = user.get("role")
    onboarding_status = user.get("onboardingStatus")
    if onboarding_status is None:
        onboarding_status = _derive_onboarding_status(user)
    user.update(
        {
            "uid": auth_user.uid,
            "userId": auth_user.uid,
            "email": auth_user.email or user.get("email"),
            "displayName": auth_user.display_name
            or user.get("displayName")
            or _email_label(auth_user.email),
            "photoUrl": (
                auth_user.photo_url if auth_user.photo_url is not None else user.get("photoUrl")
            ),
            "role": role,
            "onboardingStatus": onboarding_status,
            "status": user.get("status") or "ACTIVE",
            "schemaVersion": 2,
            "updatedAt": now,
            "lastLoginAt": now,
        }
    )
    repository.save_raw_document(path, user)
    return user


def _require_role(
    repository: KnotRepository,
    auth_user: AuthenticatedUser,
    role: str,
) -> dict[str, object]:
    user = _bootstrap_authenticated_user(repository, auth_user)
    if user.get("role") != role:
        raise _problem(
            status.HTTP_403_FORBIDDEN,
            "FORBIDDEN",
            f"Current account must have {role} role.",
        )
    return user


def _require_completed_role(
    repository: KnotRepository,
    auth_user: AuthenticatedUser,
    role: str,
) -> dict[str, object]:
    user = _require_role(repository, auth_user, role)
    if user.get("onboardingStatus") != "COMPLETED":
        raise _problem(
            status.HTTP_409_CONFLICT,
            "ONBOARDING_REQUIRED",
            f"{role} onboarding must be completed before accessing the dashboard.",
        )
    if role == "BRAND":
        brand_id = user.get("brandId")
        if not isinstance(brand_id, str) or not brand_id:
            raise _not_found("brandProfile", auth_user.uid)
        if repository.get_raw_document(FirestorePaths.brand(brand_id)) is None:
            raise _not_found("brandProfile", brand_id)
    if role == "CREATOR":
        creator_id = user.get("creatorId")
        if not isinstance(creator_id, str) or not creator_id:
            raise _not_found("creatorProfile", auth_user.uid)
        if repository.get_raw_document(FirestorePaths.creator_profile(creator_id)) is None:
            raise _not_found("creatorProfile", creator_id)
    return user


def _brand_dashboard(repository: KnotRepository, user: dict[str, object]) -> dict[str, object]:
    brand_id = _require_document_str(user, "brandId")
    brand = repository.get_raw_document(FirestorePaths.brand(brand_id))
    if brand is None:
        raise _not_found("brandProfile", brand_id)

    promotions = [
        _promotion_document_with_raw(repository, promotion)
        for promotion in repository.list_promotions()
        if promotion.brand_id == brand_id
        and not _promotion_is_deleted(repository, promotion.promotion_id)
    ]
    promotions = _sorted_recent(promotions)[:10]
    promotion_ids = {str(promotion.get("promotionId")) for promotion in promotions}
    agreements = [
        document
        for document in repository.list_raw_documents(COLLECTIONS.agreements)
        if document.get("brandId") == brand_id
        or str(document.get("promotionId")) in promotion_ids
    ]
    negotiations = [
        document
        for document in repository.list_raw_documents(COLLECTIONS.negotiations)
        if str(document.get("promotionId")) in promotion_ids
    ]
    events = _promotion_events(repository, promotion_ids, limit=8)
    if not events:
        events = _creator_activity(negotiations, agreements, limit=8)
    contracted_creator_agent_ids = {
        str(agreement.get("creatorAgentId"))
        for agreement in agreements
        if agreement.get("creatorAgentId")
    }
    contracted_creators = [
        _creator_projection(creator)
        for creator in repository.list_creator_profiles()
        if creator.creator_agent_id in contracted_creator_agent_ids
    ]
    locked_escrow = sum(
        _int_string(document.get("lockedAmountBaseUnits"))
        for document in repository.list_raw_documents(COLLECTIONS.escrows)
        if str(document.get("promotionId")) in promotion_ids
    )
    return {
        "brand": brand,
        "summary": {
            "activePromotions": sum(
                1
                for promotion in promotions
                if str(promotion.get("status")) not in {"DRAFT", "CANCELED", "FAILED"}
            ),
            "negotiationsInProgress": sum(
                1
                for negotiation in negotiations
                if str(negotiation.get("status")) in {"CREATED", "OFFERED", "COUNTERED"}
            ),
            "agreements": len(agreements),
            "lockedEscrowBaseUnits": str(locked_escrow),
        },
        "activePromotions": promotions,
        "recentAgentActivity": events,
        "contractedCreators": contracted_creators[:10],
    }


def _promotion_document_with_raw(
    repository: KnotRepository,
    promotion: Promotion,
) -> dict[str, object]:
    raw = repository.get_raw_document(FirestorePaths.promotion(promotion.promotion_id)) or {}
    return {**model_to_document(promotion), **raw}


def _promotion_is_deleted(repository: KnotRepository, promotion_id: str) -> bool:
    raw = repository.get_raw_document(FirestorePaths.promotion(promotion_id)) or {}
    return bool(raw.get("deletedAt"))


def _require_brand_promotion_document(
    repository: KnotRepository,
    user: dict[str, object],
    promotion_id: str,
) -> dict[str, object]:
    promotion = repository.get_promotion(promotion_id)
    if promotion is None or _promotion_is_deleted(repository, promotion_id):
        raise _not_found("promotion", promotion_id)
    brand_id = _require_document_str(user, "brandId")
    if promotion.brand_id != brand_id:
        raise _problem(
            status.HTTP_403_FORBIDDEN,
            "FORBIDDEN",
            "Promotion does not belong to the authenticated Brand.",
        )
    return _promotion_document_with_raw(repository, promotion)


def _promotion_belongs_to_brand(
    repository: KnotRepository,
    promotion_id: object,
    brand_id: str,
) -> bool:
    if not isinstance(promotion_id, str):
        return False
    promotion = repository.get_promotion(promotion_id)
    return (
        promotion is not None
        and promotion.brand_id == brand_id
        and not _promotion_is_deleted(repository, promotion_id)
    )


def _agreement_for_promotion(
    repository: KnotRepository,
    promotion_id: str,
) -> dict[str, object] | None:
    return next(
        (
            agreement
            for agreement in _sorted_recent(repository.list_raw_documents(COLLECTIONS.agreements))
            if agreement.get("promotionId") == promotion_id
        ),
        None,
    )


def _agreements_for_promotion(
    repository: KnotRepository,
    promotion_id: str,
) -> list[dict[str, object]]:
    return _sorted_recent(
        [
            agreement
            for agreement in repository.list_raw_documents(COLLECTIONS.agreements)
            if agreement.get("promotionId") == promotion_id
        ]
    )


def _require_brand_agreement_document(
    repository: KnotRepository,
    user: dict[str, object],
    agreement_id: str,
) -> dict[str, object]:
    agreement = repository.get_raw_document(FirestorePaths.agreement(agreement_id))
    if agreement is None:
        raise _not_found("agreement", agreement_id)
    brand_id = _require_document_str(user, "brandId")
    if agreement.get("brandId") == brand_id:
        return agreement
    if _promotion_belongs_to_brand(repository, agreement.get("promotionId"), brand_id):
        return agreement
    raise _problem(
        status.HTTP_403_FORBIDDEN,
        "FORBIDDEN",
        "Agreement does not belong to the authenticated Brand.",
    )


def _creator_dashboard(repository: KnotRepository, user: dict[str, object]) -> dict[str, object]:
    creator_id = _require_document_str(user, "creatorId")
    creator = repository.get_raw_document(FirestorePaths.creator_profile(creator_id))
    if creator is None:
        raise _not_found("creatorProfile", creator_id)
    agent_id = str(
        user.get("agentId") or user.get("creatorAgentId") or creator.get("creatorAgentId")
    )
    negotiations = [
        document
        for document in repository.list_raw_documents(COLLECTIONS.negotiations)
        if document.get("creatorId") == creator_id or document.get("creatorAgentId") == agent_id
    ]
    agreements = [
        document
        for document in repository.list_raw_documents(COLLECTIONS.agreements)
        if document.get("creatorId") == creator_id or document.get("creatorAgentId") == agent_id
    ]
    promotion_ids = {
        str(item.get("promotionId"))
        for item in [*negotiations, *agreements]
        if item.get("promotionId")
    }
    promotions_by_id = {
        promotion.promotion_id: model_to_document(promotion)
        for promotion in repository.list_promotions()
        if promotion.promotion_id in promotion_ids
    }
    offers = [
        _offer_projection(negotiation, promotions_by_id.get(str(negotiation.get("promotionId"))))
        for negotiation in _sorted_recent(negotiations)[:10]
    ]
    active_sponsorships = [
        _agreement_projection(
            repository,
            agreement,
            promotions_by_id.get(str(agreement.get("promotionId"))),
        )
        for agreement in _sorted_recent(agreements)[:10]
    ]
    payout_totals = _agreement_milestone_totals_base_units(agreements)
    recent_activity = _creator_activity(negotiations, agreements, limit=8)
    return {
        "creator": creator,
        "summary": {
            "newOffers": sum(1 for offer in offers if offer["status"] in {"OFFERED", "CREATED"}),
            "agentNegotiations": len(negotiations),
            "activeSponsorships": len(agreements),
            "availablePayoutBaseUnits": str(payout_totals["available"]),
            "releasedPayoutBaseUnits": str(payout_totals["released"]),
            "pendingPayoutBaseUnits": str(payout_totals["pending"]),
        },
        "offers": offers,
        "activeSponsorships": active_sponsorships,
        "recentAgentActivity": recent_activity,
    }


def _apply_private_eligibility(
    promotion: Promotion,
    detailed_candidates: Sequence[tuple[RankedDiscoveryCandidate, CreatorProfile]],
) -> list[tuple[RankedDiscoveryCandidate, CreatorProfile]]:
    results: list[tuple[RankedDiscoveryCandidate, CreatorProfile]] = []
    rank = 1
    for candidate, creator in detailed_candidates:
        hard_filter_reasons = _dedupe_strings(
            [
                *candidate.hard_filter_reasons,
                *hard_filter_creator(promotion, creator),
            ]
        )
        eligible = candidate.eligible and not hard_filter_reasons
        updated = RankedDiscoveryCandidate(
            creator_id=candidate.creator_id,
            creator_agent_id=candidate.creator_agent_id,
            eligible=eligible,
            score=candidate.score if eligible else 0.0,
            score_components=candidate.score_components,
            hard_filter_reasons=hard_filter_reasons,
            rank=rank if eligible else None,
            projection=candidate.projection,
        )
        if eligible:
            rank += 1
        results.append((updated, creator))
    return results


def _discovery_candidate_document(candidate: RankedDiscoveryCandidate) -> dict[str, object]:
    components = candidate.score_components
    legacy_components = {
        "category": components["categoryAudienceFit"],
        "budget": components["coarseBudgetFit"],
        "schedule": components["scheduleFit"],
        "deliverable": components["formatFit"],
        "reputation": components["reliabilityFit"],
    }
    return {
        "creatorAgentId": candidate.creator_agent_id,
        "eligible": candidate.eligible,
        "score": candidate.score,
        "componentScores": legacy_components,
        "scoreComponents": components,
        "hardFilterReasons": candidate.hard_filter_reasons,
        "rank": candidate.rank,
        "rankingVersion": DISCOVERY_RANKING_VERSION,
        "safeExplanationFacts": {
            "categoryKeys": candidate.projection.get("categoryKeys"),
            "formatKeys": candidate.projection.get("formatKeys"),
            "availability": candidate.projection.get("availability"),
            "publicRateBand": candidate.projection.get("publicRateBand"),
            "nextAvailableAt": candidate.projection.get("nextAvailableAt"),
            "verifiedDealsCount": candidate.projection.get("verifiedDealsCount"),
        },
    }


def _dedupe_strings(values: Sequence[str]) -> list[str]:
    seen: set[str] = set()
    results: list[str] = []
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        results.append(value)
    return results


def _require_creator_agent_context(
    repository: KnotRepository,
    user: dict[str, object],
) -> tuple[dict[str, object], CreatorProfile]:
    creator_id = _require_document_str(user, "creatorId")
    creator = repository.get_creator_profile(creator_id)
    if creator is None:
        raise _not_found("creatorProfile", creator_id)
    agent_id = _require_document_str(user, "agentId")
    agent = repository.get_raw_document(FirestorePaths.agent(agent_id))
    if agent is None:
        raise _not_found("agent", agent_id)
    if agent.get("ownerUid") not in {None, user.get("uid"), user.get("userId")}:
        raise _problem(
            status.HTTP_403_FORBIDDEN,
            "FORBIDDEN",
            "Creator Agent does not belong to the authenticated Creator.",
        )
    if agent.get("ownerId") not in {None, creator_id}:
        raise _problem(
            status.HTTP_403_FORBIDDEN,
            "FORBIDDEN",
            "Creator Agent owner does not match the authenticated Creator profile.",
        )
    return agent, creator


def _creator_agent_view(
    agent: dict[str, object],
    creator: CreatorProfile,
) -> dict[str, object]:
    publication_status = str(agent.get("publicationStatus") or "DRAFT")
    accepting_offers = bool(agent.get("acceptingOffers"))
    default_availability = (
        "AVAILABLE"
        if publication_status == "PUBLISHED" and accepting_offers
        else "UNAVAILABLE"
    )
    availability = str(agent.get("availability") or default_availability)
    return {
        "agentId": agent.get("agentId"),
        "creatorId": creator.creator_id,
        "publicationStatus": publication_status,
        "acceptingOffers": accepting_offers,
        "availability": availability,
        "activeNegotiations": non_negative_int(agent.get("activeNegotiations")),
        "maxConcurrentNegotiations": positive_int(agent.get("maxConcurrentNegotiations"), 1),
        "activeCollaborations": non_negative_int(agent.get("activeCollaborations")),
        "maxActiveCollaborations": positive_int(agent.get("maxActiveCollaborations"), 1),
        "capacityAvailable": creator.remaining_capacity > 0,
        "updatedAt": agent.get("updatedAt"),
    }


def _creator_offer_documents(
    repository: KnotRepository,
    user: dict[str, object],
) -> list[dict[str, object]]:
    negotiations = [
        negotiation
        for negotiation in repository.list_raw_documents(COLLECTIONS.negotiations)
        if _creator_participates(user, negotiation)
    ]
    promotions_by_id = {
        promotion.promotion_id: model_to_document(promotion)
        for promotion in repository.list_promotions()
    }
    return [
        _offer_projection(item, promotions_by_id.get(str(item.get("promotionId"))))
        for item in _sorted_recent(negotiations)
    ]


def _creator_agreement_documents(
    repository: KnotRepository,
    user: dict[str, object],
) -> list[dict[str, object]]:
    return _sorted_recent(
        [
            agreement
            for agreement in repository.list_raw_documents(COLLECTIONS.agreements)
            if _creator_participates(user, agreement)
        ]
    )


def _require_creator_negotiation_document(
    repository: KnotRepository,
    user: dict[str, object],
    negotiation_id: str,
) -> dict[str, object]:
    negotiation = repository.get_raw_document(FirestorePaths.negotiation(negotiation_id))
    if negotiation is None:
        raise _not_found("negotiation", negotiation_id)
    if not _creator_participates(user, negotiation):
        raise _problem(
            status.HTTP_403_FORBIDDEN,
            "FORBIDDEN",
            "Offer does not belong to the authenticated Creator.",
        )
    return negotiation


def _require_creator_agreement_document(
    repository: KnotRepository,
    user: dict[str, object],
    agreement_id: str,
) -> dict[str, object]:
    agreement = repository.get_raw_document(FirestorePaths.agreement(agreement_id))
    if agreement is None:
        raise _not_found("agreement", agreement_id)
    if not _creator_participates(user, agreement):
        raise _problem(
            status.HTTP_403_FORBIDDEN,
            "FORBIDDEN",
            "Agreement does not belong to the authenticated Creator.",
        )
    return agreement


def _creator_participates(user: dict[str, object], document: dict[str, object]) -> bool:
    creator_id = user.get("creatorId")
    agent_id = user.get("agentId") or user.get("creatorAgentId")
    return (
        isinstance(creator_id, str)
        and document.get("creatorId") == creator_id
        or isinstance(agent_id, str)
        and document.get("creatorAgentId") == agent_id
    )


def _promotion_events(
    repository: KnotRepository,
    promotion_ids: set[str],
    *,
    limit: int,
) -> list[dict[str, object]]:
    events: list[dict[str, object]] = []
    for promotion_id in promotion_ids:
        events.extend(
            repository.list_raw_documents(
                f"{COLLECTIONS.promotions}/{promotion_id}/{COLLECTIONS.promotion_events}"
            )
        )
    return _sorted_recent(events)[:limit]


def _creator_activity(
    negotiations: list[dict[str, object]],
    agreements: list[dict[str, object]],
    *,
    limit: int,
) -> list[dict[str, object]]:
    events = [
        {
            "eventId": f"activity-{item.get('negotiationId')}",
            "type": "NEGOTIATION",
            "label": f"Negotiation {item.get('status')}",
            "negotiationId": item.get("negotiationId"),
            "promotionId": item.get("promotionId"),
            "createdAt": item.get("updatedAt") or item.get("createdAt"),
        }
        for item in negotiations
    ]
    events.extend(
        {
            "eventId": f"activity-{item.get('agreementId')}",
            "type": "AGREEMENT",
            "label": f"Agreement {item.get('status')}",
            "agreementId": item.get("agreementId"),
            "promotionId": item.get("promotionId"),
            "createdAt": item.get("updatedAt") or item.get("createdAt"),
        }
        for item in agreements
    )
    return _sorted_recent(events)[:limit]


def _creator_projection(creator: CreatorProfile) -> dict[str, object]:
    return {
        "creatorId": creator.creator_id,
        "creatorAgentId": creator.creator_agent_id,
        "displayName": creator.display_name,
        "categories": creator.categories,
        "completedDealCount": creator.completed_deal_count,
    }


def _offer_projection(
    negotiation: dict[str, object],
    promotion: dict[str, object] | None,
) -> dict[str, object]:
    return {
        "negotiationId": negotiation.get("negotiationId"),
        "promotionId": negotiation.get("promotionId"),
        "brandAgentId": negotiation.get("brandAgentId"),
        "creatorAgentId": negotiation.get("creatorAgentId"),
        "creatorDisplayName": negotiation.get("creatorDisplayName"),
        "productName": negotiation.get("productName"),
        "title": promotion.get("title") if promotion else "Promotion",
        "status": negotiation.get("status"),
        "currentRound": negotiation.get("currentRound"),
        "initialAmountUsdc": negotiation.get("initialAmountUsdc"),
        "currentAmountUsdc": negotiation.get("currentAmountUsdc"),
        "deliverableSummary": negotiation.get("deliverableSummary"),
        "workItems": negotiation.get("workItems"),
        "currentTerms": negotiation.get("currentTerms"),
        "updatedAt": negotiation.get("updatedAt") or negotiation.get("createdAt"),
    }


def _agreement_projection(
    repository: KnotRepository,
    agreement: dict[str, object],
    promotion: dict[str, object] | None,
) -> dict[str, object]:
    escrow = _find_escrow_by_agreement(
        repository,
        str(agreement.get("agreementId") or ""),
    )
    return {
        "agreementId": agreement.get("agreementId"),
        "promotionId": agreement.get("promotionId"),
        "title": promotion.get("title") if promotion else "Agreement",
        "status": agreement.get("status"),
        "terms": agreement.get("terms"),
        "workItems": agreement.get("workItems"),
        "deliverableSummary": agreement.get("deliverableSummary"),
        "milestones": agreement.get("milestones", []),
        "escrow": escrow,
        "brandSnapshot": agreement.get("brandSnapshot"),
        "creatorSnapshot": agreement.get("creatorSnapshot"),
        "promotionSnapshot": agreement.get("promotionSnapshot"),
        "termsHash": agreement.get("termsHash"),
        "updatedAt": agreement.get("updatedAt") or agreement.get("createdAt"),
    }


def _sorted_recent(documents: list[dict[str, object]]) -> list[dict[str, object]]:
    return sorted(
        documents,
        key=lambda item: str(item.get("updatedAt") or item.get("createdAt") or ""),
        reverse=True,
    )


def _int_string(value: object) -> int:
    if isinstance(value, int):
        return value
    if isinstance(value, str) and value.isdigit():
        return int(value)
    return 0


def _agreement_milestone_totals_base_units(
    agreements: list[dict[str, object]],
) -> dict[str, int]:
    totals = {"released": 0, "available": 0, "pending": 0}
    for agreement in agreements:
        milestones = agreement.get("milestones")
        if not isinstance(milestones, list):
            continue
        for milestone in milestones:
            if not isinstance(milestone, dict):
                continue
            amount = milestone.get("amountUsdc")
            if not isinstance(amount, int | float):
                continue
            base_units = int(amount * 1_000_000)
            status_value = str(milestone.get("status") or "")
            if status_value == "RELEASED":
                totals["released"] += base_units
            elif status_value == "VERIFIED":
                totals["available"] += base_units
            else:
                totals["pending"] += base_units
    return totals


def _with_custom_category(categories: list[str], custom_category: str | None) -> list[str]:
    normalized = [category.strip() for category in categories if category.strip()]
    if custom_category and custom_category.strip():
        normalized.append(f"custom:{custom_category.strip()}")
    return list(dict.fromkeys(normalized))


def _social_platform(url: str) -> str:
    lowered = url.lower()
    if "instagram." in lowered:
        return "INSTAGRAM"
    if "tiktok." in lowered:
        return "TIKTOK"
    if "youtube." in lowered or "youtu.be" in lowered:
        return "YOUTUBE"
    return "OTHER"


def _current_user_payload(
    repository: KnotRepository,
    user: dict[str, object],
) -> dict[str, object]:
    role = user.get("role")
    profile_summary: dict[str, object] | None = None
    if role == "BRAND" and isinstance(user.get("brandId"), str):
        brand = repository.get_raw_document(FirestorePaths.brand(str(user["brandId"])))
        if brand is not None:
            profile_summary = {
                "type": "BRAND",
                "id": brand.get("brandId"),
                "displayName": brand.get("displayName"),
                "agentId": user.get("agentId") or user.get("brandAgentId"),
            }
    elif role == "CREATOR" and isinstance(user.get("creatorId"), str):
        creator = repository.get_raw_document(
            FirestorePaths.creator_profile(str(user["creatorId"]))
        )
        if creator is not None:
            profile_summary = {
                "type": "CREATOR",
                "id": creator.get("creatorId"),
                "displayName": creator.get("displayName"),
                "agentId": user.get("agentId") or user.get("creatorAgentId"),
            }
    agent_id = user.get("agentId") or user.get("brandAgentId") or user.get("creatorAgentId")
    # 에이전트 지갑(수탁, Secret Manager) 공개키는 read-only 표시용 — docs/WALLET_AND_MONEY_FLOW §6
    agent_wallet_pubkey = None
    if isinstance(agent_id, str) and agent_id:
        agent = repository.get_raw_document(FirestorePaths.agent(agent_id))
        if agent is not None:
            pubkey = agent.get("walletPubkey")
            agent_wallet_pubkey = pubkey if isinstance(pubkey, str) else None
    account = {
        "uid": user.get("uid") or user.get("userId"),
        "userId": user.get("uid") or user.get("userId"),
        "email": user.get("email"),
        "displayName": user.get("displayName"),
        "photoUrl": user.get("photoUrl"),
        "role": role,
        "onboardingStatus": user.get("onboardingStatus") or _derive_onboarding_status(user),
        "status": user.get("status") or "ACTIVE",
        "brandId": user.get("brandId"),
        "creatorId": user.get("creatorId"),
        "agentId": agent_id,
        # 유저 지갑(Phantom): 저장한 값을 되읽어야 새로고침 후에도 표시된다
        "walletAddress": user.get("walletAddress"),
        "agentWalletPubkey": agent_wallet_pubkey,
        "schemaVersion": user.get("schemaVersion") or 2,
    }
    return {
        "account": account,
        "profileSummary": profile_summary,
        "dashboardTarget": _dashboard_target(account),
    }


def _derive_onboarding_status(user: dict[str, object]) -> str:
    role = user.get("role")
    if role == "BRAND":
        return "COMPLETED" if user.get("brandId") else "PROFILE_REQUIRED"
    if role == "CREATOR":
        return "COMPLETED" if user.get("creatorId") else "PROFILE_REQUIRED"
    return "ROLE_REQUIRED"


def _onboarding_session(
    repository: KnotRepository,
    owner_uid: str,
    user: dict[str, object],
) -> dict[str, object]:
    existing = repository.get_raw_document(FirestorePaths.onboarding_session(owner_uid))
    if existing is not None:
        return existing
    role = user.get("role")
    now = _now()
    return {
        "ownerUid": owner_uid,
        "role": role if isinstance(role, str) else None,
        "status": "IN_PROGRESS",
        "currentCard": "SOURCE",
        "completedCards": [],
        "analysisJobId": None,
        "draft": {},
        "draftVersion": 0,
        "createdAt": now,
        "updatedAt": now,
    }


def _next_draft_version(session: dict[str, object]) -> int:
    value = session.get("draftVersion")
    return (value if isinstance(value, int) else 0) + 1


def _create_analysis_job(
    *,
    repository: KnotRepository,
    settings: Settings,
    owner_uid: str,
    role: str,
    analysis_type: str,
    source_url: str,
    idempotency_key: str | None,
    user: dict[str, object],
) -> dict[str, object]:
    normalized_url = _validate_external_https_url(source_url)
    source_digest = sha256_prefixed(normalized_url)
    key = idempotency_key or f"analysis:{owner_uid}:{analysis_type}:{source_digest}"
    analysis_id = f"analysis-{uuid5(NAMESPACE_URL, key)}"
    existing = repository.get_raw_document(FirestorePaths.analysis_job(analysis_id))
    if existing is not None:
        if existing.get("ownerUid") != owner_uid:
            raise _problem(
                status.HTTP_409_CONFLICT,
                "IDEMPOTENCY_CONFLICT",
                "Analysis idempotency key is already bound to another owner.",
            )
        return existing

    draft = (
        _product_analysis_draft(normalized_url, settings)
        if analysis_type == "PRODUCT"
        else _creator_profile_analysis_draft(normalized_url, settings)
    )
    now = _now()
    analysis: dict[str, object] = {
        "analysisId": analysis_id,
        "ownerUid": owner_uid,
        "role": role,
        "analysisType": analysis_type,
        "status": "READY_FOR_CONFIRMATION",
        "sourceUrl": normalized_url,
        "sourceDigest": source_digest,
        "provider": "deterministic",
        "model": None,
        "fallbackReason": "secure_fetch_and_gemini_not_configured"
        if settings.gemini_mode == "off"
        else "secure_fetch_not_implemented",
        "schemaVersion": "knot.analysis-job.v1",
        "draft": draft,
        "confirmedFields": [],
        "createdAt": now,
        "updatedAt": now,
    }
    repository.save_raw_document(FirestorePaths.analysis_job(analysis_id), analysis)
    session = _onboarding_session(repository, owner_uid, user)
    repository.save_raw_document(
        FirestorePaths.onboarding_session(owner_uid),
        {
            **session,
            "role": role,
            "status": "IN_PROGRESS",
            "currentCard": "ANALYSIS",
            "completedCards": _append_unique_str(session.get("completedCards"), "SOURCE"),
            "analysisJobId": analysis_id,
            "draft": draft,
            "draftVersion": _next_draft_version(session),
            "updatedAt": now,
        },
    )
    return analysis


def _require_owned_analysis(
    repository: KnotRepository,
    owner_uid: str,
    analysis_id: str,
) -> dict[str, object]:
    analysis = repository.get_raw_document(FirestorePaths.analysis_job(analysis_id))
    if analysis is None:
        raise _not_found("analysis", analysis_id)
    if analysis.get("ownerUid") != owner_uid:
        raise _problem(
            status.HTTP_403_FORBIDDEN,
            "FORBIDDEN",
            "Analysis does not belong to the authenticated account.",
        )
    return analysis


def _validate_external_https_url(value: str) -> str:
    parsed = urlparse(value.strip())
    if parsed.scheme != "https":
        raise _problem(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "UNSAFE_SOURCE_URL",
            "Source URL must use https.",
        )
    hostname = parsed.hostname
    if hostname is None:
        raise _problem(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "UNSAFE_SOURCE_URL",
            "Source URL must include a host.",
        )
    host = hostname.lower().rstrip(".")
    if host in {"localhost", "metadata.google.internal"} or host.endswith(".local"):
        raise _problem(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "UNSAFE_SOURCE_URL",
            "Source URL host is not allowed.",
        )
    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        address = None
    if address is not None and (
        address.is_private
        or address.is_loopback
        or address.is_link_local
        or address.is_reserved
        or address.is_multicast
        or address.is_unspecified
    ):
        raise _problem(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "UNSAFE_SOURCE_URL",
            "Source URL IP range is not allowed.",
        )
    return parsed.geturl()


def _field(value: object, *, source: str, confidence: float) -> dict[str, object]:
    return {"value": value, "source": source, "confidence": confidence}


def _product_analysis_draft(source_url: str, settings: Settings) -> dict[str, object]:
    parsed = urlparse(source_url)
    host_label = (parsed.hostname or "product").split(".")[0].replace("-", " ").title()
    return {
        "analysisId": None,
        "mode": "api",
        "provider": "deterministic",
        "model": None if settings.gemini_mode == "off" else settings.gemini_model,
        "fallbackReason": "secure_fetch_and_gemini_not_configured"
        if settings.gemini_mode == "off"
        else "secure_fetch_not_implemented",
        "unknownFields": ["price", "reviews", "sales", "audienceMetrics"],
        "brand": {"name": _field(host_label, source="URL_HOST", confidence=0.45)},
        "product": {
            "name": _field(host_label, source="URL_HOST", confidence=0.35),
            "category": _field("beauty", source="USER_CONFIRMATION_REQUIRED", confidence=0.2),
            "summary": _field(
                "공개 페이지를 아직 가져오지 않아 URL 기반 제한 분석만 준비됐습니다.",
                source="LIMITED_ANALYSIS",
                confidence=0.2,
            ),
            "price": _field(None, source="UNKNOWN", confidence=0.0),
            "features": [],
            "targetAudience": [],
            "keywords": [],
        },
        "recommendations": {
            "objectives": ["awareness"],
            "channels": ["instagram"],
            "deliverables": ["reel"],
        },
    }


def _creator_profile_analysis_draft(source_url: str, settings: Settings) -> dict[str, object]:
    parsed = urlparse(source_url)
    handle = (parsed.path.strip("/").split("/") or ["creator"])[0] or "creator"
    if not handle.startswith("@"):
        handle = f"@{handle}"
    return {
        "schemaVersion": "knot.creator-profile.v1",
        "sourceUrl": source_url,
        "provider": "deterministic",
        "model": None if settings.gemini_mode == "off" else settings.gemini_model,
        "fallbackReason": "secure_fetch_and_gemini_not_configured"
        if settings.gemini_mode == "off"
        else "secure_fetch_not_implemented",
        "displayName": _field(handle.removeprefix("@"), source="URL_PATH", confidence=0.45),
        "handle": _field(handle, source="URL_PATH", confidence=0.75),
        "categoryKeys": [],
        "formatKeys": [],
        "audienceTags": [],
        "proposedMoodIds": [],
        "summary": "공개 콘텐츠를 아직 가져오지 않아 사용자 확인이 필요합니다.",
        "representativeUrls": [],
        "unknownFields": ["averageViews", "followerCount", "recentPosts"],
        "safetyFlags": [],
    }


def _dashboard_target(account: dict[str, object]) -> str:
    role = account.get("role")
    status_value = account.get("onboardingStatus")
    if role == "BRAND":
        return "/brand/onboarding" if status_value != "COMPLETED" else "/brand"
    if role == "CREATOR":
        return "/creator/onboarding" if status_value != "COMPLETED" else "/creator"
    return "/signup"


def _account_label(user: dict[str, object]) -> str:
    return str(user.get("displayName") or _email_label(user.get("email")) or "KNOT user")


def _email_label(email: object) -> str:
    if isinstance(email, str) and email:
        return email.split("@")[0]
    return "KNOT user"


def _find_user_by_email(
    repository: KnotRepository,
    email: str,
) -> tuple[str, dict[str, object] | None]:
    for user in repository.list_raw_documents(COLLECTIONS.users):
        if user.get("email") == email:
            return FirestorePaths.user(_require_document_str(user, "userId")), user
    return "", None


def _creator_settlement_wallet(
    repository: KnotRepository,
    document: dict[str, object],
) -> str:
    creator_id = document.get("creatorId")
    creator_agent_id = document.get("creatorAgentId")
    for user in repository.list_raw_documents(COLLECTIONS.users):
        if (
            isinstance(creator_id, str)
            and user.get("creatorId") == creator_id
            or isinstance(creator_agent_id, str)
            and (
                user.get("agentId") == creator_agent_id
                or user.get("creatorAgentId") == creator_agent_id
            )
        ):
            wallet = user.get("walletAddress")
            if isinstance(wallet, str) and wallet:
                return wallet
    if isinstance(creator_id, str):
        creator = repository.get_raw_document(FirestorePaths.creator_profile(creator_id))
        if creator is not None:
            wallet = creator.get("walletAddress")
            if isinstance(wallet, str) and wallet:
                return wallet
    raise _problem(
        status.HTTP_409_CONFLICT,
        "CREATOR_WALLET_REQUIRED",
        "Creator must connect a settlement wallet before Agent escrow can be locked.",
    )


def _brand_authority_wallet(
    repository: KnotRepository,
    document: dict[str, object],
) -> str:
    brand_id = document.get("brandId")
    brand_agent_id = document.get("brandAgentId")
    for user in repository.list_raw_documents(COLLECTIONS.users):
        if (
            isinstance(brand_id, str)
            and user.get("brandId") == brand_id
            or isinstance(brand_agent_id, str)
            and (
                user.get("agentId") == brand_agent_id
                or user.get("brandAgentId") == brand_agent_id
            )
        ):
            wallet = user.get("walletAddress")
            if isinstance(wallet, str) and wallet:
                return wallet
    if isinstance(brand_id, str):
        brand = repository.get_raw_document(FirestorePaths.brand(brand_id))
        if brand is not None:
            wallet = brand.get("walletAddress")
            if isinstance(wallet, str) and wallet:
                return wallet
    raise _problem(
        status.HTTP_409_CONFLICT,
        "BRAND_WALLET_REQUIRED",
        "Brand must connect a wallet before Agent escrow can be locked.",
    )


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
    if "short" in lowered or "shorts" in lowered or "숏츠" in lowered or "ugc" in lowered:
        formats.append("short")
    if "post" in lowered or "feed" in lowered or "게시글" in lowered or "피드" in lowered:
        formats.append("post")
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


_LOCAL_CREATOR_A2A_STORES: dict[str, InMemoryA2ATaskStore] = {}


def _send_creator_a2a_task(
    *,
    settings: Settings,
    base_url: str,
    creator_agent_id: str,
    message: A2AMessage,
    context: CreatorNegotiationContext,
) -> A2ATask:
    if settings.creator_a2a_mode == "http":
        return CreatorA2AClient(
            base_url,
            timeout_seconds=settings.creator_a2a_timeout_seconds,
            service_token=settings.a2a_service_token,
        ).send_message(
            tenant=creator_agent_id,
            message=message,
            metadata={
                "creatorNegotiationContext": context.model_dump(
                    by_alias=True,
                    mode="json",
                )
            },
        )
    store = _LOCAL_CREATOR_A2A_STORES.get(message.context_id)
    if store is None:
        store = InMemoryA2ATaskStore(
            {creator_agent_id: context},
            rationale_provider=lambda ctx, payload, decision: creator_rationale(
                settings=settings,
                context=ctx,
                payload=payload,
                decision=decision,
            ),
        )
        _LOCAL_CREATOR_A2A_STORES[message.context_id] = store
    return store.send_message(creator_agent_id, message)


def _discover_creator_agent_card(
    *,
    settings: Settings,
    base_url: str,
) -> dict[str, object] | None:
    if settings.creator_a2a_mode != "http":
        return None
    try:
        return CreatorA2AClient(
            base_url,
            timeout_seconds=settings.creator_a2a_timeout_seconds,
            service_token=settings.a2a_service_token,
        ).agent_card()
    except CreatorA2AClientError as exc:
        raise _problem(
            status.HTTP_502_BAD_GATEWAY,
            "A2A_CREATOR_AGENT_UNAVAILABLE",
            f"Creator A2A AgentCard discovery failed: {exc}",
        ) from exc


def _require_creator_agent_registry_entry(
    repository: KnotRepository,
    creator_agent_id: str,
) -> dict[str, object]:
    registry_entry = repository.get_raw_document(
        FirestorePaths.agent_registry_entry(creator_agent_id)
    )
    if registry_entry is None:
        raise _not_found("agentRegistry", creator_agent_id)
    if registry_entry.get("tenant") != creator_agent_id:
        raise _problem(
            status.HTTP_409_CONFLICT,
            "INVALID_STATE_TRANSITION",
            "Creator Agent registry tenant does not match the selected Agent.",
        )
    if registry_entry.get("publicationStatus") != "PUBLISHED":
        raise _problem(
            status.HTTP_409_CONFLICT,
            "INVALID_STATE_TRANSITION",
            "Selected Creator Agent is not published.",
        )
    return registry_entry


def _creator_a2a_base_url(settings: Settings, registry_entry: dict[str, object]) -> str:
    base_url = registry_entry.get("baseUrl")
    return base_url if isinstance(base_url, str) and base_url else settings.creator_agent_base_url


def _validate_creator_agent_card(
    agent_card: dict[str, object] | None,
    creator_agent_id: str,
) -> None:
    if agent_card is None:
        return
    skills = agent_card.get("skills")
    if isinstance(skills, list):
        skill_ids = {
            skill.get("id")
            for skill in skills
            if isinstance(skill, dict) and isinstance(skill.get("id"), str)
        }
        if not {"promotion-negotiation", "sponsorship-negotiation"}.intersection(skill_ids):
            raise _problem(
                status.HTTP_409_CONFLICT,
                "A2A_AGENT_CARD_INVALID",
                "Creator AgentCard does not advertise sponsorship negotiation.",
            )
    interfaces = agent_card.get("supportedInterfaces")
    if not isinstance(interfaces, list) or not interfaces:
        raise _problem(
            status.HTTP_409_CONFLICT,
            "A2A_AGENT_CARD_INVALID",
            "Creator AgentCard does not advertise a supported interface.",
        )
    for item in interfaces:
        if not isinstance(item, dict):
            continue
        tenant = item.get("tenant")
        if tenant not in {None, creator_agent_id}:
            continue
        if item.get("protocolBinding") == "HTTP+JSON" and item.get("protocolVersion") == "1.0":
            return
    raise _problem(
        status.HTTP_409_CONFLICT,
        "A2A_AGENT_CARD_INVALID",
        "Creator AgentCard interface does not match the selected Agent.",
    )


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
    promotion: dict[str, object] | None = None,
    brand: dict[str, object] | None = None,
    creator: CreatorProfile | None = None,
) -> dict[str, object] | None:
    if decision.get("type") != NegotiationMessageType.ACCEPT.value:
        return None
    agreement_id = decision.get("agreementId")
    terms = decision.get("terms")
    artifact_terms_hash = decision.get("termsHash")
    if (
        not isinstance(agreement_id, str)
        or not isinstance(terms, dict)
        or not isinstance(artifact_terms_hash, str)
    ):
        raise _problem(
            status.HTTP_409_CONFLICT,
            "INVALID_STATE_TRANSITION",
            "Accepted negotiation is missing agreement terms.",
    )
    agreement_terms = AgreementTerms.model_validate(terms)
    computed_terms_hash = terms_hash(agreement_terms)
    if artifact_terms_hash != computed_terms_hash:
        raise _problem(
            status.HTTP_409_CONFLICT,
            "TERMS_HASH_MISMATCH",
            "Accepted Agreement Artifact termsHash does not match canonical terms.",
        )
    return {
        "agreementId": agreement_id,
        "negotiationId": negotiation["negotiationId"],
        "taskId": task_id,
        "artifactId": artifact_id,
        "promotionId": negotiation["promotionId"],
        "promotionTitle": negotiation.get("promotionTitle"),
        "productName": negotiation.get("productName"),
        "brandId": negotiation.get("brandId"),
        "brandAgentId": negotiation["brandAgentId"],
        "brandDisplayName": negotiation.get("brandDisplayName"),
        "creatorId": negotiation.get("creatorId"),
        "creatorAgentId": negotiation["creatorAgentId"],
        "creatorDisplayName": negotiation.get("creatorDisplayName"),
        "terms": terms,
        "workItems": _terms_work_items(terms),
        "deliverableSummary": _terms_deliverable_summary(terms),
        "currentAmountUsdc": _terms_base_amount_usdc(terms),
        "brandSnapshot": _public_brand_snapshot(brand),
        "promotionSnapshot": _public_promotion_snapshot(promotion),
        "creatorSnapshot": _public_creator_snapshot(creator),
        "canonicalTermsJson": canonical_terms_json(agreement_terms),
        "termsHash": computed_terms_hash,
        "hashAlgorithm": "sha256",
        "hashVersion": "knot.agreement-terms.v1",
        "status": "AGREED",
        "createdAt": created_at,
    }


def _public_promotion_snapshot(promotion: dict[str, object] | None) -> dict[str, object] | None:
    if promotion is None:
        return None
    return {
        "promotionId": promotion.get("promotionId"),
        "title": promotion.get("title"),
        "productName": promotion.get("productName") or promotion.get("title"),
        "category": promotion.get("category"),
        "objective": promotion.get("objective"),
    }


def _public_brand_snapshot(brand: dict[str, object] | None) -> dict[str, object] | None:
    if brand is None:
        return None
    return {
        "brandId": brand.get("brandId"),
        "displayName": brand.get("displayName") or brand.get("brandName"),
        "websiteUrl": brand.get("websiteUrl"),
        "categories": brand.get("categories")
        or ([brand.get("category")] if brand.get("category") else []),
        "targetAudience": brand.get("targetAudience"),
        "description": brand.get("description"),
    }


def _brand_display_name(brand: dict[str, object] | None, *, fallback: str) -> str:
    if brand is None:
        return fallback
    value = brand.get("displayName") or brand.get("brandName")
    return str(value) if isinstance(value, str) and value else fallback


def _public_creator_snapshot(creator: CreatorProfile | None) -> dict[str, object] | None:
    if creator is None:
        return None
    return {
        "creatorId": creator.creator_id,
        "creatorAgentId": creator.creator_agent_id,
        "displayName": creator.display_name,
        "categories": creator.categories,
        "completedDealCount": creator.completed_deal_count,
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


def _write_a2a_task_events(
    repository: KnotRepository,
    *,
    task_id: str,
    negotiation_id: str,
    persisted_messages: Sequence[dict[str, object]],
    final_state: str,
    created_at: str,
) -> None:
    for message_document in persisted_messages:
        sequence = _event_sequence(message_document)
        role = message_document.get("role")
        event_type = "A2A_USER_MESSAGE" if role == "ROLE_USER" else "A2A_AGENT_MESSAGE"
        event_id = f"event-{sequence:04d}-{uuid4()}"
        repository.save_raw_document(
            FirestorePaths.a2a_task_event(task_id, event_id),
            {
                "eventId": event_id,
                "taskId": task_id,
                "negotiationId": negotiation_id,
                "sequence": sequence,
                "type": event_type,
                "messageId": message_document.get("messageId"),
                "role": role,
                "createdAt": created_at,
            },
        )
    terminal_sequence = len(persisted_messages) + 1
    terminal_event_id = f"event-{terminal_sequence:04d}-{uuid4()}"
    repository.save_raw_document(
        FirestorePaths.a2a_task_event(task_id, terminal_event_id),
        {
            "eventId": terminal_event_id,
            "taskId": task_id,
            "negotiationId": negotiation_id,
            "sequence": terminal_sequence,
            "type": "A2A_TASK_STATE",
            "state": final_state,
            "createdAt": created_at,
        },
    )


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


def _match_run_events(
    repository: KnotRepository,
    match_run_id: str,
    *,
    limit: int,
) -> list[dict[str, object]]:
    events = repository.list_raw_documents(
        f"{COLLECTIONS.match_runs}/{match_run_id}/{COLLECTIONS.match_run_events}"
    )
    events.sort(key=_event_sequence)
    return events[:limit]


def _append_match_run_event(
    repository: KnotRepository,
    *,
    match_run_id: str,
    event_type: str,
    status_value: str,
    data: dict[str, object],
) -> None:
    sequence = len(_match_run_events(repository, match_run_id, limit=1000)) + 1
    event_id = f"event-{sequence:04d}-{uuid4()}"
    event = {
        "eventId": event_id,
        "matchRunId": match_run_id,
        "type": event_type,
        "status": status_value,
        "sequence": sequence,
        "data": data,
        "createdAt": _now(),
    }
    repository.save_raw_document(FirestorePaths.match_run_event(match_run_id, event_id), event)


def _event_sequence(event: dict[str, object]) -> int:
    sequence = event.get("sequence")
    return sequence if isinstance(sequence, int) else 0


def _active_match_run_for_promotion(
    repository: KnotRepository,
    promotion_id: str,
) -> dict[str, object] | None:
    for document in repository.query_raw_documents(
        COLLECTIONS.match_runs,
        [DocumentQueryFilter("promotionId", "==", promotion_id)],
        limit=25,
    ):
        if document.get("status") in {
            "READY",
            "QUEUED",
            "DISCOVERING",
            "RANKING",
            "VERIFYING",
            "SELECTING",
            "NEGOTIATING",
            "ESCROW_PREPARING",
            "ESCROW_SUBMITTED",
            "ESCROW_CONFIRMED",
        }:
            return document
    return None


def _match_run_by_idempotency_key(
    repository: KnotRepository,
    *,
    promotion_id: str,
    idempotency_key: str,
) -> dict[str, object] | None:
    for document in repository.query_raw_documents(
        COLLECTIONS.match_runs,
        [
            DocumentQueryFilter("promotionId", "==", promotion_id),
            DocumentQueryFilter("idempotencyKey", "==", idempotency_key),
        ],
        limit=1,
    ):
        return document
    return None


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


def _run_paid_verification(
    *,
    repository: KnotRepository,
    settings: Settings,
    match_run_id: str,
    promotion_id: str,
    selected_creator_agent_id: str | None,
) -> dict[str, object]:
    mode = settings.paysh_mode.lower()
    resource_id = settings.paysh_resource_id
    quote_amount = round(settings.paysh_quote_amount_usdc, 6)
    operation_id = _paysh_operation_id(match_run_id, selected_creator_agent_id, resource_id)
    receipt_id = f"receipt-{operation_id}"
    existing_operation = repository.get_raw_document(FirestorePaths.payment_operation(operation_id))
    if existing_operation is not None:
        stored = existing_operation.get("paidVerification")
        if isinstance(stored, dict):
            return {**stored, "idempotencyReused": True}
    base: dict[str, object] = {
        "provider": "pay.sh",
        "protocol": "x402",
        "purpose": "CANDIDATE_VERIFICATION",
        "mode": mode,
        "resourceId": resource_id,
        "promotionId": promotion_id,
        "matchRunId": match_run_id,
        "selectedCreatorAgentId": selected_creator_agent_id,
        "operationId": operation_id,
        "receiptId": None,
        "quote": {
            "amountUsdc": quote_amount,
            "currency": "USDC",
            "validated": False,
        },
        "spendCap": {
            "perCallUsdc": settings.paysh_max_call_amount_usdc,
            "perRunUsdc": settings.paysh_run_spend_cap_usdc,
            "dailyUsdc": settings.paysh_daily_spend_cap_usdc,
        },
        "allowedResourcePrefixes": settings.paysh_allowed_resource_prefixes,
        "failurePolicy": settings.paysh_failure_policy,
        "nonAuthoritative": True,
    }
    if mode in {"off", "disabled", "local", "none"}:
        return _record_paysh_operation(
            repository,
            operation_id=operation_id,
            result={
                **base,
                "status": "DISABLED",
                "detail": "pay.sh verification is disabled for this environment.",
                "continuation": "FREE_SIGNALS_ONLY",
            },
        )
    if selected_creator_agent_id is None:
        return _record_paysh_operation(
            repository,
            operation_id=operation_id,
            result={
                **base,
                "status": "SKIPPED",
                "detail": "No eligible creator candidate was selected for paid verification.",
                "continuation": "FREE_SIGNALS_ONLY",
            },
        )
    if not resource_id or resource_id == "replace-me":
        return _record_paysh_operation(
            repository,
            operation_id=operation_id,
            result={
                **base,
                "status": "SKIPPED",
                "detail": "PAYSH_RESOURCE_ID is not configured.",
                "continuation": "FREE_SIGNALS_ONLY",
            },
        )
    if mode not in {"sandbox", "live", "production"}:
        return _record_paysh_operation(
            repository,
            operation_id=operation_id,
            result={
                **base,
                "status": "SKIPPED",
                "detail": f"Unsupported PAYSH_MODE: {settings.paysh_mode}.",
                "continuation": "FREE_SIGNALS_ONLY",
            },
        )
    if not _paysh_resource_allowed(settings, resource_id):
        return _record_paysh_operation(
            repository,
            operation_id=operation_id,
            result={
                **base,
                "status": "SKIPPED",
                "detail": "PAYSH_RESOURCE_ID is not allowlisted.",
                "continuation": "FREE_SIGNALS_ONLY",
            },
        )
    cap_problem = _paysh_cap_problem(repository, settings, quote_amount)
    if cap_problem:
        return _record_paysh_operation(
            repository,
            operation_id=operation_id,
            result={
                **base,
                "status": "SKIPPED",
                "detail": cap_problem,
                "continuation": "FREE_SIGNALS_ONLY",
            },
        )

    try:
        result = fetch_paysh(
            resource_id,
            sandbox=mode == "sandbox",
            timeout_seconds=settings.paysh_timeout_seconds,
        )
    except PayCliNotFound as exc:
        return _record_paysh_operation(
            repository,
            operation_id=operation_id,
            result={
                **base,
                "status": "SKIPPED",
                "detail": str(exc),
                "continuation": "FREE_SIGNALS_ONLY",
            },
        )
    except TimeoutExpired:
        return _record_paysh_operation(
            repository,
            operation_id=operation_id,
            receipt_id=receipt_id,
            result={
                **base,
                "status": "FAILED",
                "receiptId": receipt_id,
                "detail": "pay.sh request timed out.",
                "continuation": _paysh_continuation(settings),
            },
        )
    except (OSError, RuntimeError) as exc:
        return _record_paysh_operation(
            repository,
            operation_id=operation_id,
            receipt_id=receipt_id,
            result={
                **base,
                "status": "FAILED",
                "receiptId": receipt_id,
                "detail": _preview_text(str(exc), 240),
                "continuation": _paysh_continuation(settings),
            },
        )

    external_receipt_id = _extract_paysh_receipt_id(result.body)
    status_value = "SETTLED" if result.ok else "FAILED"
    paid_verification = {
        **base,
        "status": status_value,
        "receiptId": receipt_id,
        "externalReceiptId": external_receipt_id,
        "returnCode": result.returncode,
        "responsePreview": _preview_text(result.body, 500),
        "errorPreview": _preview_text(result.stderr, 300) if result.stderr else None,
        "quote": {
            "amountUsdc": quote_amount,
            "currency": "USDC",
            "validated": True,
        },
        "resultDigest": sha256_prefixed(result.body),
        "scoreImpact": {
            "reliabilityFitBefore": None,
            "reliabilityFitAfter": None,
            "selectionChanged": False,
        },
        "continuation": "PAID_SIGNAL_RECORDED" if result.ok else _paysh_continuation(settings),
    }
    return _record_paysh_operation(
        repository,
        operation_id=operation_id,
        receipt_id=receipt_id,
        result=paid_verification,
    )


def _paysh_operation_id(
    match_run_id: str,
    selected_creator_agent_id: str | None,
    resource_id: str,
) -> str:
    operation_key = canonical_json(
        {
            "matchRunId": match_run_id,
            "selectedCreatorAgentId": selected_creator_agent_id,
            "resourceId": resource_id,
            "purpose": "CANDIDATE_VERIFICATION",
        }
    )
    return f"paysh-{uuid5(NAMESPACE_URL, operation_key)}"


def _paysh_resource_allowed(settings: Settings, resource_id: str) -> bool:
    return any(
        resource_id.startswith(prefix)
        for prefix in settings.paysh_allowed_resource_prefixes
    )


def _paysh_cap_problem(
    repository: KnotRepository,
    settings: Settings,
    quote_amount: float,
) -> str | None:
    if quote_amount <= 0:
        return "pay.sh quote amount must be positive."
    if quote_amount > settings.paysh_max_call_amount_usdc:
        return "pay.sh quote exceeds per-call spend cap."
    if quote_amount > settings.paysh_run_spend_cap_usdc:
        return "pay.sh quote exceeds per-run spend cap."
    today_spend = _paysh_settled_spend_today(repository)
    if today_spend + quote_amount > settings.paysh_daily_spend_cap_usdc:
        return "pay.sh quote exceeds daily spend cap."
    return None


def _paysh_settled_spend_today(repository: KnotRepository) -> float:
    today_prefix = _now()[:10]
    total = 0.0
    for operation in repository.list_raw_documents(COLLECTIONS.payment_operations):
        if operation.get("operationType") != "PAYSH_CANDIDATE_VERIFICATION":
            continue
        if str(operation.get("createdAt", ""))[:10] != today_prefix:
            continue
        if operation.get("status") != "SETTLED":
            continue
        amount = operation.get("amountUsdc")
        if isinstance(amount, (int, float)):
            total += float(amount)
    return total


def _paysh_continuation(settings: Settings) -> str:
    if settings.paysh_failure_policy.lower() == "stop":
        return "STOP_MATCH_RUN"
    return "FREE_SIGNALS_ONLY"


def _record_paysh_operation(
    repository: KnotRepository,
    *,
    operation_id: str,
    result: dict[str, object],
    receipt_id: str | None = None,
) -> dict[str, object]:
    now = _now()
    quote = result.get("quote")
    amount_usdc = quote.get("amountUsdc") if isinstance(quote, dict) else None
    operation = {
        "operationId": operation_id,
        "operationType": "PAYSH_CANDIDATE_VERIFICATION",
        "paymentType": "PAYSH_X402",
        "provider": "pay.sh",
        "protocol": "x402",
        "matchRunId": result["matchRunId"],
        "promotionId": result["promotionId"],
        "selectedCreatorAgentId": result["selectedCreatorAgentId"],
        "resourceId": result["resourceId"],
        "receiptId": receipt_id,
        "status": result["status"],
        "amountUsdc": amount_usdc,
        "resultDigest": result.get("resultDigest"),
        "continuation": result.get("continuation"),
        "paidVerification": result,
        "createdAt": now,
    }
    repository.save_raw_document(FirestorePaths.payment_operation(operation_id), operation)
    if receipt_id is not None:
        receipt = {
            "receiptId": receipt_id,
            "paymentOperationId": operation_id,
            "paymentType": "PAYSH_X402",
            "provider": "pay.sh",
            "protocol": "x402",
            "network": f"pay.sh:{result['mode']}",
            "signature": None,
            "explorerUrl": None,
            "externalReceiptId": result.get("externalReceiptId"),
            "status": "CONFIRMED" if result["status"] == "SETTLED" else "FAILED",
            "amountUsdc": amount_usdc,
            "resourceId": result["resourceId"],
            "resultDigest": result.get("resultDigest"),
            "detail": result.get("detail"),
            "createdAt": now,
        }
        repository.save_raw_document(FirestorePaths.transaction_receipt(receipt_id), receipt)
    return result


def _extract_paysh_receipt_id(body: str) -> str | None:
    try:
        parsed = json.loads(body)
    except json.JSONDecodeError:
        return None
    if isinstance(parsed, dict):
        return _find_receipt_value(parsed)
    return None


def _find_receipt_value(payload: dict[str, object]) -> str | None:
    for key in ("receiptId", "receipt_id", "receipt", "id", "paymentId"):
        value = payload.get(key)
        if isinstance(value, str) and value:
            return value
    for value in payload.values():
        if isinstance(value, dict):
            nested = _find_receipt_value(value)
            if nested:
                return nested
    return None


def _preview_text(text: str, limit: int) -> str:
    compact = " ".join(text.split())
    return compact[:limit]


def _find_escrow_by_agreement(
    repository: KnotRepository,
    agreement_id: str,
) -> dict[str, object] | None:
    for document in repository.list_raw_documents(COLLECTIONS.escrows):
        if document.get("agreementId") == agreement_id:
            return document
    return None


def _require_funded_escrow_for_agreement(
    repository: KnotRepository,
    agreement_id: str,
) -> dict[str, object]:
    escrow = _find_escrow_by_agreement(repository, agreement_id)
    if escrow is None or escrow.get("status") != "LOCKED" or not escrow.get("lockSignature"):
        raise _problem(
            status.HTTP_409_CONFLICT,
            "ESCROW_REQUIRED",
            "Evidence can be submitted only after escrow is funded.",
        )
    return escrow


def _find_evidence_for_milestone(
    repository: KnotRepository,
    *,
    agreement_id: str,
    milestone_id: str,
) -> dict[str, object] | None:
    for document in repository.list_raw_documents(COLLECTIONS.evidence):
        if (
            document.get("agreementId") == agreement_id
            and document.get("milestoneId") == milestone_id
        ):
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


def _passed_evidence_for_milestone(
    repository: KnotRepository,
    agreement_id: str,
    milestone_id: str,
) -> dict[str, object] | None:
    for document in repository.list_raw_documents(COLLECTIONS.evidence):
        if (
            document.get("agreementId") == agreement_id
            and document.get("milestoneId") == milestone_id
            and document.get("status") == "PASSED"
        ):
            return document
    return None


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
    milestone_amounts: dict[str, int],
    brand_authority_wallet: str,
    creator_destination_wallet: str,
) -> dict[str, object]:
    if settings.web3_mode != "gateway":
        raise _problem(
            status.HTTP_409_CONFLICT,
            "WEB3_GATEWAY_REQUIRED",
            "Escrow lock requires the restricted Web3 Gateway.",
        )
    try:
        return Web3GatewayClient(settings.web3_gateway_base_url).lock_escrow(
            idempotency_key=idempotency_key,
            payload={
                "agreementId": agreement["agreementId"],
                "escrowId": escrow_id,
                "termsHash": agreement["termsHash"],
                "expectedAmountBaseUnits": str(locked_amount),
                "milestoneIds": list(milestone_amounts.keys()),
                "milestoneAmountsBaseUnits": [
                    str(amount) for amount in milestone_amounts.values()
                ],
                "mint": settings.usdc_mint,
                "programId": settings.escrow_program_id,
                "network": settings.escrow_network,
                "brandAuthority": brand_authority_wallet,
                "creatorDestination": creator_destination_wallet,
                "agentId": agreement["brandAgentId"],
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
    repository: KnotRepository,
    idempotency_key: str,
    escrow: dict[str, object],
    agreement_id: str,
    milestone_id: str,
    amount: int,
) -> dict[str, object]:
    if settings.web3_mode != "gateway":
        raise _problem(
            status.HTTP_409_CONFLICT,
            "WEB3_GATEWAY_REQUIRED",
            "Milestone release requires the restricted Web3 Gateway.",
        )
    lock_context = _lock_context_from_receipt(repository, escrow)
    try:
        payload: dict[str, object] = {
            "agreementId": agreement_id,
            "escrowId": escrow["escrowId"],
            "milestoneId": milestone_id,
            "termsHash": escrow["termsHash"],
            "expectedAmountBaseUnits": str(amount),
            "mint": settings.usdc_mint,
            "programId": settings.escrow_program_id,
            "network": settings.escrow_network,
            "creatorDestination": escrow.get("creatorDestinationWallet")
            or _creator_settlement_wallet(repository, escrow),
        }
        if lock_context:
            payload["lockContext"] = lock_context
        return Web3GatewayClient(settings.web3_gateway_base_url).release_milestone(
            escrow_id=_require_document_str(escrow, "escrowId"),
            milestone_id=milestone_id,
            idempotency_key=idempotency_key,
            payload=payload,
        )
    except Web3GatewayError as exc:
        raise _problem(
            status.HTTP_502_BAD_GATEWAY,
            "WEB3_GATEWAY_UNAVAILABLE",
            f"Web3 gateway release failed: {exc}",
        ) from exc


def _fund_local_wallet(settings: Settings, address: str) -> dict[str, object] | None:
    """로컬 밸리데이터에서만: 연결한 Phantom 지갑에 SOL(+테스트 USDC)을 채운다.

    유저 지갑이 딜 서명 시 에스크로에 직접 예치하려면 수수료용 SOL 과 예치용 USDC 가 필요한데,
    로컬 체인에는 둘 다 없다. 게이트웨이 faucet 은 RPC 가 루프백이 아니면 스스로 거부하므로
    devnet/mainnet 에서는 이 경로가 열리지 않는다.

    편의 기능이라 실패해도 지갑 저장 자체를 깨뜨리지 않는다.
    """
    if settings.local_faucet_sol <= 0:
        return None
    try:
        return Web3GatewayClient(settings.web3_gateway_base_url).airdrop_local(
            address=address,
            sol=settings.local_faucet_sol,
            usdc=settings.local_faucet_usdc,
        )
    except Web3GatewayError as exc:
        return {"error": str(exc)[:200]}


def _require_confirmed_gateway_receipt(
    gateway_receipt: dict[str, object],
    *,
    expected: dict[str, object],
) -> dict[str, object]:
    mismatches = [
        key
        for key, value in expected.items()
        if gateway_receipt.get(key) != value
    ]
    signature = gateway_receipt.get("signature")
    if gateway_receipt.get("status") != "CONFIRMED":
        mismatches.append("status")
    if not isinstance(signature, str) or not signature:
        mismatches.append("signature")
    if mismatches:
        raise _problem(
            status.HTTP_409_CONFLICT,
            "WEB3_RECEIPT_INVALID",
            f"Web3 gateway receipt failed validation: {', '.join(sorted(set(mismatches)))}.",
        )
    return gateway_receipt


def _lock_context_from_receipt(
    repository: KnotRepository,
    escrow: dict[str, object],
) -> dict[str, object] | None:
    receipt = _receipt_by_id(repository, escrow.get("lockReceiptId"))
    if not receipt:
        return None
    gateway_receipt = receipt.get("gatewayReceipt")
    if not isinstance(gateway_receipt, dict):
        return None
    lock_context = gateway_receipt.get("liveContext")
    if not isinstance(lock_context, dict):
        return None
    return cast(dict[str, object], lock_context)


def _failed_receipt(
    receipt_id: str,
    operation_id: str,
    network: str,
    detail: str,
    created_at: str,
) -> dict[str, object]:
    return {
        "receiptId": receipt_id,
        "paymentOperationId": operation_id,
        "network": network,
        "signature": None,
        "explorerUrl": None,
        "status": "FAILED",
        "detail": detail,
        "createdAt": created_at,
    }


def _payload_hash(payload: dict[str, object]) -> str:
    return sha256_prefixed(canonical_json(payload))


def _emit_notification(
    repository: KnotRepository,
    *,
    uid: str,
    kind: str,
    data: dict[str, object],
) -> str:
    """유저 알림 발행(예: BUDGET_LEFTOVER / BUDGET_SHORTFALL / DEAL_NEEDS_APPROVAL).

    top-up 자금흐름(docs/WALLET_AND_MONEY_FLOW.md)에서 정산/한도 결과를 유저에게 전달.
    users/{uid}/notifications/{id} 서브컬렉션에 저장. (트리거 wiring은 정산 라이브 시 연결)
    """
    notification_id = f"notif-{uuid4()}"
    repository.save_raw_document(
        FirestorePaths.user_notification(uid, notification_id),
        {
            "notificationId": notification_id,
            "uid": uid,
            "kind": kind,
            "data": data,
            "read": False,
            "createdAt": _now(),
        },
    )
    return notification_id


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
    receipt: dict[str, object],
    extra: dict[str, object] | None = None,
) -> dict[str, object]:
    """Persist the transaction receipt and PaymentOperation for a settlement action."""
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


def _agent_action_error(action: str, exc: HTTPException) -> dict[str, object]:
    detail = exc.detail if isinstance(exc.detail, dict) else {"detail": str(exc.detail)}
    return {
        "action": action,
        "status": "FAILED",
        "error": detail,
    }


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
