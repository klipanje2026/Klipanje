"""Cancellable local video preparation (single Django development process)."""
import subprocess
import tempfile
import threading
import time
import re
import atexit
from pathlib import Path
from uuid import UUID

import imageio_ffmpeg
from django.conf import settings
from django.http import FileResponse
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from .guest_access import CanEditAsGuest, GuestEditingThrottle, editor_identity
from rest_framework.response import Response

_conversion_slot = threading.BoundedSemaphore(1)
_jobs = {}
_jobs_lock = threading.Lock()
_processes = set()

@atexit.register
def stop_converters():
    for process in tuple(_processes):
        if process.poll() is None:
            process.terminate()

class PreparationCancelled(Exception):
    pass

def job_for(user, key):
    UUID(key)
    with _jobs_lock:
        now = time.monotonic()
        for old in list(_jobs):
            if now - _jobs[old]['seen'] > 900:
                _jobs.pop(old)['cancel'].set()
        identity = (user, key)
        if identity not in _jobs:
            _jobs[identity] = {'cancel': threading.Event(), 'seen': now, 'state': 'uploading', 'progress': None}
        return _jobs[identity]

def check_job(job):
    if job and (job['cancel'].is_set() or time.monotonic() - job['seen'] > 30):
        raise PreparationCancelled()

def convert_video(source, destination, job=None, *, preview=False, preview_height=720):
    check_job(job)
    executable = imageio_ffmpeg.get_ffmpeg_exe()
    progress = Path(destination).with_suffix('.progress')
    # Preview transcodes are disposable; the default compatibility path retains resolution.
    video_filter = "pad=ceil(iw/2)*2:ceil(ih/2)*2"
    if preview:
        long_side, short_side = (1920, 1080) if preview_height == 1080 else (1280, 720)
        video_filter = f"scale=w='if(gte(iw,ih),min(iw,{long_side}),min(iw,{short_side}))':h='if(gte(iw,ih),min(ih,{short_side}),min(ih,{long_side}))':force_original_aspect_ratio=decrease:force_divisible_by=2"
    command = [executable, '-hide_banner', '-loglevel', 'info', '-nostdin', '-y',
               '-protocol_whitelist', 'file,pipe', '-threads', '4', '-i', str(source),
               '-map', '0:v:0', '-map', '0:a?', '-vf', video_filter,
               '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23' if preview else '20', '-pix_fmt', 'yuv420p', '-threads', '4',
               '-c:a', 'aac', '-b:a', '192k', '-ac', '2', '-progress', str(progress), '-nostats', '-movflags', '+faststart', str(destination)]
    check_job(job)
    with Path(destination).with_suffix('.log').open('w+b') as log:
        process = subprocess.Popen(command, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=log,
                                   creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        _processes.add(process)
        started = time.monotonic()
        try:
            while process.poll() is None:
                check_job(job)
                if time.monotonic() - started > 600:
                    raise subprocess.TimeoutExpired(command, 600)
                if job:
                    duration = re.search(rb'Duration: (\d+):(\d+):(\d+(?:\.\d+)?)', Path(destination).with_suffix('.log').read_bytes())
                    if duration and progress.exists():
                        seconds = float(duration[1])*3600 + float(duration[2])*60 + float(duration[3])
                        positions = re.findall(r'out_time_us=(\d+)', progress.read_text(errors='ignore'))
                        if positions and seconds > 0:
                            job['progress'] = min(99, int(int(positions[-1])/10000/seconds))
                time.sleep(.2)
            check_job(job)
            if process.returncode:
                raise subprocess.CalledProcessError(process.returncode, command)
        finally:
            if process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()
            _processes.discard(process)

class TemporaryVideoResponse(FileResponse):
    def __init__(self, directory, path, filename):
        self.temporary_directory = directory
        super().__init__(open(path, 'rb'), content_type='video/mp4', as_attachment=True, filename=filename)
        self['Cache-Control'] = 'private, no-store'
    def close(self):
        try:
            super().close()
        finally:
            self.temporary_directory.cleanup()

@api_view(['GET', 'DELETE'])
@permission_classes([CanEditAsGuest])
def preparation_status(request, key):
    job = job_for(editor_identity(request), str(key))
    job['seen'] = time.monotonic()
    if request.method == 'DELETE':
        job['cancel'].set()
        job['state'] = 'cancelled'
    response = Response({'state': job['state'], 'progress': job['progress']})
    response['Cache-Control'] = 'no-store'
    return response

@api_view(['POST'])
@permission_classes([CanEditAsGuest])
@throttle_classes([GuestEditingThrottle])
def prepare_video(request):
    preview = request.query_params.get('purpose') == 'editing-preview'
    conversion_options = {'preview': True, 'preview_height': 1080 if request.query_params.get('height') == '1080' else 720} if preview else {}
    job = None
    key = request.query_params.get('job')
    if key:
        try:
            job = job_for(editor_identity(request), key)
        except ValueError:
            return Response({'error': 'Neispravan zahtjev za pripremu.'}, status=400)
    upload = request.FILES.get('file')
    if upload is None or not upload.size:
        return Response({'error': 'Odaberi video za pripremu.'}, status=400)
    if upload.size > settings.MAX_UPLOAD_BYTES:
        return Response({'error': 'Video prelazi dozvoljenu veličinu.'}, status=413)
    if Path(upload.name).suffix.lower() not in {'.mp4', '.mov', '.webm', '.mkv', '.avi', '.m4v'}:
        return Response({'error': 'Odaberi podržanu video datoteku.'}, status=400)
    # A cancelled process releases its slot within one polling interval.
    acquired = _conversion_slot.acquire(timeout=3 if job else 0)
    if preview and job and not acquired:
        deadline = time.monotonic() + 120
        while not acquired and time.monotonic() < deadline:
            try:
                check_job(job)
            except PreparationCancelled:
                return Response({'error': 'Priprema je prekinuta.'}, status=409)
            acquired = _conversion_slot.acquire(timeout=1)
    if not acquired:
        return Response({'error': 'Drugi video se priprema. Sačekaj završetak ili prekini njegovu pripremu.'}, status=429)
    directory = tempfile.TemporaryDirectory(prefix='edita-video-')
    try:
        check_job(job)
        source = Path(directory.name) / ('source' + Path(upload.name).suffix.lower())
        output = Path(directory.name) / ('editing-preview.mp4' if preview else 'compatible.mp4')
        with source.open('wb') as target:
            for chunk in upload.chunks():
                check_job(job)
                target.write(chunk)
        if job:
            job['state'] = 'converting'
            convert_video(source, output, job, **conversion_options)
            job['state'] = 'ready'
            job['progress'] = 100
        else:
            convert_video(source, output, **conversion_options)
        return TemporaryVideoResponse(directory, output, Path(upload.name).stem + '-edita.mp4')
    except PreparationCancelled:
        directory.cleanup()
        if job:
            job['state'] = 'cancelled'
        return Response({'error': 'Priprema je prekinuta.'}, status=409)
    except subprocess.TimeoutExpired:
        directory.cleanup()
        if job:
            job['state'] = 'failed'
        return Response({'error': 'Priprema traje predugo i zaustavljena je. Pokušaj kraći snimak.'}, status=422)
    except (subprocess.CalledProcessError, OSError, RuntimeError):
        directory.cleanup()
        if job:
            job['state'] = 'failed'
        return Response({'error': 'Video nije moguće pripremiti. Provjeri original ili odaberi drugi video.'}, status=422)
    finally:
        _conversion_slot.release()
