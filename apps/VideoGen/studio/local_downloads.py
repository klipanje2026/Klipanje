"""Save a completed video into the directory explicitly selected on this PC."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import threading

from django.conf import settings
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods

from .models import Job
from .video_processing import exists, gallery_file
from .views import api_errors
from .video_names import video_filename

_selection_lock = threading.Lock()
_save_lock = threading.Lock()


def state_path():
    return Path(getattr(settings, 'VIDEOGEN_DOWNLOAD_STATE', settings.BASE_DIR / '.runtime/download-directory.json'))


def directory_state():
    try:
        directory = json.loads(state_path().read_text(encoding='utf-8'))['directory']
        return {'directory': directory, 'available': Path(directory).is_dir()}
    except (OSError, ValueError, KeyError, TypeError):
        return {'directory': '', 'available': False}


def choose_directory(initial):
    # The dialog opens only after the user presses "Odaberi folder".
    script = '''import sys, tkinter as tk
from tkinter import filedialog
root = tk.Tk()
root.withdraw()
root.attributes('-topmost', True)
try:
    folder = filedialog.askdirectory(title='VideoGen - odaberi folder za videe',
        initialdir=sys.argv[1] or None, mustexist=True, parent=root)
    sys.stdout.buffer.write(folder.encode('utf-8'))
finally:
    root.destroy()
'''
    result = subprocess.run([sys.executable, '-c', script, initial], capture_output=True, timeout=180,
                            creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    if result.returncode:
        raise ValueError('Prozor za odabir foldera nije otvoren. Pokušaj ponovo.')
    return result.stdout.decode('utf-8').strip()


def store_directory(directory):
    selected = Path(directory).resolve(strict=True)
    if not selected.is_dir():
        raise ValueError('Odaberi postojeći folder.')
    target = state_path()
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_suffix('.tmp')
    temporary.write_text(json.dumps({'directory': str(selected)}, ensure_ascii=False), encoding='utf-8')
    os.replace(temporary, target)


@require_http_methods(['GET', 'POST'])
@api_errors
def directory(request):
    if request.method == 'GET':
        return JsonResponse(directory_state())
    if not _selection_lock.acquire(blocking=False):
        return JsonResponse({'error': 'Odabir foldera je već otvoren.'}, status=409)
    try:
        selected = choose_directory(directory_state()['directory'])
        if selected:
            store_directory(selected)
        return JsonResponse({**directory_state(), 'cancelled': not bool(selected)})
    except subprocess.TimeoutExpired:
        return JsonResponse({'error': 'Odabir foldera je istekao. Pokušaj ponovo.'}, status=408)
    except OSError:
        return JsonResponse({'error': 'Folder nije dostupan. Odaberi drugi folder.'}, status=400)
    finally:
        _selection_lock.release()


def file_hash(path):
    with path.open('rb') as source:
        return hashlib.file_digest(source, 'sha256').digest()


def copy_video(job, original=False):
    state = directory_state()
    if not state['available']:
        raise ValueError('Prvo odaberi dostupan folder za preuzimanje u Generacijama.')
    field = job.video if original else gallery_file(job)
    if job.status != 'completed' or not exists(field):
        raise ValueError('Video još nije spreman za preuzimanje.')
    selected = Path(state['directory']).resolve(strict=True)
    filename = Path(video_filename(job.title, job.model_id, original=original)).stem
    temporary = None
    try:
        # Finish the copy before exposing its final name. Rename never replaces an existing export.
        with tempfile.NamedTemporaryFile(prefix='.videogen-', suffix='.part', dir=selected, delete=False) as output:
            temporary = Path(output.name)
            digest = hashlib.sha256()
            with field.open('rb') as source:
                for chunk in iter(lambda: source.read(1024 * 1024), b''):
                    output.write(chunk)
                    digest.update(chunk)
            output.flush()
            os.fsync(output.fileno())
        expected_hash = digest.digest()
        with _save_lock:
            for number in range(10000):
                suffix = f' ({number + 1})' if number else ''
                destination = selected / f'{filename}{suffix}.mp4'
                if destination.exists():
                    if destination.is_file() and file_hash(destination) == expected_hash:
                        return {'path': str(destination), 'filename': destination.name, 'already_saved': True}
                    continue
                try:
                    # Windows rename is atomic and fails if another process has created the target.
                    if os.name == 'nt':
                        os.rename(temporary, destination)
                    else:
                        os.link(temporary, destination)
                    return {'path': str(destination), 'filename': destination.name, 'already_saved': False}
                except FileExistsError:
                    continue
        raise ValueError('Nema slobodnog naziva videa u odabranom folderu.')
    except OSError:
        raise ValueError('Video nije spremljen. Provjeri odabrani folder i slobodan prostor pa pokušaj ponovo.') from None
    finally:
        if temporary:
            temporary.unlink(missing_ok=True)


@require_http_methods(['POST'])
@api_errors
def save_video(request, job_id):
    payload = json.loads(request.body or '{}')
    if not isinstance(payload, dict) or set(payload) - {'original', 'revision'}:
        raise ValueError('Neispravan izbor videa.')
    original = payload.get('original', False)
    if type(original) is not bool:
        raise ValueError('Neispravan izbor originala.')
    job = get_object_or_404(Job, pk=job_id)
    if not original and payload.get('revision') != job.processing_info.get('revision'):
        raise ValueError('Obrađena verzija se promijenila. Osvježi prikaz prije preuzimanja.')
    return JsonResponse(copy_video(job, original=original))
