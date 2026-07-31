from collections.abc import Mapping

from libs.domain.models import CreatorProfile


def build_creator_discovery_projection(
    creator: CreatorProfile,
    agent: Mapping[str, object],
    *,
    updated_at: str,
) -> dict[str, object]:
    active_negotiations = non_negative_int(agent.get("activeNegotiations"))
    max_negotiations = positive_int(agent.get("maxConcurrentNegotiations"), 1)
    active_collaborations = non_negative_int(agent.get("activeCollaborations"))
    max_collaborations = positive_int(agent.get("maxActiveCollaborations"), 1)
    accepting_offers = bool(agent.get("acceptingOffers"))
    publication_status = str(agent.get("publicationStatus") or "DRAFT")
    availability = str(agent.get("availability") or "UNAVAILABLE")
    capacity_available = (
        accepting_offers
        and publication_status == "PUBLISHED"
        and creator.remaining_capacity > 0
        and active_negotiations < max_negotiations
        and active_collaborations < max_collaborations
    )
    return {
        "creatorId": creator.creator_id,
        "creatorAgentId": creator.creator_agent_id,
        "agentStatus": publication_status,
        "acceptingOffers": accepting_offers,
        "availability": availability,
        "capacityAvailable": capacity_available,
        "categoryKeys": creator.categories,
        "primaryCategoryKey": creator.categories[0] if creator.categories else None,
        "formatKeys": creator.supported_deliverable_formats,
        "primaryFormatKey": (
            creator.supported_deliverable_formats[0]
            if creator.supported_deliverable_formats
            else None
        ),
        "moodIds": [],
        "audienceTags": [],
        "languageKeys": ["ko"],
        "countryCode": "KR",
        "publicRateBand": public_rate_band(creator.rate_card.min_base_usdc),
        "nextAvailableAt": creator.available_from.isoformat(),
        "verifiedDealsCount": creator.completed_deal_count,
        "completionRate": 1.0 if creator.completed_deal_count > 0 else 0.0,
        "onTimeRate": 1.0 if creator.completed_deal_count > 0 else 0.0,
        "cancellationRate": 0.0,
        "profileVersion": 1,
        "taxonomyVersion": 1,
        "embeddingVersion": 0,
        "indexVersion": 1,
        "updatedAt": updated_at,
    }


def public_rate_band(min_base_usdc: int) -> str:
    if min_base_usdc < 250:
        return "under_250"
    if min_base_usdc < 400:
        return "250_400"
    if min_base_usdc < 700:
        return "400_700"
    return "700_plus"


def non_negative_int(value: object) -> int:
    return value if isinstance(value, int) and value >= 0 else 0


def positive_int(value: object, default: int) -> int:
    return value if isinstance(value, int) and value > 0 else default
