import os
import statistics
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import UTC, datetime
from urllib.parse import urlparse

import httpx

from libs.social.instagram import (
    InstagramProfileProvider as ApifyInstagramProfileProvider,
)
from libs.social.instagram import (
    InstagramProviderError,
)


class SocialProviderError(RuntimeError):
    pass


@dataclass(frozen=True)
class YouTubeChannelAnalysis:
    snapshot_id: str
    snapshot: dict[str, object]


class YouTubeProfileProvider:
    def __init__(self, api_key: str | None = None, *, timeout_seconds: float = 10.0) -> None:
        self._api_key = api_key or os.getenv("YOUTUBE_API_KEY")
        self._timeout_seconds = timeout_seconds

    @property
    def available(self) -> bool:
        return bool(self._api_key)

    def analyze_channel(
        self,
        *,
        creator_id: str,
        channel_url: str,
        max_videos: int = 10,
    ) -> YouTubeChannelAnalysis:
        if not self._api_key:
            raise SocialProviderError("YOUTUBE_API_KEY is required for YouTube refresh")
        channel_id = self._resolve_channel_id(channel_url)
        channel = self._youtube_get(
            "channels",
            {
                "part": "snippet,statistics,contentDetails",
                "id": channel_id,
                "maxResults": "1",
            },
        )
        items = _items(channel)
        if not items:
            raise SocialProviderError(f"YouTube channel not found: {channel_url}")
        channel_item = items[0]
        uploads_playlist = (
            channel_item.get("contentDetails", {})
            .get("relatedPlaylists", {})
            .get("uploads")
        )
        recent_videos = self._recent_videos(str(uploads_playlist), max_videos=max_videos)
        metrics = _youtube_metrics(channel_item, recent_videos)
        collected_at = _now()
        snapshot = {
            "snapshotId": f"snapshot-{creator_id}",
            "provider": "youtube-data-api-v3",
            "sourceUrl": channel_url,
            "source": {
                "platform": "youtube",
                "url": channel_url,
                "collectedAt": collected_at,
                "provenance": "PUBLIC_DATA",
            },
            "observed": {
                "displayName": _snippet(channel_item).get("title"),
                "description": _snippet(channel_item).get("description"),
                "thumbnailUrl": _thumbnail_url(_snippet(channel_item)),
                "metrics": metrics,
                "recentVideos": recent_videos,
            },
            "normalizedPlatforms": {
                "youtube": {
                    "channelId": channel_id,
                    "url": channel_url,
                    "subscriberCount": metrics.get("subscriberOrFollowerCount"),
                    "averageRecentViews": metrics.get("averageRecentViews"),
                }
            },
            "raw": {"channel": channel_item, "recentVideos": recent_videos},
            "createdAt": collected_at,
            "updatedAt": collected_at,
        }
        return YouTubeChannelAnalysis(snapshot_id=str(snapshot["snapshotId"]), snapshot=snapshot)

    def _resolve_channel_id(self, channel_url: str) -> str:
        parsed = urlparse(channel_url)
        path = parsed.path.strip("/")
        if path.startswith("channel/"):
            return path.split("/", 1)[1]
        if path.startswith("@"):
            response = self._youtube_get(
                "channels",
                {"part": "id", "forHandle": path.removeprefix("@"), "maxResults": "1"},
            )
            items = _items(response)
            if items:
                return str(items[0]["id"])
        raise SocialProviderError(
            "Only channelId URLs and @handle URLs resolvable by YouTube Data API are supported"
        )

    def _recent_videos(self, uploads_playlist: str, *, max_videos: int) -> list[dict[str, object]]:
        if not uploads_playlist:
            return []
        playlist = self._youtube_get(
            "playlistItems",
            {
                "part": "snippet,contentDetails",
                "playlistId": uploads_playlist,
                "maxResults": str(max_videos),
            },
        )
        video_ids = [
            str(item.get("contentDetails", {}).get("videoId"))
            for item in _items(playlist)
            if item.get("contentDetails", {}).get("videoId")
        ]
        if not video_ids:
            return []
        videos = self._youtube_get(
            "videos",
            {
                "part": "snippet,statistics,contentDetails",
                "id": ",".join(video_ids),
                "maxResults": str(max_videos),
            },
        )
        return [_video_projection(item) for item in _items(videos)]

    def _youtube_get(self, resource: str, params: Mapping[str, str]) -> dict[str, object]:
        url = f"https://www.googleapis.com/youtube/v3/{resource}"
        query = {**params, "key": self._api_key}
        with httpx.Client(timeout=self._timeout_seconds) as client:
            response = client.get(url, params=query)
            response.raise_for_status()
            data = response.json()
        if not isinstance(data, dict):
            raise SocialProviderError(f"Unexpected YouTube response for {resource}")
        return data


def analyze_youtube_creator(
    channel_url: str,
    *,
    creator_id: str = "creator-demo-import-preview",
    max_videos: int = 10,
    api_key: str | None = None,
) -> dict[str, object]:
    analysis = YouTubeProfileProvider(api_key=api_key).analyze_channel(
        creator_id=creator_id,
        channel_url=channel_url,
        max_videos=max_videos,
    )
    snapshot = analysis.snapshot
    return {
        "creatorId": creator_id,
        "platform": "youtube",
        "channel": snapshot.get("normalizedPlatforms", {}).get("youtube", {}),
        "metrics": snapshot.get("observed", {}).get("metrics", {}),
        "contentProfile": {
            "provenance": "AI_DERIVED",
            "status": "PENDING_GEMINI_ANALYSIS",
        },
        "matchingProfile": {
            "sourceSnapshotId": analysis.snapshot_id,
            "status": "READY_FOR_NORMALIZATION",
        },
        "snapshot": snapshot,
    }


class InstagramProfileProvider:
    def __init__(self, *, provider: str | None = None, token: str | None = None) -> None:
        self.provider = provider or os.getenv("INSTAGRAM_PROVIDER", "fixture")
        self.token = token or os.getenv("APIFY_TOKEN") or os.getenv("META_ACCESS_TOKEN")

    @property
    def available(self) -> bool:
        return self.provider != "fixture" and bool(self.token)

    def analyze_profile(self, *, username: str) -> dict[str, object]:
        if not self.available:
            return {
                "provider": "instagram-fixture-fallback",
                "status": "UNRESOLVED",
                "username": username,
                "detail": "No APIFY_TOKEN or META_ACCESS_TOKEN configured.",
            }
        if self.provider != "apify":
            raise SocialProviderError(f"unsupported Instagram provider: {self.provider}")
        try:
            analysis = ApifyInstagramProfileProvider(apify_token=self.token).analyze_profile(
                source_url=f"https://www.instagram.com/{username}/",
                max_posts=12,
            )
        except InstagramProviderError as exc:
            raise SocialProviderError(str(exc)) from exc
        return {
            "snapshotId": f"snapshot-instagram-{username}",
            "provider": analysis.provider,
            "sourceUrl": analysis.source_url,
            "source": {
                "platform": "instagram",
                "url": analysis.source_url,
                "collectedAt": analysis.collected_at,
                "provenance": "PUBLIC_DATA",
            },
            "observed": {
                "displayName": analysis.profile.get("displayName"),
                "description": analysis.profile.get("biography"),
                "thumbnailUrl": analysis.profile.get("profileImageUrl"),
                "metrics": analysis.metrics,
                "recentPosts": analysis.recent_posts,
            },
            "normalizedPlatforms": {
                "instagram": {
                    "handle": f"@{analysis.username}",
                    "url": analysis.profile.get("profileUrl") or analysis.source_url,
                    "followerCount": analysis.profile.get("followersCount"),
                    "averageRecentViews": analysis.metrics.get("averageRecentViews"),
                }
            },
            "raw": analysis.raw,
            "createdAt": analysis.collected_at,
            "updatedAt": analysis.collected_at,
        }


def _youtube_metrics(
    channel_item: Mapping[str, object],
    recent_videos: list[dict[str, object]],
) -> dict[str, object]:
    stats = channel_item.get("statistics", {})
    if not isinstance(stats, Mapping):
        stats = {}
    views = [item["viewCount"] for item in recent_videos if isinstance(item.get("viewCount"), int)]
    likes = [item["likeCount"] for item in recent_videos if isinstance(item.get("likeCount"), int)]
    comments = [
        item["commentCount"] for item in recent_videos if isinstance(item.get("commentCount"), int)
    ]
    subscriber_count = _int(stats.get("subscriberCount"))
    average_views = round(statistics.mean(views)) if views else None
    median_views = round(statistics.median(views)) if views else None
    return {
        "subscriberOrFollowerCount": subscriber_count,
        "totalViewCount": _int(stats.get("viewCount")),
        "videoCount": _int(stats.get("videoCount")),
        "recentVideoCount": len(recent_videos),
        "averageRecentViews": average_views,
        "medianRecentViews": median_views,
        "maxRecentViews": max(views) if views else None,
        "minRecentViews": min(views) if views else None,
        "averageLikes": round(statistics.mean(likes)) if likes else None,
        "averageComments": round(statistics.mean(comments)) if comments else None,
        "viewSubscriberRatio": (
            round(average_views / subscriber_count, 6)
            if average_views is not None and subscriber_count
            else None
        ),
        "derivedFields": [
            "averageRecentViews",
            "medianRecentViews",
            "maxRecentViews",
            "minRecentViews",
            "averageLikes",
            "averageComments",
            "viewSubscriberRatio",
        ],
        "metricType": "DERIVED",
    }


def _items(response: Mapping[str, object]) -> list[Mapping[str, object]]:
    items = response.get("items")
    if not isinstance(items, list):
        return []
    return [item for item in items if isinstance(item, Mapping)]


def _snippet(item: Mapping[str, object]) -> Mapping[str, object]:
    snippet = item.get("snippet")
    return snippet if isinstance(snippet, Mapping) else {}


def _thumbnail_url(snippet: Mapping[str, object]) -> str | None:
    thumbnails = snippet.get("thumbnails")
    if not isinstance(thumbnails, Mapping):
        return None
    for key in ("high", "medium", "default"):
        item = thumbnails.get(key)
        if isinstance(item, Mapping) and isinstance(item.get("url"), str):
            return str(item["url"])
    return None


def _video_projection(item: Mapping[str, object]) -> dict[str, object]:
    snippet = _snippet(item)
    stats = item.get("statistics", {})
    if not isinstance(stats, Mapping):
        stats = {}
    return {
        "videoId": item.get("id"),
        "title": snippet.get("title"),
        "description": snippet.get("description"),
        "publishedAt": snippet.get("publishedAt"),
        "thumbnail": _thumbnail_url(snippet),
        "viewCount": _int(stats.get("viewCount")),
        "likeCount": _int(stats.get("likeCount")),
        "commentCount": _int(stats.get("commentCount")),
        "metricType": "PUBLIC_DATA",
    }


def _int(value: object) -> int | None:
    if isinstance(value, int):
        return value
    if isinstance(value, str) and value.isdigit():
        return int(value)
    return None


def _now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")
