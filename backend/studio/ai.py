from .provider_usage import measure, provider_call
import json
import math
import subprocess
import wave
from uuid import uuid4
from tempfile import TemporaryDirectory
from django.core.files.uploadedfile import UploadedFile
from .billing import paid_access, account, reserve, settle, CreditError
from .transcription import decode_audio
import httpx
from django.conf import settings
from django.http import FileResponse
from tempfile import SpooledTemporaryFile
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from .guest_access import CanEditAsGuest, GuestEditingThrottle
from rest_framework.response import Response

BASE_URL = 'https://api.elevenlabs.io'

def failure(response, capability):
    try:
        detail = response.json().get('detail', {})
    except (ValueError, AttributeError):
        detail = {}
    if not isinstance(detail, dict):
        detail = {}
    code = detail.get('code') or detail.get('status')
    messages = {
        'insufficient_credits': 'Nema dovoljno ElevenLabs kredita.',
        'quota_exceeded': 'Nema dovoljno ElevenLabs kredita.',
        'invalid_api_key': 'ElevenLabs API ključ nije ispravan.',
        'missing_api_key': 'ElevenLabs API ključ nedostaje.',
        'voice_access_denied': 'Odabrani glas nije dostupan ovom računu.',
        'voice_not_found': 'Odabrani glas nije dostupan. Izaberi drugi glas.',
        'subscription_required': 'Funkcija nije uključena u ElevenLabs paket.',
        'feature_not_available': 'Funkcija nije uključena u ElevenLabs paket.',
        'insufficient_permissions': 'ElevenLabs ključ nema potrebnu dozvolu.',
        'missing_permissions': 'ElevenLabs ključ nema dozvolu za ovu funkciju. Provjeri dozvole ključa u ElevenLabs postavkama.',
        'rate_limit_exceeded': 'Servis je zauzet. Pokušaj ponovo za nekoliko sekundi.',
        'concurrent_limit_exceeded': 'Previše paralelnih obrada. Pokušaj ponovo uskoro.',
    }
    error = messages.get(code, f'ElevenLabs nije završio {capability}.')
    if 'free users cannot use library voices' in str(detail.get('message', '')).lower():
        error = 'Odaberi podrazumijevani glas. Voice Library glasovi nisu dostupni kroz API na besplatnom paketu.'
    return Response({'error': error}, status=response.status_code if 400 <= response.status_code < 500 else 502)

def missing_key():
    if not settings.ELEVENLABS_API_KEY:
        return Response({'error': 'ElevenLabs nije povezan. Unesi API ključ u lokalnu .env datoteku.'}, status=503)
    return None

def billing_setup_guard(request):
    # Do not mint provider credentials or spend shared credits for customers
    # until the owner has approved the per-operation token prices.
    if request.user.is_authenticated and not request.user.is_staff and not settings.LOCAL_APP:
        return Response({'error': 'Obračun tokena za AI obradu još se priprema. Uređivanje i spremanje projekata su dostupni.', 'code':'billing_setup_pending'},status=503)
    return None

def json_request(method, path):
    return httpx.request(method, BASE_URL + path, headers={'xi-api-key': settings.ELEVENLABS_API_KEY}, timeout=25)

@api_view(['POST'])
@permission_classes([CanEditAsGuest])
@throttle_classes([GuestEditingThrottle])
def transcribe(request):
    if not request.user.is_staff and not settings.LOCAL_APP:
        missing=missing_key()
        if missing is not None: return missing
        if not request.FILES: return Response({'proxy':True},headers={'Cache-Control':'no-store'})
        from .transcription import transcribe_upload
        return transcribe_upload(request)
    missing = missing_key()
    if missing is not None:
        return missing
    try:
        upstream = provider_call(request, 'elevenlabs', 'transcription_token', lambda: json_request('POST', '/v1/single-use-token/batch_scribe'))
        if not upstream.is_success:
            return failure(upstream, 'transkripciju')
        token = upstream.json().get('token')
        if not token:
            raise ValueError('Missing token')
        return Response({'token': token}, headers={'Cache-Control': 'no-store'})
    except (httpx.HTTPError, ValueError, AttributeError):
        return Response({'error': 'Nije moguće povezati servis za transkripciju.'}, status=502)

def normalize_voice_language(value):
    language = str(value or '').strip().lower().replace('_', '-').split('-')[0]
    return {'bosnian': 'bs', 'bos': 'bs', 'serbian': 'sr', 'srp': 'sr',
            'croatian': 'hr', 'hrv': 'hr', 'albanian': 'sq', 'sqi': 'sq',
            'slovenian': 'sl', 'slovene': 'sl', 'slv': 'sl',
            'english': 'en', 'eng': 'en'}.get(language, language)


@api_view(['GET'])
@permission_classes([CanEditAsGuest])
@throttle_classes([GuestEditingThrottle])
def voices(request):
    missing = missing_key()
    if missing is not None:
        return missing
    try:
        upstream = json_request('GET', '/v2/voices?page_size=100&include_total_count=false')
        if not upstream.is_success:
            return failure(upstream, 'učitavanje glasova')
        result = []
        for voice in upstream.json().get('voices', []):
            if not voice.get('voice_id') or not voice.get('name'):
                continue
            labels = voice.get('labels') or {}
            display_name = {'vqWiQBKWUFE9PhGTnUWX': 'Balkanika - BakeTon',
                            'mXtQi7pFD4lmzz2vg570': 'Balkanika - Okeric'}.get(voice['voice_id'], voice['name'])
            result.append({'id': voice['voice_id'], 'name': display_name, 'gender': labels.get('gender', 'voice'),
                           'language': normalize_voice_language(labels.get('language', '')),
                           'accent': labels.get('accent', ''), 'useCase': labels.get('use_case', ''),
                           'description': voice.get('description') or labels.get('description', ''),
                           'previewUrl': voice.get('preview_url') or ''})
        result.sort(key=lambda voice: (0 if voice['name'].startswith('Balkanika - ') else 1, {'female': 0, 'male': 1}.get(voice['gender'].lower(), 2), voice['name']))
        return Response({'voices': result}, headers={'Cache-Control': 'private, max-age=300'})
    except (httpx.HTTPError, ValueError, TypeError, AttributeError):
        return Response({'error': 'Glasovi trenutno nisu dostupni.'}, status=502)

@api_view(['GET'])
def status(request):
    if not request.user.is_staff:
        return Response({'error': 'Ovi podaci su dostupni samo administratorima.'}, status=403)
    missing = missing_key()
    if missing is not None:
        return missing
    try:
        upstream = json_request('GET', '/v1/user/subscription')
        if not upstream.is_success:
            return failure(upstream, 'provjeru računa')
        data = upstream.json()
        used, limit = max(0, data.get('character_count', 0)), max(0, data.get('character_limit', 0))
        return Response({'tier': data.get('tier', 'unknown'), 'status': data.get('status', 'unknown'),
                         'used': used, 'limit': limit, 'remaining': max(0, limit - used)},
                        headers={'Cache-Control': 'no-store'})
    except (httpx.HTTPError, ValueError, TypeError, AttributeError):
        return Response({'error': 'Stanje ElevenLabs računa trenutno nije dostupno.'}, status=502)

class NarrationInput(serializers.Serializer):
    voiceId = serializers.RegexField(r'^[A-Za-z0-9_-]+$', max_length=100)
    text = serializers.CharField(max_length=10000)
    stability = serializers.FloatField(min_value=0, max_value=1, default=.55)
    similarity = serializers.FloatField(min_value=0, max_value=1, default=.75)
    speed = serializers.FloatField(min_value=.7, max_value=1.2, default=1)

def voice_guard(request):
    if request.user.is_authenticated and not paid_access(request.user):
        return Response({'error':'Generisanje glasa zahtijeva kupljen aktivan Basic paket.','code':'paid_package_required'},status=403)
    return None

def stream_audio(path, capability, billing_request=None, tracking_request=None, **kwargs):
    operation=None;completed=False
    if billing_request is not None and billing_request.user.is_authenticated and not billing_request.user.is_staff and not settings.LOCAL_APP:
        try:
            sub=account(billing_request.user)
            if sub.remaining<1: raise CreditError('Nema dovoljno Edita tokena za glas.')
            operation=reserve(billing_request.user,'glas',sub.remaining,billing_request.headers.get('X-Operation-Id') or uuid4())
        except CreditError as exc: return Response({'error':str(exc)},status=409)
    client = httpx.Client(timeout=httpx.Timeout(300, connect=15), headers={'xi-api-key': settings.ELEVENLABS_API_KEY})
    upstream = None
    audio = SpooledTemporaryFile(max_size=8 * 1024 * 1024)
    tracker = measure(tracking_request or billing_request, 'elevenlabs',
        {'narator':'narration','promjenu glasa':'voice_change','čišćenje govora':'audio_cleanup'}.get(capability,'audio'),
        operation_key=operation.key if operation else None,
        input_chars=len(kwargs.get('json',{}).get('text','')),
        input_bytes=sum(getattr(f,'size',0) for f in (tracking_request or billing_request).FILES.values()) if (tracking_request or billing_request) is not None else 0)
    measured = tracker.__enter__()
    try:
        upstream = client.send(client.build_request('POST', BASE_URL + path, **kwargs), stream=True)
        measured["http_status"] = upstream.status_code
        if not upstream.is_success:
            upstream.read()
            audio.close()
            return failure(upstream, capability)
        # Receive before sending headers so interrupted audio returns a useful error.
        for chunk in upstream.iter_bytes(chunk_size=64 * 1024):
            audio.write(chunk)
            measured["output_bytes"] += len(chunk)
        if not audio.tell():
            audio.close()
            return Response({'error': 'Servis nije vratio zvuk. Pokušaj ponovo.'}, status=502)
        measured["status"] = "success"
        audio.seek(0)
        if operation:
            with TemporaryDirectory(prefix='edita-voice-') as directory:
                _,duration=decode_audio(UploadedFile(file=audio,name='voice.mp3',content_type='audio/mpeg'),directory)
            settle(operation,True,max(1,math.ceil(duration/90)));completed=True
            audio.seek(0)
        response = FileResponse(audio, content_type='audio/mpeg')
        response['Cache-Control'] = 'no-store'
        return response
    except CreditError as exc:
        audio.close()
        return Response({'error':str(exc)},status=409)
    except (httpx.HTTPError, OSError, ValueError, subprocess.TimeoutExpired, wave.Error):
        audio.close()
        return Response({'error': 'Veza sa servisom je prekinuta tokom preuzimanja zvuka. Pokušaj ponovo.'}, status=502)
    finally:
        tracker.__exit__(None, None, None)
        if operation and not completed: settle(operation,False)
        if upstream is not None:
            upstream.close()
        client.close()

@api_view(['POST'])
@permission_classes([CanEditAsGuest])
@throttle_classes([GuestEditingThrottle])
def narration(request):
    blocked=voice_guard(request)
    if blocked is not None: return blocked
    missing = missing_key()
    if missing is not None:
        return missing
    serializer = NarrationInput(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    return stream_audio(f'/v1/text-to-speech/{data["voiceId"]}?output_format=mp3_44100_128', 'narator', billing_request=request, json={
        'text': data['text'], 'model_id': 'eleven_flash_v2_5', 'language_code': 'hr',
        'voice_settings': {'stability': data['stability'], 'similarity_boost': data['similarity'],
                           'speed': data['speed'], 'style': 0, 'use_speaker_boost': True},
    })

@api_view(['POST'])
@permission_classes([CanEditAsGuest])
@throttle_classes([GuestEditingThrottle])
def voice_change(request):
    blocked=voice_guard(request)
    if blocked is not None: return blocked
    missing = missing_key()
    if missing is not None:
        return missing
    voice = serializers.RegexField(r'^[A-Za-z0-9_-]+$', max_length=100).run_validation(request.query_params.get('voiceId'))
    audio = request.FILES.get('audio')
    if not audio or not audio.content_type.startswith('audio/'):
        return Response({'error': 'Pošalji ispravan audio zapis.'}, status=400)
    if not audio.size or audio.size > settings.MAX_UPLOAD_BYTES:
        return Response({'error': 'Audio prelazi dozvoljenu veličinu.'}, status=413)
    try:
        voice_settings = json.loads(request.data.get('voice_settings', '{}'))
        checked = NarrationInput(data={'voiceId': voice, 'text': 'validate',
            'stability': voice_settings.get('stability', .55), 'similarity': voice_settings.get('similarity_boost', .75)})
        checked.is_valid(raise_exception=True)
    except (ValueError, AttributeError, TypeError):
        return Response({'error': 'Postavke glasa nisu ispravne.'}, status=400)
    return stream_audio(f'/v1/speech-to-speech/{voice}?output_format=mp3_44100_128', 'promjenu glasa', billing_request=request,
        files={'audio': (audio.name, audio.file, audio.content_type)}, data={
            'model_id': 'eleven_multilingual_sts_v2', 'remove_background_noise': 'false',
            'voice_settings': json.dumps({'stability': checked.validated_data['stability'],
                'similarity_boost': checked.validated_data['similarity'], 'style': 0, 'use_speaker_boost': True}),
        })

@api_view(['POST'])
@permission_classes([CanEditAsGuest])
@throttle_classes([GuestEditingThrottle])
def clean_audio(request):
    blocked=billing_setup_guard(request)
    if blocked is not None:return blocked
    missing=missing_key()
    if missing is not None:return missing
    audio=request.FILES.get('audio')
    if not audio or not audio.content_type.startswith(('audio/','video/')):
        return Response({'error':'Odaberi audio ili video sa govorom.'},status=400)
    if not audio.size or audio.size>25*1024*1024:
        return Response({'error':'Za čišćenje govora odaberi zvučni zapis do 25 MB.'},status=413)
    return stream_audio('/v1/audio-isolation','čišćenje govora',tracking_request=request,files={'audio':(audio.name,audio.file,audio.content_type)})
