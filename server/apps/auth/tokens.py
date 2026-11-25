import hashlib
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import jwt
from django.conf import settings
from django.utils import timezone

from .models import RefreshToken

AUD_WEB = "web"
AUD_ADMIN = "admin"


@dataclass(frozen=True)
class AccessClaims:
    user_id: str
    role: str
    aud: str = AUD_WEB
    is_authenticated: bool = True  # lets DRF's IsAuthenticated treat this as request.user


def sign_access_token(user_id: str, role: str, audience: str = AUD_WEB) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "role": role,
        "aud": audience,
        "iat": now,
        "exp": now + timedelta(seconds=settings.ACCESS_TOKEN_TTL),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")


def verify_access_token(token: str) -> AccessClaims | None:
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
    except jwt.PyJWTError:
        return None
    sub = payload.get("sub")
    if not sub:
        return None
    aud = payload.get("aud", AUD_WEB)
    if aud not in {AUD_WEB, AUD_ADMIN}:
        return None
    return AccessClaims(user_id=sub, role=payload.get("role", "user"), aud=aud)


def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def issue_refresh_token(user_id, audience: str = AUD_WEB) -> str:
    token = secrets.token_urlsafe(32)
    RefreshToken.objects.create(
        user_id=user_id,
        token_hash=_sha256(token),
        audience=audience,
        expires_at=timezone.now() + timedelta(seconds=settings.REFRESH_TOKEN_TTL),
    )
    return token


def resolve_refresh_token(token: str, audience: str = AUD_WEB):
    """Returns the owner's user id for a non-expired token in the matching audience."""
    row = RefreshToken.objects.filter(
        token_hash=_sha256(token),
        audience=audience,
        expires_at__gt=timezone.now(),
    ).first()
    return row.user_id if row else None


def revoke_refresh_token(token: str, audience: str | None = None) -> None:
    qs = RefreshToken.objects.filter(token_hash=_sha256(token))
    if audience is not None:
        qs = qs.filter(audience=audience)
    qs.delete()
