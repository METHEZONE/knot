#!/usr/bin/env python3
import argparse
import json
import sys
from pathlib import Path
from typing import Any

backend_root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(backend_root))

from apps.api.repository_factory import _firestore_client  # noqa: E402
from libs.demo_seed.personas import (  # noqa: E402
    CREATOR_SEEDS,
    build_demo_persona_documents,
    document_paths_for_reset,
    validate_demo_persona_documents,
)
from libs.demo_seed.social_providers import (  # noqa: E402
    InstagramProfileProvider,
    SocialProviderError,
    YouTubeProfileProvider,
)
from libs.repositories.firestore_adapter import FirestoreDocumentStore  # noqa: E402
from libs.repositories.store import InMemoryDocumentStore, KnotRepository  # noqa: E402
from libs.settings.config import get_settings  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed KNOT demo brand/creator personas.")
    parser.add_argument("--dry-run", action="store_true", help="Print planned writes only.")
    parser.add_argument("--write", action="store_true", help="Write to configured Firestore.")
    parser.add_argument("--refresh-social", action="store_true", help="Refresh YouTube snapshots.")
    parser.add_argument("--only-brands", action="store_true", help="Only include brand documents.")
    parser.add_argument(
        "--only-creators",
        action="store_true",
        help="Only include creator documents.",
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Delete existing demo persona docs first.",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Print a JSON summary instead of a human-readable report.",
    )
    args = parser.parse_args()

    if args.only_brands and args.only_creators:
        parser.error("--only-brands and --only-creators are mutually exclusive")
    if args.reset and not args.write:
        parser.error("--reset requires --write")
    if not args.write:
        args.dry_run = True

    refreshed = refresh_social_snapshots() if args.refresh_social else {}
    document_set = build_demo_persona_documents(refreshed_snapshots=refreshed)
    documents = filter_documents(
        document_set.documents,
        only_brands=args.only_brands,
        only_creators=args.only_creators,
    )
    errors = validate_demo_persona_documents(document_set)
    summary = {
        "dryRun": args.dry_run,
        "write": args.write,
        "reset": args.reset,
        "brandCount": len(document_set.brand_ids),
        "creatorCount": len(document_set.creator_ids),
        "promotionCount": len(document_set.promotion_ids),
        "documentCount": len(documents),
        "validationErrors": errors,
        "paths": [path for path, _ in documents],
    }
    if errors:
        print_report(summary, json_output=args.json)
        return 1

    if args.write:
        repository, firestore_client = firestore_repository()
        if args.reset:
            for path in document_paths_for_reset(document_set):
                firestore_client.document(path).delete()
        for path, document in documents:
            repository.save_raw_document(path, document)
        summary["written"] = len(documents)
    else:
        repository = KnotRepository(InMemoryDocumentStore())
        for path, document in documents:
            repository.save_raw_document(path, document)
        summary["written"] = 0

    print_report(summary, json_output=args.json)
    return 0


def filter_documents(
    documents: list[tuple[str, dict[str, object]]],
    *,
    only_brands: bool,
    only_creators: bool,
) -> list[tuple[str, dict[str, object]]]:
    if only_brands:
        prefixes = (
            "brands/",
            "promotions/",
            "agents/agent-demo-brand-",
            "agentPolicies/agent-demo-brand-",
        )
        return [(path, doc) for path, doc in documents if path.startswith(prefixes)]
    if only_creators:
        prefixes = (
            "creatorProfiles/",
            "creatorDiscoveryProfiles/",
            "socialSnapshots/",
            "agents/agent-demo-creator-",
            "agentPolicies/agent-demo-creator-",
            "agentRegistry/agent-demo-creator-",
            "analysisJobs/",
        )
        return [(path, doc) for path, doc in documents if path.startswith(prefixes)]
    return documents


def refresh_social_snapshots() -> dict[str, dict[str, object]]:
    youtube = YouTubeProfileProvider()
    instagram = InstagramProfileProvider()
    refreshed: dict[str, dict[str, object]] = {}
    for creator in CREATOR_SEEDS:
        platforms = creator.get("platforms")
        if not isinstance(platforms, dict):
            continue
        youtube_platform = platforms.get("youtube")
        if isinstance(youtube_platform, dict) and isinstance(youtube_platform.get("url"), str):
            try:
                result = youtube.analyze_channel(
                    creator_id=str(creator["creatorId"]),
                    channel_url=str(youtube_platform["url"]),
                    max_videos=10,
                )
            except SocialProviderError as exc:
                print(f"social refresh skipped for {creator['creatorId']}: {exc}", file=sys.stderr)
            else:
                refreshed[str(creator["creatorId"])] = result.snapshot
                continue
        instagram_platform = platforms.get("instagram")
        if isinstance(instagram_platform, dict) and isinstance(instagram_platform.get("url"), str):
            handle = str(instagram_platform["url"]).rstrip("/").split("/")[-1]
            instagram.analyze_profile(username=handle)
    return refreshed


def firestore_repository() -> tuple[KnotRepository, Any]:
    settings = get_settings()
    client = _firestore_client(settings.firestore_project_id)
    return KnotRepository(FirestoreDocumentStore(client)), client


def print_report(summary: dict[str, object], *, json_output: bool) -> None:
    if json_output:
        print(json.dumps(summary, ensure_ascii=False, indent=2))
        return
    print("KNOT demo persona seed")
    print(f"- dryRun: {summary['dryRun']}")
    print(f"- write: {summary['write']}")
    print(f"- reset: {summary['reset']}")
    print(f"- brands: {summary['brandCount']}")
    print(f"- creators: {summary['creatorCount']}")
    print(f"- promotions: {summary['promotionCount']}")
    print(f"- documents: {summary['documentCount']}")
    errors = summary.get("validationErrors")
    if errors:
        print("- validation errors:")
        for error in errors if isinstance(errors, list) else []:
            print(f"  - {error}")
    else:
        print("- validation: ok")
    print("- sample paths:")
    for path in list(summary.get("paths", []))[:20]:
        print(f"  - {path}")


if __name__ == "__main__":
    raise SystemExit(main())
