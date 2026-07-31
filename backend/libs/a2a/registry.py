from collections.abc import Mapping


def creator_agent_registry_entry(
    agent: Mapping[str, object],
    *,
    updated_at: str,
) -> dict[str, object]:
    agent_id = _required_str(agent, "agentId")
    return {
        "agentId": agent_id,
        "agentType": "CREATOR",
        "ownerId": agent.get("ownerId"),
        "ownerUid": agent.get("ownerUid"),
        "service": agent.get("service") or "knot-creator-agent",
        "status": agent.get("status") or "ACTIVE",
        "publicationStatus": agent.get("publicationStatus") or "DRAFT",
        "a2aEndpoint": agent.get("a2aEndpoint") or "/a2a/v1",
        "protocolBinding": "HTTP+JSON",
        "protocolVersion": "1.0",
        "tenant": agent_id,
        "skillIds": ["promotion-negotiation", "sponsorship-negotiation"],
        "inputModes": ["application/json"],
        "outputModes": ["application/json"],
        "updatedAt": updated_at,
    }


def _required_str(document: Mapping[str, object], field_name: str) -> str:
    value = document.get(field_name)
    if not isinstance(value, str) or not value:
        raise ValueError(f"{field_name} must be a non-empty string")
    return value
