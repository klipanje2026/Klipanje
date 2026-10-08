import json
import tempfile
from datetime import timedelta
from unittest.mock import patch
import httpx
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from .models import Booking, Lead, MediaAsset, Membership, Project, Workspace

class AccountsTests(TestCase):
    def setUp(self):
        self.client = Client(enforce_csrf_checks=True)
    def post(self, path, data, token=True):
        headers = {}
        if token:
            headers['HTTP_X_CSRFTOKEN'] = self.client.get('/api/auth/csrf').json()['csrfToken']
        return self.client.post(path, json.dumps(data), content_type='application/json', **headers)
    def test_registration_requires_csrf_and_creates_private_workspace(self):
        payload = {'username': 'semir_test', 'name': 'Semir', 'password': 'River!Canvas73Extended'}
        self.assertEqual(self.post('/api/auth/register', payload, token=False).status_code, 403)
        response = self.post('/api/auth/register', payload)
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(response.json()['workspaces'][0]['role'], 'owner')
        self.assertFalse(response.json()['user']['isStaff'])
        self.assertEqual(self.client.get('/api/auth/me').json()['user']['username'], 'semir_test')
        self.assertEqual(self.post('/api/auth/logout', {}).status_code, 200)
        self.assertIsNone(self.client.get('/api/auth/me').json()['user'])
        self.assertEqual(self.post('/api/auth/login', {'username': 'semir_test', 'password': 'wrong'}).status_code, 401)
        self.assertEqual(self.post('/api/auth/login', payload).status_code, 200)
    def test_weak_password_and_duplicate_username_rejected(self):
        self.assertEqual(self.post('/api/auth/register', {'username': 'a', 'password': '123'}).status_code, 400)
        self.assertFalse(Workspace.objects.exists())
        get_user_model().objects.create_user(username='taken', password='test')
        self.assertEqual(self.post('/api/auth/register', {'username': 'taken', 'password': 'River!Canvas73Extended'}).status_code, 400)
    def test_username_login_ignores_case_but_password_does_not(self):
        get_user_model().objects.create_user(username='MixedName', password='River!Canvas73Extended', is_staff=True)
        for name in ['mixedname', 'MIXEDNAME', ' MixedName ']:
            response = self.post('/api/auth/login', {'username': name, 'password': 'River!Canvas73Extended'})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()['user']['username'], 'MixedName')
            self.post('/api/auth/logout', {})
        self.assertEqual(self.post('/api/auth/login', {'username':'mixedname','password':'river!canvas73extended'}).status_code, 401)
        self.assertEqual(self.post('/api/auth/register', {'username':'MIXEDNAME','password':'Another!Secret73Long'}).status_code, 400)

    def test_malformed_auth_input_returns_json(self):
        for payload in [[], {'username': 42}, None]:
            self.assertEqual(self.post('/api/auth/login', payload).status_code, 400)
            self.assertEqual(self.post('/api/auth/register', payload).status_code, 400)
    def test_login_cannot_bypass_csrf(self):
        self.assertEqual(self.post('/api/auth/login', {'username': 'x', 'password': 'x'}, token=False).status_code, 403)

class ProjectTests(TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.settings_override = override_settings(MEDIA_ROOT=self.tmp.name, STORAGE_BACKEND='local')
        self.settings_override.enable()
        self.addCleanup(self.settings_override.disable)
        self.owner = get_user_model().objects.create_user(username='owner')
        self.other = get_user_model().objects.create_user(username='other')
        self.workspace = Workspace.objects.create(name='Owner')
        self.other_workspace = Workspace.objects.create(name='Other')
        Membership.objects.create(user=self.owner, workspace=self.workspace, role='owner')
        Membership.objects.create(user=self.other, workspace=self.other_workspace, role='owner')
        self.client = APIClient()
        self.client.force_authenticate(self.owner)
        self.project = Project.objects.create(workspace=self.workspace, created_by=self.owner, name='Test', kind='subtitles')
    def upload(self, name='video.mp4', content=b'test-video-bytes', content_type='video/mp4'):
        return self.client.post(f'/api/projects/{self.project.pk}/assets', {'file': SimpleUploadedFile(name, content, content_type)}, format='multipart')
    def test_project_save_restore_and_file_roundtrip(self):
        uploaded = self.upload()
        self.assertEqual(uploaded.status_code, 201, uploaded.data)
        state = {'version': 1, 'data': {'segments': [{'text': 'Zdravo', 'start': 0, 'end': 1}]}, 'files': [{'key': 'video', 'id': uploaded.data['id']}]}
        response = self.client.patch(f'/api/projects/{self.project.pk}', {'state': state}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.client.get(f'/api/projects/{self.project.pk}').data['state'], state)
        response = self.client.get(uploaded.data['url'])
        self.assertEqual(b''.join(response.streaming_content), b'test-video-bytes')
        self.assertIn('attachment', response['Content-Disposition'])
        self.assertEqual(response['Cache-Control'], 'private, no-store')
    def test_other_workspace_cannot_list_read_edit_delete_or_upload(self):
        uploaded = self.upload().data
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get('/api/projects').data, [])
        url = f'/api/projects/{self.project.pk}'
        for response in [self.client.get(url), self.client.patch(url, {'name': 'stolen'}, format='json'),
                         self.client.delete(url), self.client.get(url + '/assets'), self.upload(),
                         self.client.get(uploaded['url']), self.client.delete(f'/api/assets/{uploaded["id"]}')]:
            self.assertEqual(response.status_code, 404)
        response = self.client.post('/api/projects', {'name': 'bad', 'workspace': str(self.workspace.pk), 'kind': 'video'}, format='json')
        self.assertEqual(response.status_code, 400)
    def test_admin_cannot_access_another_users_video(self):
        self.other.is_staff=True
        self.other.save()
        self.test_other_workspace_cannot_list_read_edit_delete_or_upload()

    def test_project_workspace_cannot_be_reassigned(self):
        response = self.client.patch(f'/api/projects/{self.project.pk}', {'workspace': str(self.other_workspace.pk)}, format='json')
        self.assertEqual(response.status_code, 400)
    def test_shared_workspace_member_cannot_access_another_users_video(self):
        uploaded = self.upload().data
        Membership.objects.create(user=self.other, workspace=self.workspace)
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get('/api/projects').data, [])
        url = f'/api/projects/{self.project.pk}'
        for response in [self.client.get(url), self.client.patch(url, {'name':'changed'}, format='json'),
                         self.client.delete(url), self.client.get(url+'/assets'), self.upload(),
                         self.client.get(uploaded['url']), self.client.delete(f'/api/assets/{uploaded["id"]}')]:
            self.assertEqual(response.status_code, 404)
    def test_anonymous_cannot_access_private_projects_files_or_exports(self):
        uploaded = self.upload().data
        self.client.force_authenticate(None)
        for path in ['/api/projects', uploaded['url']]:
            self.assertEqual(self.client.get(path).status_code, 403)
        for path in ['/api/subscription/export']:
            self.assertEqual(self.client.post(path, {}, format='json').status_code, 403)
    def test_invalid_uploads_and_limits(self):
        self.assertEqual(self.upload('script.html', b'<script>', 'text/html').status_code, 400)
        self.assertEqual(self.upload(content=b'').status_code, 413)
        with override_settings(MAX_PROJECT_UPLOAD_BYTES=3):
            self.assertEqual(self.upload().status_code, 413)
        self.assertFalse(MediaAsset.objects.exists())
    def test_delete_project_cleans_local_files(self):
        asset_id = self.upload().data['id']
        asset = MediaAsset.objects.get(pk=asset_id)
        storage, name = asset.file.storage, asset.file.name
        self.assertTrue(storage.exists(name))
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.delete(f'/api/projects/{self.project.pk}')
        self.assertEqual(response.status_code, 204)
        self.assertFalse(storage.exists(name))
        self.assertFalse(MediaAsset.objects.exists())
    def test_state_must_be_object(self):
        response = self.client.patch(f'/api/projects/{self.project.pk}', {'state': []}, format='json')
        self.assertEqual(response.status_code, 400)
    def test_authenticated_mutation_requires_csrf(self):
        client = APIClient(enforce_csrf_checks=True)
        client.force_login(self.owner)
        response = client.post('/api/projects', {'name': 'x', 'workspace': str(self.workspace.pk), 'kind': 'video'}, format='json')
        self.assertEqual(response.status_code, 403)

@override_settings(ELEVENLABS_API_KEY='unit-test-only-never-sent')
class AITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(get_user_model().objects.create_user(username='aiuser', is_staff=True))
    @override_settings(ELEVENLABS_API_KEY='')
    def test_missing_key_is_explained(self):
        with patch('studio.ai.httpx.request') as upstream:
            self.assertEqual(self.client.post('/api/transcribe').status_code, 503)
            upstream.assert_not_called()
    @override_settings(ELEVENLABS_API_KEY='test-only')
    def test_clean_audio_validates_and_preserves_provider_guard(self):
        from rest_framework.response import Response
        with patch('studio.ai.stream_audio',return_value=Response({'ok':True})) as upstream:
            self.assertEqual(self.client.post('/api/audio/clean',{}).status_code,400)
            upstream.assert_not_called()
            audio=SimpleUploadedFile('voice.wav',b'audio','audio/wav')
            self.assertEqual(self.client.post('/api/audio/clean',{'audio':audio},format='multipart').status_code,200)
            self.assertEqual(upstream.call_args.args[0],'/v1/audio-isolation')
            upstream.reset_mock()
            user=get_user_model().objects.create_user(username='clean-nonstaff')
            self.client.force_authenticate(user)
            self.assertEqual(self.client.post('/api/audio/clean',{}).status_code,503)
            upstream.assert_not_called()
    def test_token_contract_and_timeout(self):
        with patch('studio.ai.httpx.request', return_value=httpx.Response(200, json={'token': 'short-lived'})) as upstream:
            response = self.client.post('/api/transcribe')
            self.assertEqual(response.data, {'token': 'short-lived'})
            self.assertEqual(response['Cache-Control'], 'no-store')
            self.assertEqual(upstream.call_args.kwargs['timeout'], 25)
        with patch('studio.ai.httpx.request', side_effect=httpx.ConnectError('offline')):
            self.assertEqual(self.client.post('/api/transcribe').status_code, 502)
    def test_voice_list_and_subscription_contracts(self):
        with patch('studio.ai.httpx.request', return_value=httpx.Response(200, json={'voices': [
            {'voice_id': 'voice1', 'name': 'Ana', 'labels': {'gender': 'female', 'language': 'bs-BA'}}]})):
            response = self.client.get('/api/voices')
            self.assertEqual(response.data['voices'][0]['id'], 'voice1')
            self.assertEqual(response.data['voices'][0]['language'], 'bs')
        admin = get_user_model().objects.create_user(username='aiadmin', is_staff=True)
        self.client.force_authenticate(admin)
        with patch('studio.ai.httpx.request', return_value=httpx.Response(200, json={'character_count': 20, 'character_limit': 100})):
            self.assertEqual(self.client.get('/api/elevenlabs-status').data['remaining'], 80)
    def test_subscription_is_private_to_admins(self):
        self.client.force_authenticate(get_user_model().objects.create_user(username='regular_ai_user'))
        with patch('studio.ai.httpx.request') as upstream:
            response = self.client.get('/api/elevenlabs-status')
            self.assertEqual(response.status_code, 403)
            self.assertNotIn('remaining', response.data)
            upstream.assert_not_called()

    def test_upstream_quota_error_preserved(self):
        with patch('studio.ai.httpx.request', return_value=httpx.Response(402, json={'detail': {'status': 'quota_exceeded'}})):
            response = self.client.post('/api/transcribe')
            self.assertEqual(response.status_code, 402)
            self.assertIn('kredita', response.data['error'])
    def test_narration_and_voice_change_stream_audio_without_live_calls(self):
        requests = []
        def handle(request):
            requests.append((str(request.url), request.read()))
            return httpx.Response(200, content=b'fake-mp3', headers={'content-type': 'audio/mpeg'})
        real_client = httpx.Client
        with patch('studio.ai.httpx.Client', side_effect=lambda **kwargs: real_client(transport=httpx.MockTransport(handle), **kwargs)):
            response = self.client.post('/api/narration', {'voiceId': 'Ana123', 'text': 'Zdravo'}, format='json')
            self.assertEqual(b''.join(response.streaming_content), b'fake-mp3')
            response.close()
            response = self.client.post('/api/voice-change?voiceId=Ana123', {
                'audio': SimpleUploadedFile('sample.wav', b'wave-bytes', 'audio/wav'),
                'voice_settings': json.dumps({'stability': .5, 'similarity_boost': .7})}, format='multipart')
            self.assertEqual(b''.join(response.streaming_content), b'fake-mp3')
            response.close()
        self.assertIn(b'eleven_flash_v2_5', requests[0][1])
        self.assertIn(b'wave-bytes', requests[1][1])
    def test_interrupted_audio_returns_json_instead_of_broken_stream(self):
        class InterruptedAudio(httpx.SyncByteStream):
            def __iter__(self):
                yield b'partial-audio'
                raise httpx.ReadError('connection interrupted')
        real_client = httpx.Client
        transport = httpx.MockTransport(lambda request: httpx.Response(200, stream=InterruptedAudio()))
        with patch('studio.ai.httpx.Client', side_effect=lambda **kwargs: real_client(transport=transport, **kwargs)):
            response = self.client.post('/api/narration', {'voiceId': 'Ana123', 'text': 'Zdravo'}, format='json')
        self.assertEqual(response.status_code, 502)
        self.assertIn('prekinuta', response.data['error'])
        self.assertFalse(response.streaming)

    def test_invalid_narration_never_calls_provider(self):
        with patch('studio.ai.httpx.Client') as upstream:
            self.assertEqual(self.client.post('/api/narration', {'voiceId': '../x', 'text': 'x'}, format='json').status_code, 400)
            upstream.assert_not_called()

class CrmTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.payload = {'name': 'Client', 'email': 'client@example.com', 'company': 'Example', 'service': 'video', 'consent': True}
    def test_lead_form_preserved(self):
        response = self.client.post('/api/leads', self.payload, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.data['leadId'])
        self.assertEqual(Lead.objects.count(), 1)
    def test_duplicate_booking_rolls_back_lead(self):
        payload = {**self.payload, 'startAt': (timezone.now() + timedelta(days=2)).isoformat(), 'timeZone': 'Europe/Sarajevo'}
        self.assertEqual(self.client.post('/api/bookings', payload, format='json').status_code, 201)
        self.assertEqual(self.client.post('/api/bookings', payload, format='json').status_code, 409)
        self.assertEqual(Lead.objects.count(), 1)
        self.assertEqual(Booking.objects.count(), 1)
    def test_crm_requires_staff_and_can_update_status(self):
        lead = Lead.objects.create(**{**self.payload, 'consent': True})
        user = get_user_model().objects.create_user(username='crmuser')
        self.client.force_authenticate(user)
        self.assertEqual(self.client.get('/api/studio/leads').status_code, 403)
        user.is_staff = True
        user.save()
        self.assertEqual(self.client.get('/api/studio/leads').data['leads'][0]['name'], 'Client')
        self.assertEqual(self.client.patch('/api/studio/leads', {'id': str(lead.pk), 'status': 'won'}, format='json').status_code, 200)

class MediaCompatibilityTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = get_user_model().objects.create_user(username='video-compatibility-test')
    def upload(self):
        return SimpleUploadedFile('clip.mp4', b'test-source', content_type='video/mp4')
    def test_guest_can_prepare_preview(self):
        with patch('studio.media_compatibility.convert_video', side_effect=lambda source, output: output.write_bytes(b'preview')):
            response=self.client.post('/api/media/prepare', {'file':self.upload()})
            self.assertEqual(response.status_code,200)
            self.assertEqual(b''.join(response.streaming_content),b'preview')
            response.close()
    def test_rejects_missing_and_oversize_files(self):
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.post('/api/media/prepare').status_code, 400)
        with override_settings(MAX_UPLOAD_BYTES=1):
            self.assertEqual(self.client.post('/api/media/prepare', {'file':self.upload()}).status_code, 413)
    def test_streams_and_removes_temporary_files(self):
        from pathlib import Path
        directories = []
        def convert(source, output):
            directories.append(source.parent)
            self.assertEqual(source.read_bytes(), b'test-source')
            Path(output).write_bytes(b'compatible-video')
        self.client.force_authenticate(self.user)
        with patch('studio.media_compatibility.convert_video', side_effect=convert):
            response = self.client.post('/api/media/prepare', {'file':self.upload()})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(b''.join(response.streaming_content), b'compatible-video')
            response.close()
        self.assertFalse(directories[0].exists())
    def test_conversion_failure_cleans_up_and_releases_slot(self):
        import subprocess
        from studio.media_compatibility import _conversion_slot
        directories = []
        def fail(source, output):
            directories.append(source.parent)
            raise subprocess.CalledProcessError(1, ['ffmpeg'])
        self.client.force_authenticate(self.user)
        with patch('studio.media_compatibility.convert_video', side_effect=fail):
            self.assertEqual(self.client.post('/api/media/prepare', {'file':self.upload()}).status_code, 422)
        self.assertFalse(directories[0].exists())
        self.assertTrue(_conversion_slot.acquire(blocking=False))
        _conversion_slot.release()
    def test_only_one_conversion_at_a_time(self):
        from studio.media_compatibility import _conversion_slot
        self.client.force_authenticate(self.user)
        _conversion_slot.acquire()
        try:
            self.assertEqual(self.client.post('/api/media/prepare', {'file':self.upload()}).status_code, 429)
        finally:
            _conversion_slot.release()

class VideoPreparationCancellationTests(TestCase):
    def setUp(self):
        from uuid import uuid4
        self.client = APIClient()
        self.user = get_user_model().objects.create_user(username='cancel-test')
        self.client.force_authenticate(self.user)
        self.key = str(uuid4())
        self.url = '/api/media/prepare/' + self.key
    def test_cancel_before_upload_prevents_conversion(self):
        self.assertEqual(self.client.delete(self.url).status_code, 200)
        with patch('studio.media_compatibility.convert_video') as conversion:
            response = self.client.post('/api/media/prepare?job=' + self.key, {'file':SimpleUploadedFile('clip.mp4', b'video')})
        self.assertEqual(response.status_code, 409)
        conversion.assert_not_called()
        from studio.media_compatibility import _conversion_slot
        self.assertTrue(_conversion_slot.acquire(blocking=False))
        _conversion_slot.release()
    def test_cancel_is_scoped_to_user(self):
        from studio.media_compatibility import job_for
        job = job_for(self.user.pk, self.key)
        other = get_user_model().objects.create_user(username='another-editor')
        self.client.force_authenticate(other)
        self.client.delete(self.url)
        self.assertFalse(job['cancel'].is_set())
    def test_guest_status_is_separate_from_registered_user(self):
        from studio.media_compatibility import job_for
        registered=job_for(f'user:{self.user.pk}',self.key)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(self.url).status_code,200)
        self.assertEqual(self.client.delete(self.url).status_code,200)
        self.assertFalse(registered['cancel'].is_set())
    def test_cancel_terminates_running_converter(self):
        import tempfile
        from pathlib import Path
        from studio.media_compatibility import job_for, convert_video, PreparationCancelled
        job = job_for(self.user.pk, self.key)
        with tempfile.TemporaryDirectory() as directory, patch('studio.media_compatibility.imageio_ffmpeg.get_ffmpeg_exe', return_value='ffmpeg'), patch('studio.media_compatibility.subprocess.Popen') as spawn:
            process = spawn.return_value
            process.poll.return_value = None
            def start(*args, **kwargs):
                job['cancel'].set()
                return process
            spawn.side_effect = start
            with self.assertRaises(PreparationCancelled):
                convert_video(Path(directory)/'source.mp4', Path(directory)/'output.mp4', job)
            process.terminate.assert_called_once()
            process.wait.assert_called_once()
    def test_abandoned_job_stops_before_spawning(self):
        from studio.media_compatibility import job_for, convert_video, PreparationCancelled
        job = job_for(self.user.pk, self.key)
        job['seen'] -= 31
        with patch('studio.media_compatibility.subprocess.Popen') as spawn:
            with self.assertRaises(PreparationCancelled):
                convert_video('unused.mp4', 'unused-output.mp4', job)
            spawn.assert_not_called()
