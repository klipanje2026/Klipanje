"""Private EffectCraft exports to a directory selected on this computer."""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import threading
import unicodedata

from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_http_methods, require_POST

_selection_lock = threading.Lock()
_state_lock = threading.Lock()
_save_lock = threading.Lock()


def state_path():
    return Path(getattr(settings, 'EFFECTCRAFT_DIRECTORY_STATE',
                        settings.BASE_DIR.parent / '.local/effectcraft-download-directories.json'))


def read_state():
    try:
        value = json.loads(state_path().read_text(encoding='utf-8'))
        return value if isinstance(value, dict) else {}
    except (OSError, ValueError):
        return {}


def directory_state(owner):
    directory = read_state().get(str(owner), '')
    if not isinstance(directory, str):
        directory = ''
    return {'directory': directory, 'available': bool(directory) and Path(directory).is_dir()}


def store_directory(owner, directory):
    selected = Path(directory).resolve(strict=True)
    if not selected.is_dir():
        raise ValueError('Odaberi postojeći folder.')
    with _state_lock:
        state = read_state()
        state[str(owner)] = str(selected)
        target = state_path()
        target.parent.mkdir(parents=True, exist_ok=True)
        temporary = target.with_suffix('.tmp')
        temporary.write_text(json.dumps(state, ensure_ascii=False), encoding='utf-8')
        os.replace(temporary, target)


def choose_directory(initial):
    script = '''import sys, tkinter as tk
from tkinter import filedialog
root = tk.Tk()
root.withdraw()
root.attributes('-topmost', True)
try:
    folder = filedialog.askdirectory(title='EffectCraft - odaberi folder za videe',
        initialdir=sys.argv[1] or None, mustexist=True, parent=root)
    sys.stdout.buffer.write(folder.encode('utf-8'))
finally:
    root.destroy()
'''
    result = subprocess.run([sys.executable, '-c', script, initial], capture_output=True,
                            timeout=180, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    if result.returncode:
        raise ValueError('Prozor za odabir foldera nije otvoren. Pokušaj ponovo.')
    return result.stdout.decode('utf-8').strip()


def access_error(request):
    if not settings.DEBUG or not getattr(settings, 'LOCAL_APP', False) or request.META.get('REMOTE_ADDR') not in {'127.0.0.1', '::1'}:
        return JsonResponse({'error': 'Spremanje u folder dostupno je u lokalnoj aplikaciji.'}, status=403)
    if not request.user.is_authenticated:
        return JsonResponse({'error': 'Prijavi se u Klipanje za odabir i spremanje u folder.'}, status=401)


@never_cache
@csrf_protect
@require_http_methods(['GET', 'POST'])
def directory(request):
    denied = access_error(request)
    if denied is not None:
        return denied
    if request.method == 'GET':
        return JsonResponse(directory_state(request.user.pk))
    if not _selection_lock.acquire(blocking=False):
        return JsonResponse({'error': 'Odabir foldera je već otvoren.'}, status=409)
    try:
        selected = choose_directory(directory_state(request.user.pk)['directory'])
        if selected:
            store_directory(request.user.pk, selected)
        return JsonResponse({**directory_state(request.user.pk), 'cancelled': not bool(selected)})
    except subprocess.TimeoutExpired:
        return JsonResponse({'error': 'Odabir foldera je istekao. Pokušaj ponovo.'}, status=408)
    except (OSError, ValueError) as error:
        message = str(error) if isinstance(error, ValueError) else 'Folder nije dostupan. Odaberi drugi folder.'
        return JsonResponse({'error': message}, status=400)
    finally:
        _selection_lock.release()


def video_name(name):
    stem = re.split(r'[\\/]', str(name))[-1]
    stem = re.sub(r'\.(mp4|mov|webm|m4v)$', '', stem, flags=re.I)
    stem = re.sub(r'(?:-1200-[\d.]+x|-effect)+$', '', stem, flags=re.I)
    stem = unicodedata.normalize('NFKD', stem.replace('đ', 'dj').replace('Đ', 'Dj')).encode('ascii', 'ignore').decode()
    stem = re.sub(r'[^a-z0-9]+', '-', stem.lower()).strip('-')[:120].rstrip('-') or 'video'
    return stem + '-effect'


def file_hash(path):
    with path.open('rb') as source:
        return hashlib.file_digest(source, 'sha256').digest()


def write_video(upload, selected, name):
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(prefix='.effectcraft-', suffix='.part', dir=selected, delete=False) as output:
            temporary = Path(output.name)
            digest = hashlib.sha256()
            for chunk in upload.chunks():
                output.write(chunk)
                digest.update(chunk)
            output.flush()
            os.fsync(output.fileno())
        expected = digest.digest()
        with _save_lock:
            for number in range(10000):
                suffix = f'-{number + 1}' if number else ''
                destination = selected / f'{video_name(name)}{suffix}.mp4'
                if destination.exists():
                    if destination.is_file() and not destination.is_symlink() and file_hash(destination) == expected:
                        return {'path': str(destination), 'filename': destination.name, 'already_saved': True}
                    continue
                try:
                    if os.name == 'nt':
                        os.rename(temporary, destination)
                    else:
                        os.link(temporary, destination)
                    return {'path': str(destination), 'filename': destination.name, 'already_saved': False}
                except FileExistsError:
                    continue
        raise ValueError('Nema slobodnog naziva u odabranom folderu.')
    finally:
        if temporary:
            temporary.unlink(missing_ok=True)


@never_cache
@csrf_protect
@require_POST
def save_video(request):
    denied = access_error(request)
    if denied is not None:
        return denied
    if str(request.user.pk) != request.POST.get('owner'):
        return JsonResponse({'error': 'Prijava se promijenila. Osvježi prikaz.'}, status=409)
    state = directory_state(request.user.pk)
    if not state['available']:
        return JsonResponse({'error': 'Odaberi dostupan folder za gotove videe.'}, status=400)
    if request.POST.get('directory') != state['directory']:
        return JsonResponse({'error': 'Folder je promijenjen. Osvježi prikaz i ponovi spremanje.'}, status=409)
    upload = request.FILES.get('file')
    if not upload or not 0 < upload.size <= 500_000_000 or upload.content_type != 'video/mp4':
        return JsonResponse({'error': 'Odaberi obrađeni MP4 do 500 MB.'}, status=400)
    try:
        selected = Path(state['directory']).resolve(strict=True)
        return JsonResponse(write_video(upload, selected, request.POST.get('name') or upload.name))
    except (OSError, ValueError):
        return JsonResponse({'error': 'Video nije spremljen. Provjeri folder i slobodan prostor pa pokušaj ponovo.'}, status=400)
