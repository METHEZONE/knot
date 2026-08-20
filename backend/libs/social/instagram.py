from __future__ import annotations

import statistics
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any
from urllib.parse import urlparse

import httpx

DEFAULT_APIFY_INSTAGRAM_PROFILE_ACTOR_ID = "apify~instagram-profile-scraper"


class InstagramProviderError(RuntimeError):
    pass


@dataclass(frozen=True)
class InstagramProfileAnalysis:
    provider: str
    source_url: str
    username: str
    profile: dict[str, object]
    metrics: dict[str, object]
    recent_posts: list[dict[str, object]]
    raw: dict[str, object]
    collected_at: str


class InstagramProfileProvider:
    def __init__(
        self,
        *,
        apify_token: str | None = None,
        actor_id: str = DEFAULT_APIFY_INSTAGRAM_PROFILE_ACTOR_ID,
        timeout_seconds: float = 75.0,
    ) -> None:
        self._apify_token = (apify_token or "").strip()
        self._actor_id = actor_id.strip() or DEFAULT_APIFY_INSTAGRAM_PROFILE_ACTOR_ID
        self._timeout_seconds = timeout_seconds

    @property
    def available(self) -> bool:
        return bool(self._apify_token)

    def analyze_profile(
        self,
        *,
        source_url: str,
        max_posts: int = 12,
    ) -> InstagramProfileAnalysis:
        if not self._apify_token:
            raise InstagramProviderError("APIFY_TOKEN is required for Instagram analysis")
        username = instagram_username_from_url(source_url)
        if not username:
            raise InstagramProviderError("instagram_username_missing")

        payload = {
            "usernames": [username],
            "resultsLimit": max_posts,
            "proxyConfiguration": {"useApifyProxy": True},
        }
        actor_id = self._actor_id.replace("/", "~")
        endpoint = (
            f"https://api.apify.com/v2/actors/{actor_id}/run-sync-get-dataset-items"
        )
        try:
            response = httpx.post(
                endpoint,
                params={"clean": "true", "format": "json"},
                headers={
                    "Authorization": f"Bearer {self._apify_token}",
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
                json=payload,
                timeout=httpx.Timeout(self._timeout_seconds),
            )
        except (httpx.HTTPError, OSError) as exc:
            raise InstagramProviderError("instagram_apify_request_failed") from exc
        if response.status_code >= 400:
            raise InstagramProviderError(f"instagram_apify_http_{response.status_code}")
        try:
            data = response.json()
        except ValueError as exc:
            raise InstagramProviderError("instagram_apify_invalid_json") from exc

        item = _first_profile_item(data)
        if item is None:
            raise InstagramProviderError("instagram_apify_empty_dataset")
        profile = _profile_projection(item, username=username, source_url=source_url)
        recent_posts = _recent_posts(item, max_posts=max_posts)
        metrics = _profile_metrics(profile, recent_posts)
        collected_at = _now()
        return InstagramProfileAnalysis(
            provider="apify-instagram-profile-scraper",
            source_url=source_url,
            username=username,
            profile=profile,
            metrics=metrics,
            recent_posts=recent_posts,
            raw=dict(item),
            collected_at=collected_at,
        )


def instagram_username_from_url(source_url: str) -> str | None:
    parsed = urlparse(source_url)
    host = (parsed.hostname or "").lower()
    if "instagram." not in host:
        return None
    first = parsed.path.strip("/").split("/")[0].strip()
    if not first or first in {"p", "reel", "tv", "explore", "accounts"}:
        return None
    return first.removeprefix("@")


def _first_profile_item(data: object) -> Mapping[str, object] | None:
    if isinstance(data, list):
        for item in data:
            if isinstance(item, Mapping):
                return item
    if isinstance(data, Mapping):
        items = data.get("items")
        if isinstance(items, list):
            for item in items:
                if isinstance(item, Mapping):
                    return item
        return data
    return None


def _profile_projection(
    item: Mapping[str, object],
    *,
    username: str,
    source_url: str,
) -> dict[str, object]:
    resolved_username = _string(
        item.get("username") or item.get("userName") or item.get("handle")
    ) or username
    return {
        "username": resolved_username,
        "displayName": _string(item.get("fullName") or item.get("full_name")),
        "biography": _string(item.get("biography") or item.get("bio")),
        "profileUrl": _string(item.get("url") or item.get("inputUrl")) or source_url,
        "profileImageUrl": _string(
            item.get("profilePicUrlHD")
            or item.get("profilePicUrl")
            or item.get("profile_pic_url")
        ),
        "followersCount": _int(
            item.get("followersCount")
            or item.get("followerCount")
            or item.get("followers")
            or item.get("followers_count")
        ),
        "followingCount": _int(
            item.get("followsCount")
            or item.get("followingCount")
            or item.get("following")
            or item.get("following_count")
        ),
        "postsCount": _int(item.get("postsCount") or item.get("postCount")),
        "isVerified": _bool(item.get("isVerified") or item.get("verified")),
        "isPrivate": _bool(item.get("isPrivate") or item.get("private")),
        "isBusinessAccount": _bool(item.get("isBusinessAccount")),
        "businessCategoryName": _string(item.get("businessCategoryName")),
        "externalUrl": _string(item.get("externalUrl")),
    }


def _recent_posts(item: Mapping[str, object], *, max_posts: int) -> list[dict[str, object]]:
    raw_posts = _list_value(
        item.get("latestPosts")
        or item.get("latestPostsData")
        or item.get("posts")
        or item.get("recentPosts")
    )
    posts: list[dict[str, object]] = []
    for raw in raw_posts:
        if not isinstance(raw, Mapping):
            continue
        post_url = _string(raw.get("url") or raw.get("displayUrl") or raw.get("inputUrl"))
        shortcode = _string(raw.get("shortCode") or raw.get("shortcode"))
        if not post_url and shortcode:
            media_type = _string(raw.get("type") or raw.get("productType")) or "p"
            prefix = "reel" if "reel" in media_type.lower() else "p"
            post_url = f"https://www.instagram.com/{prefix}/{shortcode}/"
        post = {
            "url": post_url,
            "caption": _string(raw.get("caption") or raw.get("description")),
            "publishedAt": _string(
                raw.get("timestamp")
                or raw.get("takenAtIso")
                or raw.get("takenAt")
                or raw.get("publishedAt")
            ),
            "likeCount": _int(raw.get("likesCount") or raw.get("likeCount")),
            "commentCount": _int(raw.get("commentsCount") or raw.get("commentCount")),
            "viewCount": _int(
                raw.get("videoViewCount")
                or raw.get("videoPlayCount")
                or raw.get("viewCount")
            ),
            "mediaType": _string(raw.get("type") or raw.get("productType")),
            "thumbnail": _string(raw.get("displayUrl") or raw.get("thumbnailUrl")),
            "metricType": "PUBLIC_DATA",
        }
        posts.append({key: value for key, value in post.items() if value is not None})
        if len(posts) >= max_posts:
            break
    return posts


def _profile_metrics(
    profile: Mapping[str, object],
    recent_posts: list[dict[str, object]],
) -> dict[str, object]:
    likes = [post["likeCount"] for post in recent_posts if isinstance(post.get("likeCount"), int)]
    comments = [
        post["commentCount"] for post in recent_posts if isinstance(post.get("commentCount"), int)
    ]
    views = [post["viewCount"] for post in recent_posts if isinstance(post.get("viewCount"), int)]
    followers = profile.get("followersCount")
    average_likes = round(statistics.mean(likes)) if likes else None
    average_comments = round(statistics.mean(comments)) if comments else None
    average_views = round(statistics.mean(views)) if views else None
    engagement_rate = None
    if isinstance(followers, int) and followers > 0 and (
        average_likes is not None or average_comments is not None
    ):
        interactions = (average_likes or 0) + (average_comments or 0)
        engagement_rate = round(interactions / followers * 100, 2)
    return {
        "subscriberOrFollowerCount": followers,
        "averageRecentViews": average_views,
        "averageLikes": average_likes,
        "averageComments": average_comments,
        "estimatedEngagementRate": engagement_rate,
        "recentPostCount": len(recent_posts),
        "metricType": "DERIVED",
        "derivedFields": [
            "averageRecentViews",
            "averageLikes",
            "averageComments",
            "estimatedEngagementRate",
        ],
    }


def _string(value: object) -> str | None:
    return value.strip() if isinstance(value, str) and value.strip() else None


def _int(value: object) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int) and value >= 0:
        return value
    if isinstance(value, float) and value >= 0:
        return round(value)
    if isinstance(value, str):
        cleaned = value.replace(",", "").strip()
        if cleaned.isdigit():
            return int(cleaned)
    return None


def _bool(value: object) -> bool | None:
    if isinstance(value, bool):
        return value
    return None


def _list_value(value: object) -> list[Any]:
    return value if isinstance(value, list) else []


def _now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")
