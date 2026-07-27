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
    creator_a2a_mode: str = "local"
    creator_a2a_timeout_seconds: int = 30
    a2a_service_token: str | None = None
    web3_gateway_base_url: str = "http://localhost:8082"
    web3_mode: str = "local"
    repository_backend: str = "memory"
    firestore_project_id: str | None = None
    auth_mode: str = "firebase"
    firebase_project_id: str | None = None
    vertex_ai_location: str = "us-central1"
    gemini_mode: str = "off"
    gemini_model: str = "gemini-2.5-flash"
    paysh_mode: str = "sandbox"
    paysh_resource_id: str = "replace-me"
    paysh_timeout_seconds: int = 90
    escrow_network: str = "solanaDevnet"
    escrow_program_id: str = DEFAULT_ESCROW_PROGRAM_ID
    usdc_mint: str = DEFAULT_USDC_MINT
    agent_wallet_provision: bool = False
    dev_admin_enabled: bool = False
    dev_admin_allowlist: list[str] = []


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
        creator_a2a_mode=os.getenv("KNOT_CREATOR_A2A_MODE", "local"),
        creator_a2a_timeout_seconds=int(os.getenv("CREATOR_A2A_TIMEOUT_SECONDS", "30")),
        a2a_service_token=os.getenv("KNOT_A2A_SERVICE_TOKEN"),
        web3_gateway_base_url=os.getenv("WEB3_GATEWAY_BASE_URL", "http://localhost:8082"),
        web3_mode=os.getenv("KNOT_WEB3_MODE", "local"),
        repository_backend=os.getenv("KNOT_REPOSITORY_BACKEND", "memory"),
        firestore_project_id=os.getenv("GOOGLE_CLOUD_PROJECT") or os.getenv("GCP_PROJECT_ID"),
        auth_mode=os.getenv("KNOT_AUTH_MODE", "firebase"),
        firebase_project_id=(
            os.getenv("FIREBASE_PROJECT_ID")
            or os.getenv("GOOGLE_CLOUD_PROJECT")
            or os.getenv("GCP_PROJECT_ID")
        ),
        vertex_ai_location=os.getenv("VERTEX_AI_LOCATION", "us-central1"),
        gemini_mode=os.getenv("KNOT_GEMINI_MODE", "off"),
        gemini_model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
        paysh_mode=os.getenv("PAYSH_MODE", "sandbox"),
        paysh_resource_id=os.getenv("PAYSH_RESOURCE_ID", "replace-me"),
        paysh_timeout_seconds=int(os.getenv("PAYSH_TIMEOUT_SECONDS", "90")),
        escrow_network=os.getenv("KNOT_ESCROW_NETWORK", "solanaDevnet"),
        escrow_program_id=os.getenv("KNOT_ESCROW_PROGRAM_ID", DEFAULT_ESCROW_PROGRAM_ID),
        agent_wallet_provision=os.getenv("KNOT_AGENT_WALLET_PROVISION", "").lower()
        in ("1", "true", "yes"),
        usdc_mint=os.getenv("KNOT_USDC_MINT", DEFAULT_USDC_MINT),
        dev_admin_enabled=_truthy(os.getenv("KNOT_DEV_ADMIN_ENABLED")),
        dev_admin_allowlist=_csv(os.getenv("KNOT_DEV_ADMIN_ALLOWLIST")),
    )


def _truthy(value: str | None) -> bool:
    return value is not None and value.lower() in {"1", "true", "yes", "on"}


def _csv(value: str | None) -> list[str]:
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]
