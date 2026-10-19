from tempfile import TemporaryDirectory
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings

@override_settings(LOCAL_APP=True)
class SoundLibraryTests(TestCase):
    def setUp(self):
        self.owner=get_user_model().objects.create_user(username='sound-owner')
        self.other=get_user_model().objects.create_user(username='sound-other')
        self.folder=TemporaryDirectory()
        self.override=override_settings(MEDIA_ROOT=self.folder.name)
        self.override.enable()
        self.addCleanup(self.folder.cleanup)
        self.addCleanup(self.override.disable)
        self.client.force_login(self.owner)
    def test_saved_without_project_and_private(self):
        response=self.client.post('/api/sounds',{'file':SimpleUploadedFile('vacuum.wav',b'RIFFtest',content_type='audio/wav')})
        self.assertEqual(response.status_code,201)
        item=response.json()
        self.assertEqual(len(self.client.get('/api/sounds').json()),1)
        response=self.client.get(item['url'])
        self.assertEqual(response.status_code,200)
        response.close()
        self.client.force_login(self.other)
        self.assertEqual(self.client.get('/api/sounds').json(),[])
        self.assertEqual(self.client.get(item['url']).status_code,404)
    def test_rejects_invalid_upload(self):
        self.assertEqual(self.client.post('/api/sounds',{'file':SimpleUploadedFile('bad.html',b'<script>')}).status_code,400)
        self.assertEqual(self.client.post('/api/sounds',{'file':SimpleUploadedFile('empty.wav',b'')}).status_code,413)
