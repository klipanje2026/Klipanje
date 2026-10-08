import httpx
from django.conf import settings
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response


def probe(url, headers):
    try:
        response = httpx.get(url, headers=headers, timeout=20)
        return {'ready': response.is_success, 'status': response.status_code}
    except httpx.HTTPError:
        return {'ready': False, 'status': None}


@api_view(['GET', 'POST'])
@permission_classes([IsAdminUser])
def status(request):
    providers = {
        'openai': {'configured': bool(settings.OPENAI_API_KEY), 'model': settings.OPENAI_MODEL},
        'elevenlabs': {'configured': bool(settings.ELEVENLABS_API_KEY)},
    }
    if request.method == 'POST':
        if providers['openai']['configured']:
            providers['openai'].update(probe(
                f'https://api.openai.com/v1/models/{settings.OPENAI_MODEL}',
                {'Authorization': f'Bearer {settings.OPENAI_API_KEY}'},
            ))
        if providers['elevenlabs']['configured']:
            providers['elevenlabs'].update(probe(
                'https://api.elevenlabs.io/v2/voices?page_size=1&include_total_count=false',
                {'xi-api-key': settings.ELEVENLABS_API_KEY},
            ))
    return Response({'storage': 'local', 'providers': providers}, headers={'Cache-Control': 'no-store'})
