import io
import json
from pathlib import Path
from tempfile import TemporaryDirectory

from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.core.management import call_command, CommandError
from django.test import TestCase, override_settings

from .models import MediaAsset, Project, Workspace, media_path


class MediaReorganizationTests(TestCase):
    def setUp(self):
        self.directory = TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.override = override_settings(STORAGE_BACKEND='local', STORAGES={'default': {
            'BACKEND': 'django.core.files.storage.FileSystemStorage',
            'OPTIONS': {'location': self.directory.name},
        }})
        self.override.enable()
        self.addCleanup(self.override.disable)
        user = get_user_model().objects.create_user(username='Naghun')
        project = Project.objects.create(workspace=Workspace.objects.create(name='Studio'),
                                         created_by=user, name='Moj video', kind='video')
        self.old = default_storage.save('users/old/video.mp4', ContentFile(b'video bytes'))
        self.asset = MediaAsset.objects.create(project=project, file=self.old, name='Video.mp4',
                                               size=11, content_type='video/mp4')
        self.manifest = str(Path(self.directory.name) / 'move.json')

    def run_command(self, *flags):
        call_command('reorganize_media', '--manifest', self.manifest, *flags, stdout=io.StringIO())

    def test_plan_apply_and_prune_preserve_asset_and_bytes(self):
        self.run_command()
        self.asset.refresh_from_db()
        self.assertEqual(self.asset.file.name, self.old)
        self.run_command('--apply')
        self.asset.refresh_from_db()
        self.assertEqual(self.asset.file.name, media_path(self.asset, self.asset.name))
        self.assertTrue(default_storage.exists(self.old))
        with self.asset.file.open('rb') as uploaded:
            self.assertEqual(uploaded.read(), b'video bytes')
        self.run_command('--apply')  # Resume safely without another upload.
        self.run_command('--prune')
        self.assertFalse(default_storage.exists(self.old))
        self.assertTrue(default_storage.exists(self.asset.file.name))
        self.run_command('--prune')

    def test_destination_collision_keeps_original_reference(self):
        default_storage.save(media_path(self.asset, self.asset.name), ContentFile(b'wrong bytes'))
        self.run_command()
        with self.assertRaises(CommandError):
            self.run_command('--apply')
        self.asset.refresh_from_db()
        self.assertEqual(self.asset.file.name, self.old)
        self.assertTrue(default_storage.exists(self.old))

    def test_other_database_reference_prevents_pruning(self):
        self.run_command()
        self.run_command('--apply')
        references = Path(self.directory.name) / 'references.json'
        references.write_text(json.dumps({'assets': [{'file': self.old}]}), encoding='utf-8')
        with self.assertRaises(CommandError):
            self.run_command('--prune', '--external-references', str(references))
        self.assertTrue(default_storage.exists(self.old))
