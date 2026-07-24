from fastapi import FastAPI

from libs.observability.middleware import add_request_context
from libs.settings.config import Settings, get_settings


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    app = FastAPI(title="KNOT API", version=settings.schema_version)
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

    @app.get("/api/v1")
    def api_root() -> dict[str, object]:
        return {"data": {"service": settings.service_name}, "meta": {"schemaVersion": "v1"}}

    return app


app = create_app()
