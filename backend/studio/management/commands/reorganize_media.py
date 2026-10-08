"""Plan, verify and relocate stored media without changing asset IDs or project state."""
import hashlib
import json
import os
from pathlib import Path

from django.conf import settings
from django.core.files.storage import default_storage
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from studio.models import MediaAsset, media_path


def digest(storage, name):
    value = hashlib.sha256()
    with storage.open(name, 'rb') as source:
        for block in iter(lambda: source.read(1024 * 1024), b''):
            value.update(block)
    return value.hexdigest()


def write_manifest(path, data):
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(json.dumps(data, indent=2), encoding='utf-8')
    os.chmod(temporary, 0o600)
    temporary.replace(path)


def copy_verified(storage, old, new, expected_size):
    if storage.size(old) != expected_size:
        raise CommandError(f'Source size differs from database: {old}')
    checksum = digest(storage, old)
    if not storage.exists(new):
        if settings.STORAGE_BACKEND == 'r2':
            client = storage.connection.meta.client
            head = client.head_object(Bucket=storage.bucket_name, Key=old)
            client.copy_object(Bucket=storage.bucket_name, Key=new,
                               CopySource={'Bucket': storage.bucket_name, 'Key': old},
                               CopySourceIfMatch=head['ETag'], MetadataDirective='COPY')
        else:
            with storage.open(old, 'rb') as source:
                if storage.save(new, source) != new:
                    raise CommandError('Destination changed during copy; source retained.')
    if storage.size(new) != expected_size or digest(storage, new) != checksum:
        raise CommandError(f'Destination verification failed; source retained: {new}')
    return checksum


class Command(BaseCommand):
    help = 'Create a media relocation manifest, apply it, then explicitly prune verified old keys.'

    def add_arguments(self, parser):
        parser.add_argument('--manifest', required=True)
        parser.add_argument('--apply', action='store_true')
        parser.add_argument('--prune', action='store_true')
        parser.add_argument('--external-references', help='Fresh audit JSON from the other database sharing this bucket')

    def handle(self, *args, **options):
        path = Path(options['manifest'])
        identity = {'database': str(Path(settings.DATABASES['default']['NAME']).resolve()),
                    'backend': settings.STORAGE_BACKEND,
                    'bucket': getattr(default_storage, 'bucket_name', None)}
        if not options['apply'] and not options['prune']:
            if path.exists():
                raise CommandError('Manifest already exists; choose another filename or resume it.')
            moves = [{'id': str(asset.pk), 'old': asset.file.name,
                      'new': media_path(asset, asset.name), 'size': asset.size}
                     for asset in MediaAsset.objects.select_related('project__created_by').order_by('pk')
                     if asset.file.name and asset.file.name != media_path(asset, asset.name)]
            path.parent.mkdir(parents=True, exist_ok=True)
            write_manifest(path, {**identity, 'moves': moves})
            self.stdout.write(f'Planned {len(moves)} objects. No storage or database changes.')
            return
        data = json.loads(path.read_text(encoding='utf-8'))
        if any(data.get(key) != value for key, value in identity.items()):
            raise CommandError('Manifest belongs to another database or storage backend.')
        for move in data['moves']:
            asset = MediaAsset.objects.select_related('project__created_by').filter(pk=move['id']).first()
            if not asset or asset.file.name not in (move['old'], move['new']):
                raise CommandError('Asset changed since planning; inspect before continuing.')
            if not move['new'].startswith('workspaces/') or move['new'] == move['old']:
                raise CommandError('Invalid destination.')
            if options['apply']:
                if asset.file.name == move['old']:
                    if media_path(asset, asset.name) != move['new']:
                        raise CommandError('Project naming changed; create a fresh plan.')
                    move['sha256'] = copy_verified(default_storage, move['old'], move['new'], move['size'])
                    write_manifest(path, data)
                    with transaction.atomic():
                        if MediaAsset.objects.filter(pk=asset.pk, file=move['old']).update(file=move['new']) != 1:
                            raise CommandError('Concurrent asset change; both objects retained.')
                elif not move.get('sha256') or digest(default_storage, move['new']) != move['sha256']:
                    raise CommandError('Previously moved asset failed verification.')
                move['applied'] = True
                write_manifest(path, data)
                self.stdout.write(f'Verified and linked: {asset.name}')
        if options['prune']:
            if settings.STORAGE_BACKEND == 'r2' and not options['external_references']:
                raise CommandError('R2 pruning requires a fresh audit of the other database.')
            external = set()
            if options['external_references']:
                audit = json.loads(Path(options['external_references']).read_text(encoding='utf-8-sig'))
                external = {asset['file'] for asset in audit['assets']}
            for move in data['moves']:
                if not move.get('applied') or not move.get('sha256'):
                    raise CommandError('Apply and verify every move before pruning.')
                if move['old'] in external or MediaAsset.objects.filter(file=move['old']).exists():
                    raise CommandError('An old key is still referenced; retained.')
                if not MediaAsset.objects.filter(pk=move['id'], file=move['new']).exists():
                    raise CommandError('Destination reference changed; source retained.')
                if default_storage.size(move['new']) != move['size'] or digest(default_storage, move['new']) != move['sha256']:
                    raise CommandError('Destination changed; source retained.')
                if default_storage.exists(move['old']):
                    if digest(default_storage, move['old']) != move['sha256']:
                        raise CommandError('Source changed; retained.')
                    default_storage.delete(move['old'])
                move['pruned'] = True
                write_manifest(path, data)
                self.stdout.write(f'Removed verified old location: {move["id"]}')
