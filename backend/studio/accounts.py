import json
from django.contrib.auth import authenticate, get_user_model, login, logout, update_session_auth_hash
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST
from .models import LocalAccount


def csrf_failure(request, reason=''):
    return JsonResponse({'error': 'Sesija je istekla. Osvježi stranicu i pokušaj ponovo.'}, status=403)


def user_payload(user):
    if not user.is_authenticated:
        return {'user': None, 'workspaces': []}
    memberships = user.memberships.select_related('workspace').order_by('workspace__created_at')
    return {
        'user': {'id': user.pk, 'username': user.username, 'name': user.first_name or user.username,
                 'isStaff': user.is_staff, 'role': 'admin' if user.is_staff else 'user',
                 'mustChangePassword': LocalAccount.objects.filter(user=user, must_change_password=True).exists()},
        'workspaces': [{'id': str(m.workspace_id), 'name': m.workspace.name, 'role': m.role} for m in memberships],
    }


@never_cache
@ensure_csrf_cookie
@require_GET
def csrf(request):
    return JsonResponse({'csrfToken': get_token(request)})


@never_cache
@require_GET
def me(request):
    return JsonResponse(user_payload(request.user))


@never_cache
@csrf_protect
@require_POST
def sign_in(request):
    try:
        data = json.loads(request.body)
        username, password = data.get('username'), data.get('password')
        if not isinstance(username, str) or not isinstance(password, str):
            raise ValueError()
    except (ValueError, AttributeError, UnicodeDecodeError):
        return JsonResponse({'error': 'Provjeri korisničko ime i lozinku.'}, status=400)
    username = username.strip()
    matches = list(get_user_model().objects.filter(username__iexact=username).values_list('username', flat=True)[:2])
    canonical = matches[0] if len(matches) == 1 else username
    user = authenticate(request, username=canonical, password=password)
    if user is None:
        return JsonResponse({'error': 'Pogrešno korisničko ime ili lozinka.'}, status=401)
    login(request, user)
    return JsonResponse(user_payload(user))


@never_cache
@csrf_protect
@require_POST
def sign_out(request):
    logout(request)
    return JsonResponse({'ok': True})


@never_cache
@csrf_protect
@require_POST
def change_password(request):
    if not request.user.is_authenticated:
        return JsonResponse({'error': 'Prijavi se prije promjene lozinke.'}, status=401)
    try:
        data = json.loads(request.body)
        current, password, confirmation = (data.get(key) for key in ['currentPassword', 'newPassword', 'confirmation'])
        if not all(isinstance(value, str) for value in [current, password, confirmation]):
            raise ValueError()
    except (ValueError, AttributeError, UnicodeDecodeError):
        return JsonResponse({'error': 'Popuni sva polja za lozinku.'}, status=400)
    if not request.user.check_password(current):
        return JsonResponse({'error': 'Trenutna lozinka nije ispravna.'}, status=400)
    if password != confirmation:
        return JsonResponse({'error': 'Nove lozinke se ne podudaraju.'}, status=400)
    if current == password:
        return JsonResponse({'error': 'Odaberi novu lozinku.'}, status=400)
    try:
        validate_password(password, request.user)
    except ValidationError as error:
        return JsonResponse({'error': ' '.join(error.messages)}, status=400)
    request.user.set_password(password)
    request.user.save(update_fields=['password'])
    LocalAccount.objects.filter(user=request.user).update(must_change_password=False)
    update_session_auth_hash(request, request.user)
    return JsonResponse(user_payload(request.user))
