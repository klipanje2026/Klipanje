from .provider_usage import provider_call
from .product_analytics import record_server_event
import re
import math
import subprocess
import wave
from pathlib import Path
from tempfile import TemporaryDirectory
from uuid import UUID
import httpx
from imageio_ffmpeg import get_ffmpeg_exe
from django.conf import settings
from rest_framework.response import Response
from .billing import reserve, settle, CreditError, charge_transfer


def decode_audio(upload, directory):
    source=Path(directory)/'source'
    target=Path(directory)/'audio.wav'
    with source.open('wb') as output:
        for chunk in upload.chunks(): output.write(chunk)
    # Decode the actual audio; never trust duration reported by a browser/container.
    result=subprocess.run([get_ffmpeg_exe(),'-nostdin','-v','info','-protocol_whitelist','file,pipe',
        '-i',str(source),'-map','0:a:0','-vn','-ac','1','-ar','16000','-t','21601',
        '-c:a','pcm_s16le',str(target)],capture_output=True,timeout=600,
        creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
    if result.returncode: raise ValueError('Video nema ispravan zvuk za titlove.')
    with wave.open(str(target),'rb') as audio:
        duration=audio.getnframes()/audio.getframerate()
    metadata=re.search(r'Duration: (\d+):(\d+):(\d+(?:\.\d+)?)',result.stderr.decode('utf-8',errors='replace'))
    if metadata: duration=max(duration,float(metadata[1])*3600+float(metadata[2])*60+float(metadata[3]))
    if duration<=0 or duration>21600: raise ValueError('Podrzano je najvise 6 sati zvuka po obradi.')
    return target,duration


def transcribe_upload(request):
    from .ai import failure
    upload=request.FILES.get('file')
    if not upload or not upload.size or upload.size>settings.MAX_UPLOAD_BYTES:
        return Response({'error':'Ubaci ispravnu video ili audio datoteku.'},status=400)
    try: key=UUID(str(request.data.get('operationId','')))
    except ValueError: return Response({'error':'Nedostaje identifikator obrade.'},status=400)
    operation=None
    completed=False
    try:
        if request.user.is_authenticated:
            charge_transfer(request.user,'upload',upload.size,key)
        with TemporaryDirectory(prefix='edita-transcript-') as directory:
            audio,duration=decode_audio(upload,directory)
            if request.user.is_authenticated:
                operation=reserve(request.user,'titlovi',max(1,math.ceil(duration/60)),key)
            data={'model_id':'scribe_v2','timestamps_granularity':'word','diarize':'false','tag_audio_events':'false'}
            language=request.data.get('language_code')
            if language and language!='auto': data['language_code']=str(language)[:12]
            with wave.open(str(audio), 'rb') as measured_audio:
                audio_seconds = measured_audio.getnframes()/measured_audio.getframerate()
            with audio.open('rb') as stream:
                upstream=provider_call(request, 'elevenlabs', 'transcription', lambda: httpx.post('https://api.elevenlabs.io/v1/speech-to-text',
                    headers={'xi-api-key':settings.ELEVENLABS_API_KEY},
                    files={'file':('audio.wav',stream,'audio/wav')},data=data,timeout=1800), operation_key=key, input_seconds=audio_seconds, input_bytes=audio.stat().st_size)
            if not upstream.is_success: return failure(upstream,'transkripciju')
            result=upstream.json()
            if not isinstance(result,dict) or not (isinstance(result.get('words'),list) or isinstance(result.get('text'),str)):
                raise ValueError('Servis nije vratio ispravne titlove.')
            from django.db import transaction
            from .affiliates import reward_caption_generation
            text=result.get('text') or ' '.join(str(word.get('text','')) for word in result.get('words',[]) if isinstance(word,dict) and word.get('type','word')=='word')
            if operation:
                with transaction.atomic():
                    settle(operation,True)
                    reward_caption_generation(operation,len(re.findall(r"\w+(?:['’-]\w+)*",text)))
            completed=True
            record_server_event(request,"recognition_confirmed",operation.pk if operation else None)
            return Response(result,headers={'Cache-Control':'no-store'})
    except CreditError as exc:
        return Response({'error':str(exc)},status=409)
    except (ValueError,OSError,subprocess.TimeoutExpired,httpx.HTTPError,wave.Error):
        return Response({'error':'Obrada zvuka nije zavrsena. Edita tokeni za ovu obradu nisu potroseni.'},status=502)
    finally:
        if operation and not completed: settle(operation,False)
