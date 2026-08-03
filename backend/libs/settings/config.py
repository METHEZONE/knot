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
DEFAULT_ESCROW_PROGRAM_ID = "9LjQL46RB4WigamSUmuEehVWF9BLz145Wv4cBxgF4Npn"
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
    secure_fetch_enabled: bool = True
    secure_fetch_timeout_seconds: float = 8.0
    paysh_mode: str = "sandbox"
    paysh_resource_id: str = "replace-me"
    paysh_timeout_seconds: int = 90
    paysh_quote_amount_usdc: float = 0.02
    paysh_max_call_amount_usdc: float = 0.02
    paysh_run_spend_cap_usdc: float = 0.02
    paysh_daily_spend_cap_usdc: float = 1.0
    paysh_allowed_resource_prefixes: list[str] = ["https://debugger.pay.sh/mpp/quote/"]
    paysh_failure_policy: str = "continue"
    escrow_network: str = "solanaDevnet"
    escrow_program_id: str = DEFAULT_ESCROW_PROGRAM_ID
    usdc_mint: str = DEFAULT_USDC_MINT
    settlement_authority: str | None = None
    # 역할 선택 시 유저 임베디드 지갑(플랫폼 커스터디)을 자동 생성한다.
    # → 구글 로그인만으로 Solana 주소를 갖는다. Phantom 연결은 선택 사항이 된다.
    user_wallet_provision: bool = False
    # evidence 검증 통과 즉시 마일스톤 정산을 서버 서명으로 실행한다(사람 클릭 없음).
    # 실패해도 수동 Phantom 릴리즈 경로가 fallback으로 남는다.
    auto_settlement_on_evidence: bool = True
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
        secure_fetch_enabled=_truthy_default_true(os.getenv("KNOT_SECURE_FETCH_ENABLED")),
        secure_fetch_timeout_seconds=float(os.getenv("KNOT_SECURE_FETCH_TIMEOUT_SECONDS", "8")),
        paysh_mode=os.getenv("PAYSH_MODE", "sandbox"),
        paysh_resource_id=os.getenv("PAYSH_RESOURCE_ID", "replace-me"),
        paysh_timeout_seconds=int(os.getenv("PAYSH_TIMEOUT_SECONDS", "90")),
        paysh_quote_amount_usdc=float(os.getenv("PAYSH_QUOTE_AMOUNT_USDC", "0.02")),
        paysh_max_call_amount_usdc=float(os.getenv("PAYSH_MAX_CALL_AMOUNT_USDC", "0.02")),
        paysh_run_spend_cap_usdc=float(os.getenv("PAYSH_RUN_SPEND_CAP_USDC", "0.02")),
        paysh_daily_spend_cap_usdc=float(os.getenv("PAYSH_DAILY_SPEND_CAP_USDC", "1.0")),
        paysh_allowed_resource_prefixes=_csv(
            os.getenv("PAYSH_ALLOWED_RESOURCE_PREFIXES", "https://debugger.pay.sh/mpp/quote/")
        ),
        paysh_failure_policy=os.getenv("PAYSH_FAILURE_POLICY", "continue"),
        escrow_network=os.getenv("KNOT_ESCROW_NETWORK", "solanaDevnet"),
        escrow_program_id=os.getenv("KNOT_ESCROW_PROGRAM_ID", DEFAULT_ESCROW_PROGRAM_ID),
        usdc_mint=os.getenv("KNOT_USDC_MINT", DEFAULT_USDC_MINT),
        settlement_authority=os.getenv("KNOT_SETTLEMENT_AUTHORITY"),
        user_wallet_provision=_truthy(os.getenv("KNOT_USER_WALLET_PROVISION")),
        auto_settlement_on_evidence=_truthy_default_true(
            os.getenv("KNOT_AUTO_SETTLEMENT_ON_EVIDENCE")
        ),
        dev_admin_enabled=_truthy(os.getenv("KNOT_DEV_ADMIN_ENABLED")),
        dev_admin_allowlist=_csv(os.getenv("KNOT_DEV_ADMIN_ALLOWLIST")),
    )


def _truthy(value: str | None) -> bool:
    return value is not None and value.lower() in {"1", "true", "yes", "on"}


def _truthy_default_true(value: str | None) -> bool:
    """미설정이면 켜진 값. 끄려면 명시적으로 0/false/no/off 를 준다."""
    if value is None or not value.strip():
        return True
    return value.lower() in {"1", "true", "yes", "on"}


def _csv(value: str | None) -> list[str]:
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]
