from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request, Response


def add_request_context(app: FastAPI, service_name: str) -> None:
    @app.middleware("http")
    async def request_context(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        response = await call_next(request)
        response.headers["X-KNOT-Service"] = service_name
        return response
