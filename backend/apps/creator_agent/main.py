from fastapi import FastAPI, Header, HTTPException, Request

from libs.a2a.agent_card import build_creator_agent_card
from libs.a2a.models import A2A_VERSION, A2ASendRequest
from libs.a2a.store import A2ATaskError, InMemoryA2ATaskStore
from libs.agents.demo_context import demo_creator_contexts
from libs.ai.gemini import creator_rationale
from libs.observability.middleware import add_request_context
from libs.settings.config import Settings, get_settings


def create_app(
    settings: Settings | None = None,
    task_store: InMemoryA2ATaskStore | None = None,
) -> FastAPI:
    settings = settings or get_settings(service_name="knot-creator-agent")
    app = FastAPI(title="KNOT Creator Agent", version=settings.schema_version)
    add_request_context(app, service_name=settings.service_name)
    app.state.task_store = task_store or InMemoryA2ATaskStore(
        demo_creator_contexts(),
        rationale_provider=lambda context, payload, decision: creator_rationale(
            settings=settings,
            context=context,
            payload=payload,
            decision=decision,
        ),
    )

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
        request: Request,
        payload: dict[str, object],
        a2a_version: str | None = Header(default=None, alias="A2A-Version"),
        content_type: str | None = Header(default=None, alias="Content-Type"),
    ) -> dict[str, object]:
        _validate_a2a_headers(a2a_version=a2a_version, content_type=content_type)
        send_request = A2ASendRequest.model_validate(payload)
        try:
            task = request.app.state.task_store.send_message(
                send_request.tenant, send_request.message
            )
        except A2ATaskError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc
        return {"task": task.model_dump(by_alias=True, mode="json")}

    @app.post("/a2a/v1/message:stream")
    def message_stream(
        request: Request,
        payload: dict[str, object],
        a2a_version: str | None = Header(default=None, alias="A2A-Version"),
        content_type: str | None = Header(default=None, alias="Content-Type"),
    ) -> dict[str, object]:
        return message_send(request, payload, a2a_version, content_type)

    @app.get("/a2a/v1/tasks")
    def list_tasks(request: Request) -> dict[str, object]:
        tasks = request.app.state.task_store.list_tasks()
        return {"tasks": [task.model_dump(by_alias=True, mode="json") for task in tasks]}

    @app.get("/a2a/v1/tasks/{task_id}")
    def get_task(request: Request, task_id: str) -> dict[str, object]:
        try:
            task = request.app.state.task_store.get_task(task_id)
        except A2ATaskError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        return {"task": task.model_dump(by_alias=True, mode="json")}

    @app.post("/a2a/v1/tasks/{task_id}:subscribe")
    def subscribe_task(request: Request, task_id: str) -> dict[str, object]:
        return get_task(request, task_id)

    @app.post("/a2a/v1/tasks/{task_id}:cancel")
    def cancel_task(request: Request, task_id: str) -> dict[str, object]:
        try:
            task = request.app.state.task_store.cancel_task(task_id)
        except A2ATaskError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        return {"task": task.model_dump(by_alias=True, mode="json")}

    return app


def _validate_a2a_headers(a2a_version: str | None, content_type: str | None) -> None:
    if a2a_version != A2A_VERSION:
        raise HTTPException(status_code=400, detail="A2A-Version 1.0 is required")
    if content_type and not content_type.startswith("application/a2a+json"):
        raise HTTPException(status_code=415, detail="Content-Type application/a2a+json is required")


app = create_app()
