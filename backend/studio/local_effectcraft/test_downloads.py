import importlib.util
import json
import os
from pathlib import Path
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch
from concurrent.futures import ThreadPoolExecutor

root = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(root / 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
import django
django.setup()
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import RequestFactory, SimpleTestCase, override_settings

from studio.local_effectcraft import downloads


class FolderTests(SimpleTestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.folder = self.root / 'Chosen folder'
        self.folder.mkdir()
        override = override_settings(DEBUG=True, LOCAL_APP=True, EFFECTCRAFT_DIRECTORY_STATE=self.root / 'state.json')
        override.enable()
        self.addCleanup(override.disable)
        self.factory = RequestFactory()

    def upload(self, content=b'processed clip'):
        return SimpleUploadedFile('Leon gleda rijeku-1200-1x.mp4', content, content_type='video/mp4')

    def request(self, path='/api/local-effectcraft/save', data=None, user=7, csrf=False):
        request = self.factory.post(path, data or {})
        request.user = SimpleNamespace(pk=user, is_authenticated=user is not None)
        request._dont_enforce_csrf_checks = not csrf
        return request

    def save(self, **extra):
        return downloads.save_video(self.request(data={
            'owner': '7', 'directory': str(self.folder), 'file': self.upload(),
            **extra,
        }))

    def test_requires_selected_directory_and_correct_owner(self):
        self.assertEqual(self.save().status_code, 400)
        downloads.store_directory(7, self.folder)
        self.assertEqual(downloads.directory_state(8), {'directory': '', 'available': False})
        self.assertEqual(self.save(owner='8').status_code, 409)
        self.assertEqual(self.save(directory=str(self.root)).status_code, 409)
        self.assertEqual(list(self.folder.iterdir()), [])

    def test_save_is_exact_atomic_and_idempotent(self):
        downloads.store_directory(7, self.folder)
        first = json.loads(self.save().content)
        exported = Path(first['path'])
        self.assertEqual(exported.parent, self.folder)
        self.assertEqual(exported.name, 'leon-gleda-rijeku-effect.mp4')
        self.assertEqual(exported.read_bytes(), b'processed clip')
        second = json.loads(self.save().content)
        self.assertTrue(second['already_saved'])
        self.assertEqual(first['path'], second['path'])
        self.assertEqual(len(list(self.folder.iterdir())), 1)

    def test_collision_preserves_existing_file_and_new_speed(self):
        downloads.store_directory(7, self.folder)
        original = self.folder / 'leon-gleda-rijeku-effect.mp4'
        original.write_bytes(b'previous version')
        result = json.loads(self.save().content)
        self.assertEqual(Path(result['path']).name, 'leon-gleda-rijeku-effect-2.mp4')
        self.assertEqual(original.read_bytes(), b'previous version')
        self.assertFalse(list(self.folder.glob('*.part')))

    def test_concurrent_retry_creates_one_complete_file(self):
        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(downloads.write_video, self.upload(), self.folder, 'Same scene') for _ in range(2)]
        results = [future.result() for future in futures]
        self.assertEqual(results[0]['path'], results[1]['path'])
        self.assertEqual(len(list(self.folder.iterdir())), 1)

    def test_unsafe_names_and_extensions_stay_inside_folder(self):
        for name, expected in [('../../Léon gleda rijeku.mp4', 'leon-gleda-rijeku-effect'),
                               ('kovčeg-1200-1.2x.mp4', 'kovceg-effect'),
                               ('rijeka-effect.mp4', 'rijeka-effect'),
                               ('Đuro\\čamac.webm', 'camac-effect')]:
            self.assertEqual(downloads.video_name(name), expected)

    def test_cancel_keeps_selection_and_other_accounts(self):
        downloads.store_directory(7, self.folder)
        downloads.store_directory(8, self.root)
        with patch.object(downloads, 'choose_directory', return_value=''):
            result = downloads.directory(self.request('/api/local-effectcraft/download-directory'))
        self.assertTrue(json.loads(result.content)['cancelled'])
        self.assertEqual(downloads.directory_state(7)['directory'], str(self.folder))
        self.assertEqual(downloads.directory_state(8)['directory'], str(self.root))

    def test_failed_copy_cleans_partial_without_success(self):
        downloads.store_directory(7, self.folder)
        with patch.object(downloads.os, 'rename', side_effect=PermissionError):
            self.assertEqual(self.save().status_code, 400)
        self.assertEqual(list(self.folder.iterdir()), [])

    def test_csrf_auth_and_local_only_guards(self):
        self.assertEqual(downloads.save_video(self.request(csrf=True)).status_code, 403)
        self.assertEqual(downloads.save_video(self.request(user=None)).status_code, 401)
        with override_settings(DEBUG=False):
            self.assertEqual(downloads.save_video(self.request()).status_code, 403)
        request = self.request()
        request.META['REMOTE_ADDR'] = '192.168.1.1'
        self.assertEqual(downloads.save_video(request).status_code, 403)


if __name__ == '__main__':
    unittest.main(verbosity=2)
