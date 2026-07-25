import argparse
import sys
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = REPO_ROOT / "backend"
sys.path.insert(0, str(BACKEND_ROOT))


def main() -> int:
    parser = argparse.ArgumentParser(description="Run KNOT Product API integration smoke.")
    parser.add_argument("--base-url", help="Optional live API base URL, for example http://localhost:8080.")
    args = parser.parse_args()

    client = _http_client(args.base_url)
    _assert_ok(client.get("/healthz"))
    version = _assert_ok(client.get("/version"))
    promotion = _assert_ok(client.get("/api/v1/promotions/promotion-001"))["data"]["promotion"]
    match_run = _assert_ok(
        client.post(f"/api/v1/promotions/{promotion['promotionId']}/matches:run")
    )["data"]["matchRun"]
    candidates = _assert_ok(client.get(f"/api/v1/match-runs/{match_run['matchRunId']}/candidates"))[
        "data"
    ]["candidates"]
    negotiation_body = _assert_ok(
        client.post(f"/api/v1/match-runs/{match_run['matchRunId']}:start-negotiation")
    )["data"]
    agreement = negotiation_body["agreement"]
    if agreement is None:
        raise SystemExit("Negotiation did not produce an Agreement.")

    evidence = _assert_ok(
        client.post(
            f"/api/v1/agreements/{agreement['agreementId']}/evidence",
            json={
                "url": "https://social.example/post/with-brand-and-ad",
                "submittedByAgentId": agreement["creatorAgentId"],
                "milestoneId": "content",
            },
        )
    )["data"]["evidence"]
    verified = _assert_ok(client.post(f"/api/v1/evidence/{evidence['evidenceId']}:verify"))[
        "data"
    ]["evidence"]
    timeline = _assert_ok(client.get(f"/api/v1/promotions/{promotion['promotionId']}/timeline"))[
        "data"
    ]["events"]
    audit_events = _assert_ok(
        client.get(f"/api/v1/audit-events?promotionId={promotion['promotionId']}&limit=20")
    )["data"]["events"]

    print("api smoke passed.")
    print(f"service={version['service']}")
    print(f"promotion={promotion['promotionId']}")
    print(f"matchRun={match_run['matchRunId']}")
    print(f"topCandidate={candidates[0]['creatorAgentId']}")
    print(f"agreement={agreement['agreementId']}")
    print(f"evidence={verified['evidenceId']}:{verified['status']}")
    print(f"timelineEvents={len(timeline)}")
    print(f"auditEvents={len(audit_events)}")
    return 0


def _http_client(base_url: str | None) -> Any:
    if base_url:
        import httpx

        return httpx.Client(base_url=base_url.rstrip("/"), timeout=20)

    from apps.api.main import create_app
    from fastapi.testclient import TestClient
    from libs.repositories.seed import seed_demo_repository
    from libs.repositories.store import InMemoryDocumentStore, KnotRepository

    store = InMemoryDocumentStore()
    repository = KnotRepository(store)
    seed_demo_repository(repository)
    return TestClient(create_app(repository=repository))


def _assert_ok(response: Any) -> dict[str, Any]:
    if response.status_code >= 400:
        raise SystemExit(f"{response.request.method} {response.request.url} failed: {response.text}")
    return response.json()


if __name__ == "__main__":
    raise SystemExit(main())
