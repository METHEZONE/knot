#!/usr/bin/env python3
"""
Seed extended creator profiles to Firestore for testing agent negotiations.
"""
import sys
from pathlib import Path

# Add backend to path
backend_root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(backend_root))

from libs.repositories.firestore import FirestoreRepository
from libs.repositories.seed import load_json_array, backend_root
from libs.settings.config import from_env
from libs.domain.models import CreatorProfile, AgentPolicy
from libs.repositories.firestore_paths import FirestorePaths
from libs.domain.discovery import build_creator_discovery_projection
from libs.a2a.registry import creator_agent_registry_entry


def seed_extended_creators():
    """Seed extended creator profiles to production Firestore."""
    settings = from_env()
    repository = FirestoreRepository(settings)

    fixture_root = backend_root() / "fixtures"

    # Load extended fixtures
    creators_path = fixture_root / "creators_extended.json"
    agents_path = fixture_root / "agents_extended.json"

    if not creators_path.exists():
        print(f"❌ {creators_path} not found")
        return

    if not agents_path.exists():
        print(f"❌ {agents_path} not found")
        return

    # Load agents
    agents_by_id = {}
    for agent in load_json_array(agents_path):
        agents_by_id[agent["agentId"]] = agent

    # Load and save creators
    creators = []
    for payload in load_json_array(creators_path):
        creators.append(CreatorProfile.model_validate(payload))

    print(f"📦 Loading {len(creators)} creator profiles...")

    for creator in creators:
        creator_agent = agents_by_id.get(creator.creator_agent_id)
        if creator_agent is None:
            print(f"  ⚠️  {creator.creator_id}: no agent found")
            continue

        # Update agent with creator info
        publication_status = "PUBLISHED" if creator.active else "DRAFT"
        accepting_offers = creator.active
        if not accepting_offers:
            availability = "UNAVAILABLE"
        elif creator.remaining_capacity > 0:
            availability = "AVAILABLE"
        else:
            availability = "AT_CAPACITY"

        stored_agent = {
            **creator_agent,
            "status": str(creator_agent.get("status") or "ACTIVE"),
            "publicationStatus": str(creator_agent.get("publicationStatus") or publication_status),
            "acceptingOffers": bool(creator_agent.get("acceptingOffers", accepting_offers)),
            "availability": str(creator_agent.get("availability") or availability),
            "activeNegotiations": int(creator_agent.get("activeNegotiations", 0)),
            "maxConcurrentNegotiations": int(creator_agent.get("maxConcurrentNegotiations", 1)),
            "activeCollaborations": int(creator_agent.get("activeCollaborations", 0)),
            "maxActiveCollaborations": int(creator_agent.get("maxActiveCollaborations", 1)),
        }

        agents_by_id[creator.creator_agent_id] = stored_agent

    # Save agents
    for agent in agents_by_id.values():
        repository.save_raw_document(
            FirestorePaths.agent(agent["agentId"]),
            agent,
        )
        print(f"  ✅ Agent: {agent['agentId']}")

    # Save creators and discovery profiles
    for creator in creators:
        repository.save_creator_profile(creator)
        print(f"  ✅ Creator: {creator.creator_id} ({creator.display_name})")

        discovery_agent = agents_by_id.get(creator.creator_agent_id)
        if discovery_agent is None or discovery_agent.get("publicationStatus") != "PUBLISHED":
            print(f"     (not published, skipping discovery)")
            continue

        # Save discovery profile
        repository.save_raw_document(
            FirestorePaths.creator_discovery_profile(creator.creator_id),
            build_creator_discovery_projection(
                creator,
                discovery_agent,
                updated_at=discovery_agent["updatedAt"],
            ),
        )

        # Save registry entry
        repository.save_raw_document(
            FirestorePaths.agent_registry_entry(creator.creator_agent_id),
            creator_agent_registry_entry(
                discovery_agent,
                updated_at=discovery_agent["updatedAt"],
            ),
        )
        print(f"     (discovery profile + registry entry saved)")

    print(f"\n✅ Seeded {len(creators)} creators successfully!")
    print(f"\n📊 Active creators: {sum(1 for c in creators if c.active)}")
    print(f"📊 Categories: {sorted(set(cat for c in creators for cat in c.categories))}")


if __name__ == "__main__":
    seed_extended_creators()
