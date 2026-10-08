import json
from django.core.cache import cache
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from .models import EditorFailure

KINDS = {'video', 'export', 'repair_video', 'repair_audio', 'repair_export', 'request'}

@require_http_methods(['GET', 'POST'])
def failures(request):
    if request.method == 'GET':
        if not request.user.is_authenticated or not request.user.is_staff:
            return JsonResponse({'error': 'Forbidden'}, status=403)
        rows = EditorFailure.objects.select_related('user').order_by('-created_at')[:100]
        return JsonResponse({'items': [{'id': r.pk, 'kind': r.kind, 'code': r.code, 'at': r.created_at.isoformat(), 'user': r.user.username if r.user else 'Gost'} for r in rows]})
    if len(request.body) > 512:
        return JsonResponse({'error': 'Too large'}, status=413)
    try:
        data = json.loads(request.body)
    except (ValueError, UnicodeDecodeError):
        return JsonResponse({'error': 'Invalid JSON'}, status=400)
    if not isinstance(data, dict) or data.get('kind') not in KINDS:
        return JsonResponse({'error': 'Invalid kind'}, status=400)
    code = data.get('code')
    if code is not None and (type(code) is not int or not 0 <= code <= 999):
        return JsonResponse({'error': 'Invalid code'}, status=400)
    # Bounded reports, without filenames, URLs, transcript or raw exception text.
    key = 'editor-failure:' + str(request.user.pk if request.user.is_authenticated else request.META.get('REMOTE_ADDR', 'guest'))
    if not cache.add(key, True, timeout=30):
        return JsonResponse({'ok': True})
    EditorFailure.objects.create(user=request.user if request.user.is_authenticated else None, kind=data['kind'], code=code)
    return JsonResponse({'ok': True}, status=201)
