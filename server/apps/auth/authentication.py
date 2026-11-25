from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import SAFE_METHODS, BasePermission

from .tokens import AUD_ADMIN, AUD_WEB, verify_access_token


class BearerAuthentication(BaseAuthentication):
    """`Authorization: Bearer <accessToken>` -> request.user = AccessClaims."""

    def authenticate(self, request):
        header = request.headers.get("Authorization", "")
        if not header:
            return None
        if not header.startswith("Bearer "):
            raise AuthenticationFailed("Authentication required")
        claims = verify_access_token(header[7:])
        if claims is None:
            raise AuthenticationFailed("Authentication required")
        return claims, None

    def authenticate_header(self, request):
        return "Bearer"  # makes DRF answer 401 instead of 403 when unauthenticated


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return getattr(request.user, "role", None) == "admin"


class IsAdminAudience(BasePermission):
    """Requires a JWT minted specifically for the admin portal."""

    def has_permission(self, request, view):
        return getattr(request.user, "aud", None) == AUD_ADMIN


class IsWebAudience(BasePermission):
    """Requires a JWT minted for the public web portal."""

    def has_permission(self, request, view):
        return getattr(request.user, "aud", None) == AUD_WEB


class IsAdminForWrites(BasePermission):
    """Read for any authenticated user, write for admins only."""

    def has_permission(self, request, view):
        return request.method in SAFE_METHODS or IsAdmin().has_permission(request, view)


class CanReadMonitor(BasePermission):
    """Requires admin portal JWT audience AND admin/monitor_viewer role."""

    def has_permission(self, request, view):
        return getattr(request.user, "aud", None) == AUD_ADMIN and getattr(
            request.user, "role", None
        ) in {"admin", "monitor_viewer"}
