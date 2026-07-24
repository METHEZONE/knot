import os
from functools import lru_cache

from pydantic import BaseModel


class Settings(BaseModel):
    service_name: str = "knot-api"
    git_sha: str = "local"
    build_time: str = "local"
    schema_version: str = "v1"
    creator_agent_base_url: str = "http://localhost:8081/a2a/v1"


@lru_cache
def get_settings(service_name: str | None = None) -> Settings:
    resolved_service_name = service_name or os.getenv("KNOT_SERVICE_NAME") or "knot-api"
    return Settings(
        service_name=resolved_service_name,
        git_sha=os.getenv("GIT_SHA", "local"),
        build_time=os.getenv("BUILD_TIME", "local"),
        creator_agent_base_url=os.getenv(
            "CREATOR_AGENT_BASE_URL", "http://localhost:8081/a2a/v1"
        ),
    )
