import base64
from tempfile import TemporaryDirectory
from unittest.mock import patch, MagicMock
from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.http import HttpResponse
from rest_framework.response import Response
import httpx
from .models import Project,Workspace,Membership,LocalScript,MediaAsset
from .creative import image_provider_error

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

    @override_settings(OPENAI_API_KEY='test-only')
    def test_new_cast_member_uses_same_project_style_then_own_identity(self):
        anchor=MediaAsset.objects.create(project=self.project,name='bear.png',file='unused.png',content_type='image/png',size=10)
        foreign_project=Project.objects.create(created_by=self.other,workspace=self.project.workspace,name='Private')
        foreign=MediaAsset.objects.create(project=foreign_project,name='private.png',file='unused.png',content_type='image/png',size=10)
        self.project.brief.update(description='A sunny seaside adventure',storyRules='Gentle narrator',characters=[
            {'id':'foreign','name':'Other','referenceId':str(foreign.pk)},
            {'id':'bear','name':'Ibrahim','appearance':'Brown bear with fez','views':{'body-front':str(anchor.pk)}},
            {'id':'rabbit','name':'Zeko','appearance':'Gray rabbit','prompt':'Show five views.'},
        ])
        self.project.save()
        body={**self.body,'character':'rabbit'}
        with patch('studio.creative.request_image',return_value=Response({'error':'test stop'},status=502)) as provider:
            self.client.post('/api/creative/character',body,content_type='application/json')
            _,refs,prompt,_=provider.call_args.args
            self.assertEqual([a.pk for a in refs],[anchor.pk])
            for text in ['style ONLY, not identity','A sunny seaside adventure','Gentle narrator','Gray rabbit','FINAL OUTPUT REQUIREMENT','ONE view']:
                self.assertIn(text,prompt)
            own=MediaAsset.objects.create(project=self.project,name='rabbit.png',file='unused.png',content_type='image/png',size=10)
            self.project.brief['characters'][-1]['views']={'head-front':str(own.pk)}
            self.project.save()
            self.client.post('/api/creative/character',{**body,'view':'head-side'},content_type='application/json')
            _,refs,prompt,_=provider.call_args.args
            self.assertEqual([a.pk for a in refs],[own.pk])
            self.assertIn('identity of requested character',prompt)

    @override_settings(OPENAI_API_KEY='secret-test-key')
    def test_provider_failure_distinguishes_validation_and_safety_without_exposing_key(self):
        response=httpx.Response(400,json={'error':{'code':'invalid_value','param':'size','message':'Invalid size secret-test-key'}},headers={'x-request-id':'req-test-123'})
        with self.assertLogs('studio.creative',level='WARNING') as logs:
            result=image_provider_error(response)
        self.assertIn('invalid_value',result.data['error'])
        self.assertIn('size',result.data['error'])
        self.assertEqual(result.data['providerRequestId'],'req-test-123')
        self.assertNotIn('secret-test-key',str(result.data)+str(logs.output))
        self.assertNotIn('Invalid size',str(logs.output))
        blocked=image_provider_error(httpx.Response(400,json={'error':{'code':'moderation_blocked','message':'Request rejected'}}))
        self.assertIn('sigurnosna provjera',blocked.data['error'])
        malformed=image_provider_error(httpx.Response(502,text='<html>upstream failure</html>'))
        self.assertNotIn('<html>',malformed.data['error'])

    @override_settings(ELEVENLABS_API_KEY='test-only')
    def test_sound_effect_generation_removed(self):
        self.assertEqual(self.client.post('/api/sound-effect', {'text':'Dog'}, content_type='application/json').status_code, 404)

    def test_scene_and_outfit_expansion_preview_and_reference_access(self):
        reference=MediaAsset.objects.create(project=self.project,name='room.png',file='unused.png',content_type='image/png',size=10)
        self.project.brief['scenes']=[{'name':'Room','prompt':'White blanket, beige headboard','isDefault':True,'referenceId':str(reference.pk)}]
        self.project.save()
        script=LocalScript.objects.create(project=self.project,owner=self.user,title='Test',content='Mila walks.',segments=[{'id':'one','text':'Mila walks.','start':0,'end':3}])
        body={'script':str(script.pk),'segment':'one','prompt':'[Lik: Mila; Odjeća: Kiša]','model':'gpt-image-2.5-flare'}
        with patch('studio.creative.request_image') as paid:
            response=self.client.post('/api/creative/prompt',body,content_type='application/json')
            self.assertEqual(response.status_code,200,response.content)
            self.assertIn('White blanket',response.json()['prompt'])
            self.assertIn('Yellow raincoat',response.json()['prompt'])
            self.assertNotIn('Blue coat',response.json()['prompt'])
            self.assertEqual(response.json()['references'][0]['id'],str(reference.pk))
            paid.assert_not_called()
            foreign_project=Project.objects.create(created_by=self.other,workspace=self.project.workspace,name='Private')
            foreign=MediaAsset.objects.create(project=foreign_project,name='private.png',file='unused.png',content_type='image/png',size=10)
            self.project.brief['scenes'][0]['referenceId']=str(foreign.pk);self.project.save()
            self.assertEqual(self.client.post('/api/creative/prompt',body,content_type='application/json').status_code,400)
