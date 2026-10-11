import base64
from tempfile import TemporaryDirectory
from unittest.mock import patch, MagicMock
from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.http import HttpResponse
from .models import Project,Workspace,Membership,LocalScript

class ProfileTests(TestCase):
    def setUp(self):
        self.user=get_user_model().objects.create_user(username='profiles')
        self.other=get_user_model().objects.create_user(username='other-profile')
        workspace=Workspace.objects.create(name='Test')
        Membership.objects.create(user=self.user,workspace=workspace,role='owner')
        self.project=Project.objects.create(created_by=self.user,workspace=workspace,name='Moj film',kind='production',brief={'characters':[{'id':'mila','name':'Mila','appearance':'Green eyes','personality':'Curious','clothing':'Blue coat','outfits':[{'id':'rain','name':'Kiša','description':'Yellow raincoat'}]}]})
        self.client.force_login(self.user)
        self.body={'project':str(self.project.pk),'character':'mila','view':'head-front','model':'gpt-image-2.5-flare'}

    def test_profile_generation_uses_description_without_optional_prompt(self):
        with TemporaryDirectory() as directory,override_settings(MEDIA_ROOT=directory,OPENAI_API_KEY='test-only'),patch('studio.creative.httpx.Client') as provider:
            client=provider.return_value.__enter__.return_value
            client.post.return_value=MagicMock(status_code=200)
            client.post.return_value.json.return_value={'data':[{'b64_json':base64.b64encode(b'\x89PNG\r\n\x1a\nmock').decode()}]}
            result=self.client.post('/api/creative/character',self.body,content_type='application/json')
            self.assertEqual(result.status_code,201,result.content)
            prompt=client.post.call_args.kwargs['json']['prompt']
            for text in ['Green eyes','Curious','Blue coat','facing directly forward']:self.assertIn(text,prompt)
            result=self.client.post('/api/creative/character',{**self.body,'view':'body-back','outfit':'rain'},content_type='application/json')
            self.assertEqual(result.status_code,201,result.content)
            self.assertIn('Yellow raincoat',client.post.call_args.kwargs['json']['prompt'])
            self.assertEqual(result.json()['metadata']['outfitId'],'rain')

    def test_profile_and_delete_access_are_private(self):
        self.client.force_login(self.other)
        with patch('studio.creative.httpx.Client') as provider:
            self.assertEqual(self.client.post('/api/creative/character',self.body,content_type='application/json').status_code,404)
            provider.assert_not_called()
        self.assertEqual(self.client.delete(f'/api/projects/{self.project.pk}').status_code,404)
        self.client.force_login(self.user)
        script=LocalScript.objects.create(project=self.project,owner=self.user,title='Episode')
        self.assertEqual(self.client.delete(f'/api/projects/{self.project.pk}').status_code,204)
        self.assertFalse(LocalScript.objects.filter(pk=script.pk).exists())

    @override_settings(ELEVENLABS_API_KEY='test-only')
    def test_sound_effect_generation_removed(self):
        self.assertEqual(self.client.post('/api/sound-effect', {'text':'Dog'}, content_type='application/json').status_code, 404)
