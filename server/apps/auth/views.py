from django.conf import settings
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import IsAuthenticated

from apps.core.exceptions import AppError
from apps.core.responses import ok
from apps.users import services as users
from apps.users.models import Role
from apps.users.serializers import UserSerializer

from . import tokens
from .authentication import CanReadMonitor, IsAdminAudience
from .serializers import LoginSerializer, RegisterSerializer

COOKIE = "refresh_token"
ADMIN_COOKIE = "admin_refresh_token"
ADMIN_ROLES = {Role.ADMIN, Role.MONITOR_VIEWER}


def _session(user, audience: str = tokens.AUD_WEB) -> dict:
    return {
        "user": UserSerializer(user).data,
        "accessToken": tokens.sign_access_token(user.id, user.role, audience=audience),
    }


def _with_cookie(user, *, status: int = 200, audience: str = tokens.AUD_WEB, cookie: str = COOKIE):
    response = ok(_session(user, audience=audience), status=status)
    response.set_cookie(
        cookie,
        tokens.issue_refresh_token(user.id, audience=audience),
        max_age=settings.REFRESH_TOKEN_TTL,
        httponly=True,
        samesite="Lax",
        secure=settings.COOKIE_SECURE,
        path="/",
    )
    return response


def _validated(serializer_class, data) -> dict:
    serializer = serializer_class(data=data)
    serializer.is_valid(raise_exception=True)
    return serializer.validated_data


@api_view(["POST"])
@authentication_classes([])
def register(request):
    user = users.create_user(**_validated(RegisterSerializer, request.data))
    return _with_cookie(user, status=201, audience=tokens.AUD_WEB, cookie=COOKIE)


@api_view(["POST"])
@authentication_classes([])
def login(request):
    data = _validated(LoginSerializer, request.data)
    user = users.verify_credentials(data["email"], data["password"])
    if user is None:
        raise AppError("INVALID_CREDENTIALS", "Invalid email or password", 401)
    return _with_cookie(user, audience=tokens.AUD_WEB, cookie=COOKIE)


@api_view(["POST"])
@authentication_classes([])
def refresh(request):
    """Refresh tokens are not rotated so that the Next.js BFF /auth/session flow keeps working."""
    raw = request.COOKIES.get(COOKIE)
    user_id = tokens.resolve_refresh_token(raw, audience=tokens.AUD_WEB) if raw else None
    if user_id is None:
        raise AppError.unauthorized("Session expired")
    return ok(_session(users.get_user(user_id), audience=tokens.AUD_WEB))


@api_view(["POST"])
@authentication_classes([])
def logout(request):
    raw = request.COOKIES.get(COOKIE)
    if raw:
        tokens.revoke_refresh_token(raw, audience=tokens.AUD_WEB)
    response = ok({"success": True})
    response.delete_cookie(COOKIE, path="/", samesite="Lax")
    return response


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    return ok(UserSerializer(users.get_user(request.user.user_id)).data)


@api_view(["POST"])
@authentication_classes([])
def admin_login(request):
    data = _validated(LoginSerializer, request.data)
    user = users.verify_credentials(data["email"], data["password"])
    if user is None:
        raise AppError("INVALID_CREDENTIALS", "Invalid email or password", 401)
    if user.role not in ADMIN_ROLES:
        raise AppError("ADMIN_ACCESS_REQUIRED", "Admin or monitor viewer role required", 403)
    return _with_cookie(user, audience=tokens.AUD_ADMIN, cookie=ADMIN_COOKIE)


@api_view(["POST"])
@authentication_classes([])
def admin_refresh(request):
    raw = request.COOKIES.get(ADMIN_COOKIE)
    user_id = tokens.resolve_refresh_token(raw, audience=tokens.AUD_ADMIN) if raw else None
    if user_id is None:
        raise AppError.unauthorized("Session expired")
    user = users.get_user(user_id)
    if user.role not in ADMIN_ROLES:
        raise AppError("ADMIN_ACCESS_REQUIRED", "Admin or monitor viewer role required", 403)
    return ok(_session(user, audience=tokens.AUD_ADMIN))


@api_view(["POST"])
@authentication_classes([])
def admin_logout(request):
    raw = request.COOKIES.get(ADMIN_COOKIE)
    if raw:
        tokens.revoke_refresh_token(raw, audience=tokens.AUD_ADMIN)
    response = ok({"success": True})
    response.delete_cookie(ADMIN_COOKIE, path="/", samesite="Lax")
    return response


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsAdminAudience, CanReadMonitor])
def admin_me(request):
    return ok(UserSerializer(users.get_user(request.user.user_id)).data)
