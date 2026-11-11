"""Local, disposable audio trimming; never modifies the source asset."""
import io
import math
import subprocess
import tempfile
import threading
from pathlib import Path

import imageio_ffmpeg
from django.http import FileResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

_slot = threading.BoundedSemaphore(1)
EXTENSIONS = {'.wav', '.mp3', '.ogg', '.m4a', '.aac', '.flac', '.webm', '.opus'}


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def trim_audio(request):
    upload = request.FILES.get('file')
    if not upload or Path(upload.name).suffix.lower() not in EXTENSIONS:
        return Response({'error': 'Odaberi WAV, MP3, OGG, M4A, AAC, FLAC, WebM ili Opus zvuk.'}, status=400)
    if not 0 < upload.size <= 200 * 1024 * 1024:
        return Response({'error': 'Zvuk mora biti manji od 200 MB i ne smije biti prazan.'}, status=413)
    try:
        start, end = float(request.data['start']), float(request.data['end'])
        bitrate = int(request.data.get('bitrate', 128))
        if not (math.isfinite(start) and math.isfinite(end) and 0 <= start < end <= 86400 and end-start <= 3600 and bitrate in (96, 128, 192)):
            raise ValueError
    except (KeyError, ValueError, TypeError, OverflowError):
        return Response({'error': 'Provjeri početak, kraj i kvalitet. Odabrani dio može trajati najviše sat vremena.'}, status=400)
    if not _slot.acquire(blocking=False):
        return Response({'error': 'Obrada zvuka je u toku. Pokušaj ponovo za trenutak.'}, status=429)
    try:
        with tempfile.TemporaryDirectory(prefix='klipanje-audio-') as folder:
            source = Path(folder) / ('source' + Path(upload.name).suffix.lower())
            target = Path(folder) / 'trimmed.mp3'
            with source.open('wb') as handle:
                for chunk in upload.chunks():
                    handle.write(chunk)
            subprocess.run([
                imageio_ffmpeg.get_ffmpeg_exe(), '-hide_banner', '-loglevel', 'error', '-nostdin', '-y',
                '-protocol_whitelist', 'file,pipe', '-threads', '2', '-i', str(source),
                '-ss', str(start), '-t', str(end-start), '-map', '0:a:0', '-vn', '-map_metadata', '-1',
                '-c:a', 'libmp3lame', '-b:a', f'{bitrate}k', '-ar', '44100', '-ac', '2', str(target),
            ], stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE,
                timeout=180, check=True, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
            if target.stat().st_size < 1024:
                raise ValueError('Empty selection')
            result = io.BytesIO(target.read_bytes())
        response = FileResponse(result, content_type='audio/mpeg', as_attachment=True, filename='prilagodjeni-zvuk.mp3')
        response['Cache-Control'] = 'private, no-store'
        return response
    except subprocess.TimeoutExpired:
        return Response({'error': 'Obrada traje predugo. Izaberi kraći dio.'}, status=408)
    except (subprocess.CalledProcessError, ValueError):
        return Response({'error': 'Nije moguće obraditi taj dio zvuka. Provjeri datoteku i odabrano vrijeme.'}, status=400)
    except OSError:
        return Response({'error': 'Lokalna obrada zvuka trenutno nije dostupna.'}, status=503)
    finally:
        _slot.release()
