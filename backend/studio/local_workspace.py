"""Private, automatically refreshed disk copies; never a Git/cloud export."""
import json
import os
import re
import shutil
from pathlib import Path
from threading import RLock
from uuid import uuid4

from django.conf import settings
from django.core.serializers.json import DjangoJSONEncoder
from django.db import transaction
from django.db.models.signals import post_save, post_delete
from django.utils.text import slugify

from .models import Project, LocalScript, ProjectChapter, MediaAsset

_lock = RLock()


def user_folder(user):
    name = user.get_username().casefold()
    return {'naghun': 'Abdullah', 'abdullah': 'Abdullah', 'rijad': 'Rijad', 'nihad': 'Nihad'}.get(name, f'{slugify(name) or "user"}-{user.pk}')


def project_folder_name(name):
    # Keep the displayed title, including Bosnian letters, within Windows filename rules.
    name = re.sub(r'[<>:"/\\|?*\x00-\x1f]', ' ', name)
    name = re.sub(r'\s+', ' ', name).strip(' .')[:100].rstrip(' .') or 'Projekat'
    if re.fullmatch(r'(CON|PRN|AUX|NUL|COM[1-9¹²³]|LPT[1-9¹²³])', name.split('.')[0], re.IGNORECASE):
        name = f'Projekat {name}'
    return name


def find_project_folder(owner_root, project_id):
    if not owner_root.is_dir():
        return None
    for folder in sorted(owner_root.iterdir()):
        # Copies never follow manually added links into another user's folder.
        if folder.is_symlink() or not folder.is_dir() or folder.resolve().parent != owner_root.resolve():
            continue
        manifest = folder / 'projekat.json'
        try:
            data = json.loads(manifest.read_text(encoding='utf-8'))
        except (OSError, ValueError):
            if folder.name == str(project_id) and not manifest.exists():
                return folder
            continue
        if isinstance(data, dict) and str(data.get('id')) == str(project_id):
            return folder
    return None


def project_folder(project):
    root = Path(settings.LOCAL_WORKSPACE_ROOT).resolve()
    owner_root = root / user_folder(project.created_by)
    if owner_root.is_symlink() or owner_root.resolve().parent != root:
        raise ValueError('Korisnički workspace mora ostati unutar lokalnog workspace foldera.')
    owner_root.mkdir(parents=True, exist_ok=True)
    existing = find_project_folder(owner_root, project.pk)
    title = project_folder_name(project.name)
    occupied = {path.name.casefold() for path in owner_root.iterdir() if path != existing}
    name, number = title, 2
    while name.casefold() in occupied:
        name = f'{title} ({number})'
        number += 1
    destination = owner_root / name
    if destination.resolve().parent != owner_root.resolve():
        raise ValueError('Projektni folder mora ostati unutar korisničkog workspace foldera.')
    if existing and existing != destination:
        # Only this project's local copy moves; database and original media keep their paths.
        existing.rename(destination)
    destination.mkdir(exist_ok=True)
    return destination


def write_json(path, value):
    temp = path.with_name(path.name + '.' + uuid4().hex + '.tmp')
    try:
        temp.write_text(json.dumps(value, cls=DjangoJSONEncoder, ensure_ascii=False, indent=2), encoding='utf-8')
        os.replace(temp, path)
    finally:
        temp.unlink(missing_ok=True)


def sync_project(project_id):
    if not settings.LOCAL_WORKSPACE_ROOT:
        return
    with _lock:
        project = Project.objects.select_related('created_by').filter(pk=project_id).first()
        if not project:
            return
        folder = project_folder(project)
        media = folder / 'mediji'
        media.mkdir(exist_ok=True)
        assets = []
        for asset in project.assets.all():
            extension = Path(asset.name).suffix.lower()
            if not extension[1:].isalnum():
                extension = '.bin'
            relative = f'mediji/{asset.pk}{extension}'
            target = folder / relative
            available = bool(asset.file and asset.file.storage.exists(asset.file.name))
            if available and (not target.exists() or target.stat().st_size != asset.size):
                temp = target.with_suffix('.tmp')
                with asset.file.open('rb') as source, temp.open('wb') as dest:
                    shutil.copyfileobj(source, dest)
                os.replace(temp, target)
            assets.append({'id': asset.pk, 'name': asset.name, 'file': relative, 'available': available,
                           'content_type': asset.content_type, 'metadata': asset.metadata})
        write_json(folder / 'skripte.json', list(project.scripts.values()))
        write_json(folder / 'projekat.json', {'version': 1, 'id': project.pk, 'name': project.name,
                   'owner': project.created_by.get_username(), 'kind': project.kind, 'brief': project.brief,
                   'state': project.state, 'updated_at': project.updated_at,
                   'chapters': list(project.chapters.values()), 'assets': assets})


def schedule_sync(sender, instance, **kwargs):
    if kwargs.get('raw') or not settings.LOCAL_WORKSPACE_ROOT:
        return
    project_id = instance.pk if sender is Project else instance.project_id
    # Only committed changes reach the disk. Failed disk copies never roll back paid assets.
    transaction.on_commit(lambda: sync_project(project_id), robust=True)


def mark_deleted(sender, instance, **kwargs):
    if not settings.LOCAL_WORKSPACE_ROOT:
        return
    owner_root = Path(settings.LOCAL_WORKSPACE_ROOT) / user_folder(instance.created_by)
    project_id = instance.pk
    def mark():
        with _lock:
            if owner_root.is_symlink():
                return
            folder = find_project_folder(owner_root, project_id)
            if folder:
                path = folder / 'projekat.json'
                data = json.loads(path.read_text(encoding='utf-8'))
                data['deleted'] = True
                write_json(path, data)
    transaction.on_commit(mark, robust=True)


for model in (Project, LocalScript, ProjectChapter, MediaAsset):
    post_save.connect(schedule_sync, sender=model, weak=False)
    if model is not Project:
        post_delete.connect(schedule_sync, sender=model, weak=False)
post_delete.connect(mark_deleted, sender=Project, weak=False)
