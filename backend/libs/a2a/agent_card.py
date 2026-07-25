def build_creator_agent_card(base_url: str) -> dict[str, object]:
    return {
        "name": "KNOT Creator Negotiation Agent",
        "description": "Evaluates and negotiates creator promotion offers.",
        "supportedInterfaces": [
            {
                "url": base_url,
                "protocolBinding": "HTTP+JSON",
                "protocolVersion": "1.0",
                "tenant": "creator-agent-001",
            }
        ],
        "provider": {"organization": "KNOT", "url": "https://knot.example"},
        "version": "1.0.0",
        "capabilities": {
            "streaming": True,
            "pushNotifications": False,
            "extendedAgentCard": False,
        },
        "defaultInputModes": ["application/json"],
        "defaultOutputModes": ["application/json"],
        "skills": [
            {
                "id": "promotion-negotiation",
                "name": "Promotion Negotiation",
                "description": "Returns counter, accept, reject or escalation decisions.",
                "tags": ["creator", "promotion", "negotiation"],
                "inputModes": ["application/json"],
                "outputModes": ["application/json"],
            }
        ],
    }
