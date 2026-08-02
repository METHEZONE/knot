from typing import cast

import httpx


class Web3GatewayError(RuntimeError):
    pass


class Web3GatewayClient:
    def __init__(self, base_url: str, timeout_seconds: float = 15.0) -> None:
        self._base_url = base_url.rstrip("/")
        self._timeout_seconds = timeout_seconds

    def lock_escrow(
        self,
        *,
        idempotency_key: str,
        payload: dict[str, object],
    ) -> dict[str, object]:
        return self._post(
            "/internal/v1/escrows:lock",
            idempotency_key=idempotency_key,
            payload=payload,
        )

    def release_milestone(
        self,
        *,
        escrow_id: str,
        milestone_id: str,
        idempotency_key: str,
        payload: dict[str, object],
    ) -> dict[str, object]:
        return self._post(
            f"/internal/v1/escrows/{escrow_id}/milestones/{milestone_id}:release",
            idempotency_key=idempotency_key,
            payload=payload,
        )

    def prepare_funding(
        self,
        *,
        idempotency_key: str,
        payload: dict[str, object],
    ) -> dict[str, object]:
        return self._post(
            "/internal/v1/escrows:prepare-funding",
            idempotency_key=idempotency_key,
            payload=payload,
        )

    def confirm_funding(
        self,
        *,
        idempotency_key: str,
        payload: dict[str, object],
    ) -> dict[str, object]:
        return self._post(
            "/internal/v1/escrows:confirm-funding",
            idempotency_key=idempotency_key,
            payload=payload,
        )

    def _post(
        self,
        path: str,
        *,
        idempotency_key: str,
        payload: dict[str, object],
    ) -> dict[str, object]:
        try:
            with httpx.Client(base_url=self._base_url, timeout=self._timeout_seconds) as client:
                response = client.post(
                    path,
                    headers={"Idempotency-Key": idempotency_key},
                    json=payload,
                )
                response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            body = exc.response.text[:500]
            raise Web3GatewayError(
                f"{exc.response.status_code} {exc.response.reason_phrase}: {body}"
            ) from exc
        except httpx.HTTPError as exc:
            raise Web3GatewayError(str(exc)) from exc
        body = response.json()
        if not isinstance(body, dict) or not isinstance(body.get("data"), dict):
            raise Web3GatewayError("Web3 gateway response is missing data")
        return cast(dict[str, object], body["data"])


def receipt_from_gateway(
    *,
    receipt_id: str,
    operation_id: str,
    gateway_receipt: dict[str, object],
    created_at: str,
) -> dict[str, object]:
    return {
        "receiptId": receipt_id,
        "paymentOperationId": operation_id,
        "network": gateway_receipt.get("network"),
        "signature": gateway_receipt.get("signature"),
        "explorerUrl": gateway_receipt.get("explorerUrl"),
        "status": gateway_receipt.get("status"),
        "gatewayReceipt": _json_safe_object(gateway_receipt),
        "createdAt": created_at,
    }


def _json_safe_object(value: dict[str, object]) -> dict[str, object]:
    safe: dict[str, object] = {}
    for key, item in value.items():
        if item is None or isinstance(item, (str, int, float, bool)):
            safe[key] = item
        elif isinstance(item, list):
            safe[key] = item
        elif isinstance(item, dict):
            safe[key] = item
        else:
            safe[key] = str(item)
    return safe
