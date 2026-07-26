import json
from collections.abc import Mapping
from pathlib import Path

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
) -> None:
    fixture_root = fixtures_dir or backend_root() / "fixtures"

    users_path = fixture_root / "users.json"
    if users_path.exists():
        for user in load_json_array(users_path):
            repository.save_raw_document(FirestorePaths.user(_require_str(user, "userId")), user)

    for brand in load_json_array(fixture_root / "brands.json"):
        repository.save_raw_document(FirestorePaths.brand(_require_str(brand, "brandId")), brand)

    for agent in load_json_array(fixture_root / "agents.json"):
        repository.save_raw_document(FirestorePaths.agent(_require_str(agent, "agentId")), agent)

    for payload in load_json_array(fixture_root / "creators.json"):
        repository.save_creator_profile(CreatorProfile.model_validate(payload))

    for payload in load_json_array(fixture_root / "agent_policies.json"):
        repository.save_agent_policy(AgentPolicy.model_validate(payload))

    for payload in load_json_array(fixture_root / "promotions.json"):
        repository.save_promotion(Promotion.model_validate(payload))


def _as_document(item: object, path: Path) -> dict[str, object]:
    if not isinstance(item, dict):
        raise ValueError(f"{path} contains a non-object item")
    return dict(item)


def _require_str(document: Mapping[str, object], field_name: str) -> str:
    value = document.get(field_name)
    if not isinstance(value, str) or not value:
        raise ValueError(f"{field_name} must be a non-empty string")
    return value
