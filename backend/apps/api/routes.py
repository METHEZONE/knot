from collections.abc import Sequence
from datetime import UTC, datetime
from typing import cast
from uuid import uuid4

from fastapi import APIRouter, HTTPException, status

from apps.api.schemas import PromotionCreateRequest
from libs.agents.matching import MATCHING_WEIGHTS_VERSION, rank_creators
from libs.domain.models import Promotion
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
        _append_promotion_event(
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
        match_run_id = f"match-{uuid4()}"
        now = _now()
        match_run = {
            "matchRunId": match_run_id,
            "promotionId": promotion.promotion_id,
            "brandAgentId": promotion.brand_agent_id,
            "status": "COMPLETED",
            "weightsVersion": MATCHING_WEIGHTS_VERSION,
            "selectedCreatorAgentId": selected.creator_agent_id if selected else None,
            "createdAt": now,
            "completedAt": now,
        }
        repository.save_raw_document(FirestorePaths.match_run(match_run_id), match_run)
        for candidate in ranked:
            document = candidate.model_dump(by_alias=True, mode="json")
            document["explanation"] = _candidate_explanation(document)
            repository.save_raw_document(
                FirestorePaths.match_candidate(match_run_id, candidate.creator_agent_id),
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
        candidate = repository.get_raw_document(
            FirestorePaths.match_candidate(match_run_id, creator_agent_id)
        )
        if candidate is None:
            raise _not_found("candidate", creator_agent_id)
        if candidate.get("eligible") is not True:
            raise _problem(
                status.HTTP_409_CONFLICT,
                "POLICY_VIOLATION",
                "Cannot select an ineligible creator candidate.",
            )
        match_run["selectedCreatorAgentId"] = creator_agent_id
        match_run["updatedAt"] = _now()
        repository.save_raw_document(match_run_path, match_run)
        return _ok({"matchRun": match_run})

    @router.get("/promotions/{promotion_id}/timeline")
    def get_promotion_timeline(promotion_id: str) -> dict[str, object]:
        _get_promotion(repository, promotion_id)
        events = repository.list_raw_documents(
            f"{COLLECTIONS.promotions}/{promotion_id}/{COLLECTIONS.promotion_events}"
        )
        events.sort(key=lambda item: str(item.get("createdAt", "")))
        return _ok({"events": events})

    return router


def _get_promotion(repository: KnotRepository, promotion_id: str) -> Promotion:
    promotion = repository.get_promotion(promotion_id)
    if promotion is None:
        raise _not_found("promotion", promotion_id)
    return promotion


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
