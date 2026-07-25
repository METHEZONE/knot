import os
from functools import lru_cache
from pathlib import Path

from pydantic import BaseModel


def _load_dotenv() -> None:
    env_file = Path(__file__).resolve().parents[3] / ".env"
    if not env_file.exists():
        return
    with open(env_file, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, val = line.split("=", 1)
            key = key.strip()
            val = val.strip().strip("'\"")
            if key and key not in os.environ:
                os.environ[key] = val


# Real devnet knot-escrow program id and USDC-SPL mint (see programs/knot-escrow
# and backend/.env.example). Used to stamp escrow/receipt records so they stay
# consistent when on-chain signing is wired.
DEFAULT_ESCROW_PROGRAM_ID = "Aj63B5hLtvJdNQiAi61rMrgfW3pt8Lak3GQB59B6jysj"
DEFAULT_USDC_MINT = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"


class Settings(BaseModel):
    service_name: str = "knot-api"
    git_sha: str = "local"
    build_time: str = "local"
    schema_version: str = "v1"
    creator_agent_base_url: str = "http://localhost:8081/a2a/v1"
    repository_backend: str = "memory"
    firestore_project_id: str | None = None
    escrow_network: str = "solanaDevnet"
    escrow_program_id: str = DEFAULT_ESCROW_PROGRAM_ID
    usdc_mint: str = DEFAULT_USDC_MINT


@lru_cache
def get_settings(service_name: str | None = None) -> Settings:
    _load_dotenv()
    resolved_service_name = service_name or os.getenv("KNOT_SERVICE_NAME") or "knot-api"
    return Settings(
        service_name=resolved_service_name,
        git_sha=os.getenv("GIT_SHA", "local"),
        build_time=os.getenv("BUILD_TIME", "local"),
        creator_agent_base_url=os.getenv(
            "CREATOR_AGENT_BASE_URL", "http://localhost:8081/a2a/v1"
        ),
        repository_backend=os.getenv("KNOT_REPOSITORY_BACKEND", "memory"),
        firestore_project_id=os.getenv("GOOGLE_CLOUD_PROJECT") or os.getenv("GCP_PROJECT_ID"),
        escrow_network=os.getenv("KNOT_ESCROW_NETWORK", "solanaDevnet"),
        escrow_program_id=os.getenv("KNOT_ESCROW_PROGRAM_ID", DEFAULT_ESCROW_PROGRAM_ID),
        usdc_mint=os.getenv("KNOT_USDC_MINT", DEFAULT_USDC_MINT),
    )
