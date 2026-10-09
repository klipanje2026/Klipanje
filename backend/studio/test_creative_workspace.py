import base64
from decimal import Decimal
from tempfile import TemporaryDirectory
from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings

from .image_spend import image_cost, record_image
from .models import ImageSpend, LocalScript, Membership, Project, ProjectChapter, Workspace, MediaAsset


class CreativeWorkspaceTests(TestCase):
    def setUp(self):
        self.owner = get_user_model().objects.create_user(username='writer')
        self.other = get_user_model().objects.create_user(username='other-writer')
        workspace = Workspace.objects.create(name='Local')
        Membership.objects.create(user=self.owner, workspace=workspace, role='owner')
        self.project = Project.objects.create(workspace=workspace, created_by=self.owner, name='Film', kind='production')
        self.other_project = Project.objects.create(workspace=workspace, created_by=self.other, name='Private', kind='production')
        self.script = LocalScript.objects.create(owner=self.owner, project=self.project, title='Episode', content='A walk.')
        self.client.force_login(self.owner)
        self.usage = {'input_tokens': 300, 'input_tokens_details': {'text_tokens': 100, 'image_tokens': 200}, 'output_tokens': 1000}

    def test_chapters_are_private_and_cannot_cross_projects(self):
        result = self.client.post('/api/chapters', {'project': str(self.project.pk), 'title': 'Chapter 1'}, content_type='application/json')
        self.assertEqual(result.status_code, 201)
        chapter = result.json()['id']
        result = self.client.patch(f'/api/scripts/{self.script.pk}', {'chapter': chapter}, content_type='application/json')
        self.assertEqual(result.status_code, 200)
        self.script.refresh_from_db()
        self.assertEqual(str(self.script.chapter_id), chapter)
        foreign = ProjectChapter.objects.create(project=self.other_project, title='Private chapter')
        result = self.client.patch(f'/api/scripts/{self.script.pk}', {'chapter': str(foreign.pk)}, content_type='application/json')
        self.assertEqual(result.status_code, 400)
        second = Project.objects.create(workspace=self.project.workspace, created_by=self.owner, name='Second film', kind='production')
        different = ProjectChapter.objects.create(project=second, title='Different chapter')
        result = self.client.patch(f'/api/scripts/{self.script.pk}', {'chapter': str(different.pk)}, content_type='application/json')
        self.assertEqual(result.status_code, 400)
        self.client.force_login(self.other)
        self.assertEqual(self.client.get(f'/api/chapters/{chapter}').status_code, 404)
        self.assertEqual([row['id'] for row in self.client.get('/api/chapters').json()], [str(foreign.pk)])
        result = self.client.post('/api/chapters', {'project': str(self.project.pk), 'title': 'Forbidden'}, content_type='application/json')
        self.assertEqual(result.status_code, 400)

    def test_usage_is_exact_when_known_and_explicit_when_unavailable(self):
        self.assertEqual(image_cost('gpt-image-2.5-flare', self.usage), Decimal('0.0321'))
        self.assertEqual(image_cost('gpt-image-2.5-sunburst', self.usage), Decimal('0.0321'))
        for usage in [{}, {**self.usage, 'input_tokens': 301}, {**self.usage, 'output_tokens': -1}, {**self.usage, 'input_tokens_details': []}]:
            self.assertIsNone(image_cost('gpt-image-2.5-flare', usage))
        self.assertIsNone(image_cost('unknown-model', self.usage))
        record_image(self.owner, 'gpt-image-2.5-flare', self.usage)
        record_image(self.other, 'gpt-image-2.5-sunburst', {})
        result = self.client.get('/api/creative/usage')
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.json()['estimatedUsd'], 0.0321)
        self.assertEqual(result.json()['unpriced'], 1)
        self.assertFalse(result.json()['accountBalanceAvailable'])
        self.assertEqual(result.json()['scope'], 'local-images')
        self.assertEqual(result['Cache-Control'], 'no-store')
        self.client.logout()
        self.assertEqual(self.client.get('/api/creative/usage').status_code, 403)

    def test_provider_usage_survives_image_conversion_failure(self):
        body = {'script': str(self.script.pk), 'model': 'gpt-image-2.5-flare', 'prompt': 'A forest', 'aspect': '16:9'}
        png = b'\x89PNG\r\n\x1a\nmock-image'
        with TemporaryDirectory() as directory, override_settings(MEDIA_ROOT=directory, OPENAI_API_KEY='test-only'), patch('studio.creative.httpx.Client') as provider, patch('studio.creative.subprocess.run', side_effect=OSError):
            client = provider.return_value.__enter__.return_value
            client.post.return_value = MagicMock(status_code=200)
            client.post.return_value.json.return_value = {'data': [{'b64_json': base64.b64encode(png).decode()}], 'usage': self.usage}
            result = self.client.post('/api/creative/generate', body, content_type='application/json')
        self.assertEqual(result.status_code, 502)
        self.assertFalse(self.project.assets.exists())
        self.assertEqual(ImageSpend.objects.get().estimated_usd, Decimal('0.0321'))


    def test_canonical_character_reference_is_automatically_supplied(self):
        reference=MediaAsset.objects.create(project=self.project,name='mila.png',file='test/mila.png',size=12,content_type='image/png',metadata={'purpose':'reference'})
        self.project.brief={'description':'Forest series','characters':[{'name':'Mila','description':'Blue coat, brown hair','referenceId':str(reference.pk)}],'storyRules':'First person narration','avoid':'Do not change clothing'};self.project.save()
        result=self.client.post('/api/creative/prompt',{'script':str(self.script.pk),'model':'gpt-image-2.5-sunburst','prompt':'Mila walks in the forest'},content_type='application/json')
        self.assertEqual(result.status_code,200)
        self.assertEqual(result.json()['references'][0]['id'],str(reference.pk))
        for item in ['Mila','Blue coat','First person narration','Do not change clothing','Reference identity mapping']:
            self.assertIn(item,result.json()['prompt'])
        result=self.client.post('/api/creative/prompt',{'script':str(self.script.pk),'model':'gpt-image-2.5-sunburst','prompt':'A forest without characters'},content_type='application/json')
        self.assertEqual(result.json()['references'],[])

    def test_gallery_acceptance_is_private_and_preserves_generation_metadata(self):
        asset=MediaAsset.objects.create(project=self.project,name='scene.png',file='test/scene.png',size=12,content_type='image/png',metadata={'gallery':False,'model':'gpt-image-2.5-flare','scriptId':str(self.script.pk)})
        route=f'/api/assets/{asset.pk}'
        result=self.client.patch(route,{'metadata':{'gallery':True}},content_type='application/json')
        self.assertEqual(result.status_code,200)
        self.assertTrue(result.json()['metadata']['gallery'])
        self.assertEqual(result.json()['metadata']['model'],'gpt-image-2.5-flare')
        self.assertEqual(self.client.patch(route,{'metadata':{'model':'changed'}},content_type='application/json').status_code,400)
        self.client.force_login(self.other)
        self.assertEqual(self.client.patch(route,{'metadata':{'gallery':False}},content_type='application/json').status_code,404)

    @override_settings(OPENAI_API_KEY='test-only',OPENAI_MODEL='gpt-4.1-mini')
    def test_ai_script_uses_project_rules_and_characters_without_saving_provider_history(self):
        self.project.brief={'storyRules':'Use first person','avoid':'Never rename Mila','characters':[{'name':'Mila','description':'Blue coat'}]};self.project.save()
        with patch('studio.creative.httpx.Client') as provider:
            client=provider.return_value.__enter__.return_value
            client.post.return_value=MagicMock(is_success=True)
            client.post.return_value.json.return_value={'output':[{'content':[{'type':'output_text','text':'Mila je otvorila vrata.'}]}]}
            result=self.client.post('/api/creative/script',{'script':str(self.script.pk),'direction':'A short episode'},content_type='application/json')
            self.assertEqual(result.status_code,200)
            payload=client.post.call_args.kwargs['json']
            self.assertFalse(payload['store'])
            for item in ['Use first person','Never rename Mila','Blue coat']:self.assertIn(item,payload['instructions'])
            self.assertEqual(result.json()['text'],'Mila je otvorila vrata.')
            self.script.refresh_from_db();self.assertEqual(self.script.content,'A walk.')
            self.client.force_login(self.other)
            self.assertEqual(self.client.post('/api/creative/script',{'script':str(self.script.pk),'direction':'A short episode'},content_type='application/json').status_code,404)

    @override_settings(ELEVENLABS_API_KEY='test-only')
    def test_regional_voice_previews_do_not_unlock_free_api_access(self):
        from django.core.cache import cache
        cache.clear()
        def mock_request(method,path):
            if 'subscription' in path:return MagicMock(is_success=True,json=lambda:{'tier':'free'})
            from .regional_voices import CHOICES
            return MagicMock(is_success=True,json=lambda:{'voices':[{'voice_id':identifier,'gender':'male','language':'hr','preview_url':'https://example.com/preview.mp3'} for identifier,_,_ in CHOICES]})
        with patch('studio.regional_voices.json_request',side_effect=mock_request):
            result=self.client.get('/api/voices/regional')
            self.assertEqual(result.status_code,200)
            self.assertEqual(len(result.json()['voices']),3)
            self.assertTrue(all(not v['available'] for v in result.json()['voices']))
            self.assertTrue(all(v['previewUrl'] for v in result.json()['voices']))
        cache.clear()
