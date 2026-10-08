"""Staging uses the ordinary account login; CI may read pages with its existing key."""
import base64
import hmac
from pathlib import Path
from django.conf import settings
from django.http import JsonResponse, HttpResponseRedirect


def review_access(request):
    if request.method not in ('GET', 'HEAD') or request.path.startswith('/api/') and request.path != '/api/health':
        return False
    try:
        scheme, value = request.headers.get('Authorization', '').split(' ', 1)
        if scheme.lower() != 'basic':
            return False
        username, password = base64.b64decode(value, validate=True).decode().split(':', 1)
        stored_user, hashed = (Path(settings.BASE_DIR).parent / '.htpasswd').read_text().strip().split(':', 1)
        # The hosting Python 3.11 provides the same SHA-512 crypt scheme as Apache.
        import crypt
        return hmac.compare_digest(username, stored_user) and hmac.compare_digest(crypt.crypt(password, hashed) or '', hashed)
    except (ValueError, UnicodeError, OSError, ImportError):
        return False


class StagingAccessMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Existing signed-in testers may link a provider. Anonymous social login
        # stays closed, so OAuth cannot provision new staging accounts.
        if request.path == '/api/auth/register' or (
            request.path.startswith('/api/auth/social/') and not request.user.is_authenticated
        ):
            return JsonResponse({'error': 'Staging koristi postojeće testne račune.'}, status=403)
        login_paths = {'/login', '/login/', '/api/auth/csrf', '/api/auth/login', '/api/auth/logout', '/api/auth/me'}
        if request.path in login_paths or request.user.is_authenticated or review_access(request):
            return self.get_response(request)
        if request.path.startswith('/api/'):
            return JsonResponse({'error': 'Prijavi se u staging postojećim Edita računom.'}, status=403)
        return HttpResponseRedirect('/login')
