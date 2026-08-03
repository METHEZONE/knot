#!/usr/bin/env python3
"""Create clean local demo accounts through the real Auth/API paths."""

from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request


AUTH_BASE = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1"
API_BASE = "http://127.0.0.1:18080/api/v1"
API_KEY = "demo-local"
PASSWORD = "000000"


ACCOUNTS = [
    {
        "email": "t1@knot.com",
        "role": "BRAND",
        "profile": {
            "brandName": "KNOT Test Brand",
            "websiteUrl": "https://knot.example",
            "categories": ["beauty"],
            "targetAudience": "프로모션별로 설정",
            "description": "로컬 데모용 브랜드 계정입니다.",
            "restrictedClaims": [],
        },
    },
    {
        "email": "c1@knot.com",
        "role": "CREATOR",
        "profile": {
            "creatorName": "KNOT Test Creator",
            "snsUrl": "https://instagram.com/ye__5o",
            "categories": ["beauty"],
            "minimumUsdc": 1,
            "blockedDomains": ["도박", "대출·코인"],
            "preferredContent": ["reel", "short"],
        },
    },
]


def main() -> int:
    for account in ACCOUNTS:
        token = sign_in(account["email"])
        me = api("GET", "/me", token=token)["account"]
        if me.get("onboardingStatus") != "COMPLETED":
            api(
                "POST",
                "/me/role",
                token=token,
                idempotency_key=f"local-role-{account['role'].lower()}",
                payload={"role": account["role"]},
            )
            if account["role"] == "BRAND":
                api(
                    "POST",
                    "/me/brand-profile",
                    token=token,
                    idempotency_key="local-brand-profile",
                    payload=account["profile"],
                )
            else:
                api(
                    "POST",
                    "/me/creator-profile",
                    token=token,
                    idempotency_key="local-creator-profile",
                    payload=account["profile"],
                )
                api("POST", "/creator/agent:publish", token=token)
        print(f"  ✅ {account['email']} / {PASSWORD}")
    return 0


def sign_in(email: str) -> str:
    try:
        data = auth_request(
            "accounts:signInWithPassword",
            {"email": email, "password": PASSWORD, "returnSecureToken": True},
        )
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        if "EMAIL_NOT_FOUND" not in body:
            raise
        data = auth_request(
            "accounts:signUp",
            {"email": email, "password": PASSWORD, "returnSecureToken": True},
        )
    token = data.get("idToken")
    if not isinstance(token, str) or not token:
        raise RuntimeError(f"Auth emulator did not return idToken for {email}")
    return token


def auth_request(path: str, payload: dict[str, object]) -> dict[str, object]:
    return request(
        f"{AUTH_BASE}/{path}?key={API_KEY}",
        method="POST",
        payload=payload,
        headers={"Content-Type": "application/json"},
    )


def api(
    method: str,
    path: str,
    *,
    token: str,
    payload: dict[str, object] | None = None,
    idempotency_key: str | None = None,
) -> dict[str, object]:
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    if idempotency_key:
        headers["Idempotency-Key"] = idempotency_key
    return request(f"{API_BASE}{path}", method=method, payload=payload, headers=headers)["data"]


def request(
    url: str,
    *,
    method: str,
    headers: dict[str, str],
    payload: dict[str, object] | None = None,
) -> dict[str, object]:
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=10) as response:
        return json.loads(response.read().decode("utf-8"))


if __name__ == "__main__":
    sys.exit(main())
