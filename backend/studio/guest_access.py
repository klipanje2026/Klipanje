"""Compatibility names for the original renderer; local editing requires login."""
from rest_framework.permissions import BasePermission
from rest_framework.throttling import AnonRateThrottle

class CanEditAsGuest(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user.is_authenticated)

class GuestEditingThrottle(AnonRateThrottle):
    scope = 'guest_editing'
    rate = '30/hour'

def editor_identity(request):
    if request.user.is_authenticated:
        return f'user:{request.user.pk}'
    return 'anonymous'
