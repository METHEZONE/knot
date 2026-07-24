from fastapi import FastAPI, Header, HTTPException

from libs.a2a.agent_card import build_creator_agent_card
from libs.observability.middleware import add_request_context
from libs.settings.config import Settings, get_settings


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings(service_name="knot-creator-agent")
    app = FastAPI(title="KNOT Creator Agent", version=settings.schema_version)
    add_request_context(app, service_name=settings.service_name)

    @app.get("/healthz")
    def healthz() -> dict[str, str]:
        return {"status": "ok", "service": settings.service_name}

    @app.get("/readyz")
    def readyz() -> dict[str, str]:
        return {"status": "ready", "service": settings.service_name}

    @app.get("/version")
    def version() -> dict[str, str]:
        return {
            "service": settings.service_name,
            "gitSha": settings.git_sha,
            "buildTime": settings.build_time,
            "schemaVersion": settings.schema_version,
        }

    @app.get("/a2a/v1/.well-known/agent-card.json")
    def agent_card() -> dict[str, object]:
        return build_creator_agent_card(base_url=settings.creator_agent_base_url)

    @app.post("/a2a/v1/message:send")
    def message_send(
        payload: dict[str, object],
        a2a_version: str | None = Header(default=None, alias="A2A-Version"),
    ) -> dict[str, object]:
        if a2a_version != "1.0":
            raise HTTPException(status_code=400, detail="A2A-Version 1.0 is required")
        return {
            "task": {
                "id": "not-implemented",
                "status": {"state": "TASK_STATE_SUBMITTED"},
                "metadata": {"received": bool(payload)},
            }
        }

    return app


app = create_app()
