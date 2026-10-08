from django.http import JsonResponse
from .models import LocalAccount


class FirstLoginPasswordMiddleware:
    allowed = {'/api/auth/me', '/api/auth/csrf', '/api/auth/login', '/api/auth/logout', '/api/auth/password', '/api/health'}

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if (request.path.startswith('/api/') and request.path not in self.allowed
                and request.user.is_authenticated
                and LocalAccount.objects.filter(user=request.user, must_change_password=True).exists()):
            return JsonResponse({'error': 'Prije rada postavi svoju novu lozinku.', 'code': 'password_change_required'}, status=403)
        return self.get_response(request)
