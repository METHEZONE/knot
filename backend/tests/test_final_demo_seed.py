import sys
from pathlib import Path

from libs.agents.discovery import (
    DETAIL_READ_LIMIT,
    DISCOVERY_LIMIT,
    _filter_without_composite_index,
    _public_filters,
    _required_format,
    detail_candidates,
    rank_discovery_candidates,
)
from libs.domain.models import Promotion
from libs.repositories.firestore_paths import COLLECTIONS, FirestorePaths
from libs.repositories.store import InMemoryDocumentStore, KnotRepository

SCRIPT_ROOT = Path(__file__).resolve().parents[2] / "scripts"
if str(SCRIPT_ROOT) not in sys.path:
    sys.path.insert(0, str(SCRIPT_ROOT))

import seed_xexymix_final_demo as seed  # noqa: E402

from apps.api.routes import _apply_private_eligibility  # noqa: E402


class SeedArgs:
    brand_uid = seed.BRAND_AUTH_UID
    creator_uid = seed.CREATOR_AUTH_UID
    brand_wallet = seed.base.DEFAULT_BRAND_WALLET
    creator_wallet = seed.base.DEFAULT_CREATOR_WALLET
    creator_count = 30
    amount_usdc = 2
    initial_offer_usdc = 1


def test_final_demo_seed_creates_twenty_detailed_eligible_candidates() -> None:
    args = SeedArgs()
    documents = _build_seed_documents(args)
    repository = _repository_from_documents(documents)
    promotion = Promotion.model_validate(
        documents[FirestorePaths.promotion(seed.xexymix.PROMOTION_ID)]
    )
    top_creator_policy = documents[FirestorePaths.agent_policy(seed.base.CREATOR_AGENT_ID)]
    promotion_document = documents[FirestorePaths.promotion(seed.xexymix.PROMOTION_ID)]
    assert promotion.budget.max_per_creator_usdc == 2
    assert promotion_document["initialOffer"] == 1
    assert top_creator_policy["creator"]["minBaseUsdc"] == 2
    projections = [
        document
        for path, document in documents.items()
        if path.startswith(f"{COLLECTIONS.creator_discovery_profiles}/")
    ]

    filtered = _filter_without_composite_index(
        projections,
        _public_filters(promotion),
        limit=DISCOVERY_LIMIT,
    )
    format_filtered = [
        projection
        for projection in filtered
        if _required_format(promotion) in (projection.get("formatKeys") or [])
    ]
    ranked = rank_discovery_candidates(promotion, format_filtered)
    detailed, detail_reads = detail_candidates(
        repository,
        ranked,
        limit=DETAIL_READ_LIMIT,
    )
    private_ranked = _apply_private_eligibility(promotion, detailed)
    eligible = [candidate for candidate, _ in private_ranked if candidate.eligible]

    assert len(projections) == 30
    assert len(filtered) == 30
    assert len(format_filtered) == 30
    assert len(ranked) == 30
    assert detail_reads == 20
    assert len(detailed) == 20
    assert len(eligible) == 20
    assert private_ranked[0][0].creator_id == seed.base.CREATOR_ID
    assert private_ranked[0][0].creator_agent_id == seed.base.CREATOR_AGENT_ID


def _build_seed_documents(args: SeedArgs) -> dict[str, dict[str, object]]:
    seed._patch_base_ids()
    documents = seed.xexymix.base.build_documents(
        amount_usdc=args.amount_usdc,
        brand_wallet=args.brand_wallet,
        creator_wallet=args.creator_wallet,
    )
    seed.xexymix._apply_xexymix_demo(
        documents,
        args.amount_usdc,
        args.initial_offer_usdc,
    )
    seed._strip_prebuilt_run_documents(documents)
    seed._apply_final_demo_account_ids(documents, args)
    seed._apply_final_demo_promotion(documents, args)
    seed._add_candidate_pool(documents, args)
    return documents


def _repository_from_documents(documents: dict[str, dict[str, object]]) -> KnotRepository:
    store = InMemoryDocumentStore()
    repository = KnotRepository(store)
    for path, document in documents.items():
        repository.save_raw_document(path, document)
    return repository
