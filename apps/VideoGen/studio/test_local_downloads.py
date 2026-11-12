import json
from pathlib import Path
import tempfile
from unittest.mock import patch

from django.conf import settings
from django.test import Client, TestCase, override_settings
from .local_downloads import copy_video, directory_state, store_directory
from .models import Budget, Job


class LocalDownloadTests(TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory(dir=Path(settings.BASE_DIR) / '.runtime')
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.destination = self.root / 'Chosen directory'
        self.destination.mkdir()
        local = override_settings(MEDIA_ROOT=self.root, VIDEOGEN_DOWNLOAD_STATE=self.root / 'settings.json')
        local.enable()
        self.addCleanup(local.disable)
        (self.root / 'original.mp4').write_bytes(b'original audio video')
        (self.root / 'silent.mp4').write_bytes(b'processed silent video')
        self.job = Job.objects.create(title='Scene / one', model_id='ltx25-distilled', status='completed',
            budget=Budget.objects.create(name='download-test'), video='original.mp4', processed_video='silent.mp4',
            processing_status='ready', processing_info={'revision': 'revision123', 'speed': 1})

    def save(self, **payload):
        return self.client.post(f'/api/creative/videos/{self.job.pk}/save/',
            json.dumps({'revision': 'revision123', **payload}), content_type='application/json')

    def test_requires_real_selected_directory_and_never_uses_default_downloads(self):
        self.assertEqual(self.save().status_code, 400)
        self.assertEqual(list(self.destination.iterdir()), [])
        store_directory(self.destination)
        self.assertEqual(directory_state(), {'directory': str(self.destination), 'available': True})

    def test_download_button_copies_correct_version_into_exact_directory(self):
        store_directory(self.destination)
        first = self.save()
        self.assertEqual(first.status_code, 200)
        exported = Path(first.json()['path'])
        self.assertEqual(exported.name, 'scene_one_video_ltx2.5.mp4')
        self.assertEqual(exported.parent, self.destination)
        self.assertEqual(exported.read_bytes(), b'processed silent video')
        again = self.save().json()
        self.assertTrue(again['already_saved'])
        self.assertEqual(again['path'], str(exported))
        original = self.save(original=True)
        self.assertEqual(Path(original.json()['path']).read_bytes(), b'original audio video')
        self.assertEqual(len(list(self.destination.iterdir())), 2)

    def test_existing_different_file_is_preserved_and_name_is_safe(self):
        store_directory(self.destination)
        first = self.save().json()
        Path(first['path']).write_bytes(b'keep unrelated file')
        second = self.save().json()
        self.assertNotEqual(first['path'], second['path'])
        self.assertEqual(Path(first['path']).read_bytes(), b'keep unrelated file')
        self.assertEqual(Path(second['path']).parent, self.destination)
        self.assertFalse(list(self.destination.glob('*.part')))

    def test_failed_processing_or_changed_revision_does_not_export_original(self):
        store_directory(self.destination)
        self.assertEqual(self.save(revision='old').status_code, 400)
        self.job.processing_status = 'failed'
        self.job.save()
        self.assertEqual(self.save().status_code, 400)
        self.assertEqual(list(self.destination.iterdir()), [])

    @patch('studio.local_downloads.choose_directory')
    def test_picker_persists_choice_and_cancel_keeps_it(self, chooser):
        chooser.return_value = str(self.destination)
        response = self.client.post('/api/creative/download-directory/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['directory'], str(self.destination))
        chooser.return_value = ''
        cancelled = self.client.post('/api/creative/download-directory/').json()
        self.assertTrue(cancelled['cancelled'])
        self.assertEqual(cancelled['directory'], str(self.destination))

    def test_write_error_removes_temporary_file_and_requires_csrf(self):
        store_directory(self.destination)
        with patch('studio.local_downloads.os.rename', side_effect=PermissionError):
            self.assertEqual(self.save().status_code, 400)
        self.assertEqual(list(self.destination.iterdir()), [])
        protected = Client(enforce_csrf_checks=True)
        self.assertEqual(protected.post('/api/creative/download-directory/').status_code, 403)
        self.assertEqual(protected.post(f'/api/creative/videos/{self.job.pk}/save/').status_code, 403)
