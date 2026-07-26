from typing import Any

import httpx

from libs.a2a.models import (
    A2A_VERSION,
    A2AMessage,
    A2ASendConfiguration,
    A2ASendRequest,
    A2ATask,
)


class CreatorA2AClientError(RuntimeError):
    pass


class CreatorA2AClient:
    def __init__(self, base_url: str, *, timeout_seconds: float = 10.0) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds

    def send_message(self, tenant: str, message: A2AMessage) -> A2ATask:
        request = A2ASendRequest(
            tenant=tenant,
            message=message,
            configuration=A2ASendConfiguration(acceptedOutputModes=["application/json"]),
        )
        try:
            with httpx.Client(timeout=self.timeout_seconds) as client:
                response = client.post(
                    f"{self.base_url}/message:send",
                    headers={
                        "A2A-Version": A2A_VERSION,
                        "Content-Type": "application/a2a+json",
                    },
                    json=request.model_dump(by_alias=True, mode="json"),
                )
                response.raise_for_status()
        except httpx.HTTPError as exc:
            raise CreatorA2AClientError(str(exc)) from exc

        body = response.json()
        if not isinstance(body, dict) or not isinstance(body.get("task"), dict):
            raise CreatorA2AClientError("Creator A2A response is missing task")
        return A2ATask.model_validate(body["task"])


def first_part_data(message: A2AMessage | None) -> dict[str, Any]:
    if message is None or not message.parts or message.parts[0].data is None:
        raise CreatorA2AClientError("Creator A2A response is missing message Part.data")
    return message.parts[0].data
