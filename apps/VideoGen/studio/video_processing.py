"""Durable local, silent gallery copies. No provider or GPU calls."""
import logging
import math
import os
from pathlib import Path
import re
import subprocess
import threading
import time
from uuid import uuid4

import imageio_ffmpeg
from django.conf import settings
from django.db import close_old_connections
from .models import Job

logger = logging.getLogger(__name__)
_lock = threading.Lock()
_thread = None
PENDING = ['pending', 'processing']


def exists(field):
    return bool(field and field.storage.exists(field.name))


def gallery_file(job):
    if job.processing_status:
        return job.processed_video if job.processing_status == 'ready' and exists(job.processed_video) else None
    return job.video if exists(job.video) else None


def media_data(job):
    available = gallery_file(job)
    source = exists(job.video)
    version = '?v=1200-'+job.processing_info.get('revision','1') if job.processing_status == 'ready' else ''
    return {'video_url': f'/api/creative/videos/{job.pk}/{version}' if available else None,
            'original_url': f'/api/creative/videos/{job.pk}/?original=1' if source else None,
            'download_url': f'/api/creative/videos/{job.pk}/?download=1&v={version[3:] if version else "original"}' if available else None,
            'processing_status': job.processing_status, 'processing_error': job.processing_error,
            'processing_speed': job.processing_speed,
            'processing_info': job.processing_info, 'gallery_ready': bool(available),
            'original_size': job.video.size if source else None}


def probe(path):
    result = subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), '-hide_banner', '-i', str(path)],
                            capture_output=True, timeout=20, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    output = result.stderr.decode('utf-8', errors='replace')
    video = next((line for line in output.splitlines() if 'Video:' in line), '')
    match = re.search(r'[, ](\d{2,5})x(\d{2,5})(?:[ ,\[])', video)
    if not match:
        raise ValueError('Video nema ispravan video zapis.')
    duration = re.search(r'Duration: (\d+):(\d+):(\d+\.\d+)', output)
    return {'width': int(match[1]), 'height': int(match[2]), 'audio': 'Audio:' in output,
            'duration': sum(float(v)*factor for v,factor in zip(duration.groups(),[3600,60,1])) if duration else None}


def transcode(source, destination, speed=1):
    if speed not in [.5,.75,1,1.25,1.5,2]:
        raise ValueError('Odaberi ponuđenu brzinu videa.')
    meta = probe(source)
    scale = min(1, 1200 / max(meta['width'], meta['height']))
    width, height = [max(2, math.floor(meta[key] * scale / 2) * 2) for key in ['width', 'height']]
    # Prilagodi video's balanced compression, bounded for a compact gallery file.
    bitrate = round(max(400000, min(2800000, width * height * 30 * .12 * .65)))
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_suffix('.part.mp4')
    started = time.monotonic()
    try:
        result = subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), '-hide_banner', '-loglevel', 'error',
            '-nostdin', '-y', '-i', str(source), '-map', '0:v:0', '-an', '-sn', '-dn',
            '-vf', f'scale={width}:{height},setsar=1,setpts=(PTS-STARTPTS)/{speed}', '-c:v', 'libx264', '-preset', 'fast',
            '-crf', '25', '-maxrate', str(bitrate), '-bufsize', str(bitrate * 2),
            '-pix_fmt', 'yuv420p', '-threads', '2', '-map_metadata', '-1', '-movflags', '+faststart',
            str(temporary)], capture_output=True, timeout=180,
            creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        if result.returncode or not temporary.exists() or temporary.stat().st_size < 100:
            raise ValueError('Lokalna obrada nije uspjela. Original je sačuvan; pokušaj obradu ponovo.')
        output = probe(temporary)
        if output['audio'] or max(output['width'], output['height']) > 1200:
            raise ValueError('Obrađeni video nije prošao provjeru dimenzija i zvuka.')
        os.replace(temporary, destination)
        return {'max_edge': 1200, 'muted': True, 'width': output['width'], 'height': output['height'],
                'original_bytes': source.stat().st_size, 'processed_bytes': destination.stat().st_size,
                'seconds': round(time.monotonic() - started, 2), 'local': True, 'speed': speed,
                'revision': uuid4().hex, 'duration': output['duration']}
    finally:
        temporary.unlink(missing_ok=True)


def process_one(job_id):
    job = Job.objects.get(pk=job_id)
    if job.status != 'completed' or job.processing_status not in PENDING:
        return
    Job.objects.filter(pk=job.pk).update(processing_status='processing', processing_error='')
    try:
        if not exists(job.video):
            raise ValueError('Izvorni video nije dostupan. Original nije moguće obraditi.')
        name = f'videos/processed/{job.pk}-1200-silent-{uuid4().hex}.mp4'
        info = transcode(Path(job.video.path), Path(settings.MEDIA_ROOT) / name, job.processing_speed)
        Job.objects.filter(pk=job.pk).update(processed_video=name, processing_status='ready',
                                           processing_info=info, processing_error='')
    except Exception:
        logger.exception('Local video processing failed for %s', job.pk)
        Job.objects.filter(pk=job.pk).update(processing_status='failed',
            processing_error='Lokalna obrada nije završena. Original je sačuvan. Pokušaj obradu ponovo; nema Modal troška.')


def _run():
    global _thread
    close_old_connections()
    try:
        while True:
            job_id = Job.objects.filter(status='completed', processing_status__in=PENDING).order_by('created_at').values_list('pk', flat=True).first()
            if not job_id:
                return
            process_one(job_id)
            close_old_connections()
    finally:
        close_old_connections()
        with _lock:
            _thread = None
        # Pick up a job queued between the last query and this thread's exit.
        ensure_runner()


def ensure_runner():
    global _thread
    with _lock:
        if _thread and _thread.is_alive():
            return
        if not Job.objects.filter(status='completed', processing_status__in=PENDING).exists():
            return
        _thread = threading.Thread(target=_run, name='videogen-local-video', daemon=True)
        _thread.start()
