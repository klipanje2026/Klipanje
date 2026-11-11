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

    def test_upload_remembers_selected_category(self):
        for category in ['music', 'sound']:
            response=self.client.post('/api/sounds',{'category':category,'file':SimpleUploadedFile(category+'.wav',b'RIFFtest',content_type='audio/wav')})
            self.assertEqual(response.status_code,201)
            self.assertEqual(response.json()['category'],category)
        self.assertEqual({s['category'] for s in self.client.get('/api/sounds').json()}, {'music','sound'})
        self.assertEqual(self.client.post('/api/sounds',{'category':'other','file':SimpleUploadedFile('bad.wav',b'RIFFtest')}).status_code,400)

    def test_saved_fade_default_is_returned(self):
        from .models import LibrarySound
        response=self.client.post('/api/sounds',{'file':SimpleUploadedFile('clock.wav',b'RIFFtest',content_type='audio/wav')})
        self.assertEqual(response.json()['fadeIn'],0)
        LibrarySound.objects.filter(pk=response.json()['id']).update(fade_in=.8)
        self.assertEqual(self.client.get('/api/sounds').json()[0]['fadeIn'],.8)

    def test_rename_and_archive_preserve_audio_and_owner(self):
        response=self.client.post('/api/sounds',{'file':SimpleUploadedFile('waves.wav',b'RIFFtest',content_type='audio/wav')})
        item=response.json()
        url='/api/sounds/'+item['id']
        self.client.force_login(self.other)
        self.assertEqual(self.client.patch(url,{'name':'Other'},content_type='application/json').status_code,404)
        self.assertEqual(self.client.delete(url).status_code,404)
        self.client.force_login(self.owner)
        self.assertEqual(self.client.patch(url,{'name':'   '},content_type='application/json').status_code,400)
        renamed=self.client.patch(url,{'name':'Valovi na obali'},content_type='application/json')
        self.assertEqual(renamed.json()['name'],'Valovi na obali.wav')
        self.assertEqual(renamed.json()['url'],item['url'])
        self.assertEqual(self.client.delete(url).status_code,204)
        self.assertEqual(self.client.get('/api/sounds').json(),[])
        response=self.client.get(item['url'])
        self.assertEqual(response.status_code,200)
        response.close()
        self.assertEqual(self.client.delete(url).status_code,204)
