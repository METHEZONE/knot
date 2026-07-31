import json
from collections.abc import Mapping
from pathlib import Path

from libs.a2a.registry import creator_agent_registry_entry
from libs.domain.discovery import build_creator_discovery_projection
from libs.domain.models import AgentPolicy, CreatorProfile, Promotion
from libs.repositories.firestore_paths import FirestorePaths
from libs.repositories.store import KnotRepository


def backend_root() -> Path:
    return Path(__file__).resolve().parents[2]


def load_json_array(path: Path) -> list[dict[str, object]]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, list):
        raise ValueError(f"{path} must contain a JSON array")
    return [_as_document(item, path) for item in raw]


def seed_demo_repository(
    repository: KnotRepository,
    *,
    fixtures_dir: Path | None = None,
    include_business_flow: bool = False,
) -> None:
    fixture_root = fixtures_dir or backend_root() / "fixtures"

    users_path = fixture_root / "users.json"
    if users_path.exists():
        for user in load_json_array(users_path):
            repository.save_raw_document(FirestorePaths.user(_require_str(user, "userId")), user)

    for brand in load_json_array(fixture_root / "brands.json"):
        repository.save_raw_document(FirestorePaths.brand(_require_str(brand, "brandId")), brand)

    agents_by_id: dict[str, dict[str, object]] = {}
    for agent in load_json_array(fixture_root / "agents.json"):
        agents_by_id[_require_str(agent, "agentId")] = agent

    creators: list[CreatorProfile] = []
    for payload in load_json_array(fixture_root / "creators.json"):
        creators.append(CreatorProfile.model_validate(payload))

    for creator in creators:
        creator_agent = agents_by_id.get(creator.creator_agent_id)
        if creator_agent is None:
            continue
        agents_by_id[creator.creator_agent_id] = _seed_creator_agent(creator_agent, creator)

    for stored_agent in agents_by_id.values():
        repository.save_raw_document(
            FirestorePaths.agent(_require_str(stored_agent, "agentId")),
            stored_agent,
        )

    for creator in creators:
        repository.save_creator_profile(creator)
        discovery_agent = agents_by_id.get(creator.creator_agent_id)
        if discovery_agent is None or discovery_agent.get("publicationStatus") != "PUBLISHED":
            continue
        repository.save_raw_document(
            FirestorePaths.creator_discovery_profile(creator.creator_id),
            build_creator_discovery_projection(
                creator,
                discovery_agent,
                updated_at=_require_str(discovery_agent, "updatedAt"),
            ),
        )
        repository.save_raw_document(
            FirestorePaths.agent_registry_entry(creator.creator_agent_id),
            creator_agent_registry_entry(
                discovery_agent,
                updated_at=_require_str(discovery_agent, "updatedAt"),
            ),
        )

    for payload in load_json_array(fixture_root / "agent_policies.json"):
        repository.save_agent_policy(AgentPolicy.model_validate(payload))

    for payload in load_json_array(fixture_root / "promotions.json"):
        promotion = Promotion.model_validate(payload)
        repository.save_promotion(promotion)
        repository.save_raw_document(FirestorePaths.promotion(promotion.promotion_id), payload)

    if include_business_flow:
        raw_fixture_paths = {
            "match_runs.json": FirestorePaths.match_run,
            "negotiations.json": FirestorePaths.negotiation,
            "agreements.json": FirestorePaths.agreement,
            "escrows.json": FirestorePaths.escrow,
            "settlements.json": FirestorePaths.settlement,
        }
        for filename, path_factory in raw_fixture_paths.items():
            path = fixture_root / filename
            if not path.exists():
                continue
            for document in load_json_array(path):
                document_id = _fixture_document_id(document)
                repository.save_raw_document(path_factory(document_id), document)


def _as_document(item: object, path: Path) -> dict[str, object]:
    if not isinstance(item, dict):
        raise ValueError(f"{path} contains a non-object item")
    return dict(item)


def _require_str(document: Mapping[str, object], field_name: str) -> str:
    value = document.get(field_name)
    if not isinstance(value, str) or not value:
        raise ValueError(f"{field_name} must be a non-empty string")
    return value


def _seed_creator_agent(
    agent: Mapping[str, object],
    creator: CreatorProfile,
) -> dict[str, object]:
    publication_status = "PUBLISHED" if creator.active else "DRAFT"
    accepting_offers = creator.active
    if not accepting_offers:
        availability = "UNAVAILABLE"
    elif creator.remaining_capacity > 0:
        availability = "AVAILABLE"
    else:
        availability = "AT_CAPACITY"
    return {
        **agent,
        "status": str(agent.get("status") or "ACTIVE"),
        "publicationStatus": str(agent.get("publicationStatus") or publication_status),
        "acceptingOffers": bool(agent.get("acceptingOffers", accepting_offers)),
        "availability": str(agent.get("availability") or availability),
        "activeNegotiations": _int_value(agent.get("activeNegotiations"), 0),
        "maxConcurrentNegotiations": _int_value(agent.get("maxConcurrentNegotiations"), 1),
        "activeCollaborations": _int_value(agent.get("activeCollaborations"), 0),
        "maxActiveCollaborations": _int_value(agent.get("maxActiveCollaborations"), 1),
    }


def _int_value(value: object, default: int) -> int:
    return value if isinstance(value, int) else default


def _fixture_document_id(document: Mapping[str, object]) -> str:
    for field_name in (
        "settlementId",
        "escrowId",
        "agreementId",
        "negotiationId",
        "matchCandidateId",
        "matchRunId",
    ):
        value = document.get(field_name)
        if isinstance(value, str) and value:
            return value
    raise ValueError("fixture document must include a supported id field")
