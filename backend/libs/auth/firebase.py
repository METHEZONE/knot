import base64
import json
from dataclasses import dataclass
from typing import Any

from libs.settings.config import Settings


class AuthError(ValueError):
    pass


@dataclass(frozen=True)
class AuthenticatedUser:
    uid: str
    email: str | None = None
    display_name: str | None = None
    photo_url: str | None = None
    claims: dict[str, Any] | None = None


class FirebaseTokenVerifier:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def verify_authorization_header(self, authorization: str | None) -> AuthenticatedUser:
        if not authorization:
            raise AuthError("Missing Authorization bearer token.")
        scheme, _, token = authorization.partition(" ")
        if scheme.lower() != "bearer" or not token:
            raise AuthError("Authorization header must use Bearer token.")
        return self.verify_token(token)

    def verify_token(self, token: str) -> AuthenticatedUser:
        mode = self.settings.auth_mode.lower()
        if mode == "emulator":
            return _user_from_claims(_decode_unsigned_jwt_payload(token))
        if mode != "firebase":
            raise AuthError(f"Unsupported auth mode: {self.settings.auth_mode}")
        return _user_from_claims(self._verify_firebase_admin(token))

    def _verify_firebase_admin(self, token: str) -> dict[str, Any]:
        try:
            import firebase_admin
            from firebase_admin import auth, credentials
        except ImportError as exc:
            raise AuthError("firebase-admin is not installed.") from exc

        if not firebase_admin._apps:
            project_id = self.settings.firebase_project_id
            if project_id:
                firebase_admin.initialize_app(
                    credentials.ApplicationDefault(),
                    {"projectId": project_id},
                )
            else:
                firebase_admin.initialize_app()
        try:
            return auth.verify_id_token(token, check_revoked=True)
        except Exception as exc:
            raise AuthError("Invalid Firebase ID token.") from exc


def _decode_unsigned_jwt_payload(token: str) -> dict[str, Any]:
    parts = token.split(".")
    if len(parts) < 2:
        raise AuthError("Invalid emulator token format.")
    payload = parts[1]
    padded = payload + "=" * (-len(payload) % 4)
    try:
        decoded = base64.urlsafe_b64decode(padded.encode("ascii"))
        claims = json.loads(decoded.decode("utf-8"))
    except (ValueError, json.JSONDecodeError) as exc:
        raise AuthError("Invalid emulator token payload.") from exc
    if not isinstance(claims, dict):
        raise AuthError("Invalid emulator token claims.")
    return claims


def _user_from_claims(claims: dict[str, Any]) -> AuthenticatedUser:
    uid = claims.get("uid") or claims.get("user_id") or claims.get("sub")
    if not isinstance(uid, str) or not uid.strip():
        raise AuthError("Firebase token is missing uid.")
    email = claims.get("email")
    display_name = claims.get("name")
    photo_url = claims.get("picture")
    return AuthenticatedUser(
        uid=uid.strip(),
        email=email if isinstance(email, str) else None,
        display_name=display_name if isinstance(display_name, str) else None,
        photo_url=photo_url if isinstance(photo_url, str) else None,
        claims=claims,
    )
