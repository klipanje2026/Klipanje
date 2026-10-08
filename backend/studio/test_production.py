from unittest.mock import patch, MagicMock
from tempfile import TemporaryDirectory
import base64
from django.contrib.auth import get_user_model
from django.test import TestCase,override_settings
from django.core.files.base import ContentFile
from .models import Project,Workspace,Membership,LocalScript,MediaAsset

PNG=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1kAAAAASUVORK5CYII=')
class ProductionTests(TestCase):
 def setUp(self):
  self.user=get_user_model().objects.create_user(username='producer')
  self.other=get_user_model().objects.create_user(username='other')
  self.workspace=Workspace.objects.create(name='Local')
  Membership.objects.create(user=self.user,workspace=self.workspace,role='owner')
  self.project=Project.objects.create(workspace=self.workspace,created_by=self.user,name='Film',kind='production',brief={'description':'A forest','characters':[{'name':'Mila','description':'Blue coat'}]})
  self.script=LocalScript.objects.create(owner=self.user,project=self.project,title='Scene',content='A walk.',segments=[{'id':'one','start':0,'end':5,'text':'A forest walk.'}],image_prompt='Warm sunset')
  self.client.force_login(self.user)
  self.body={'script':str(self.script.pk),'segment':'one','prompt':'Wide shot','model':'gpt-image-2.5-flare','style':'cinematic','references':[]}
 def test_project_required_and_intervals_validated(self):
  self.assertEqual(self.client.post('/api/scripts',{'title':'Missing','content':''},content_type='application/json').status_code,400)
  r=self.client.patch(f'/api/scripts/{self.script.pk}',{'segments':[{'id':'bad','start':5,'end':1,'text':''}]},content_type='application/json')
  self.assertEqual(r.status_code,400)
  self.assertEqual(self.client.get('/api/scripts?project=invalid').status_code,400)
  self.client.force_login(self.other)
  self.assertEqual(self.client.post('/api/scripts',{'project':str(self.project.pk),'title':'Other','content':''},content_type='application/json').status_code,400)
  self.assertEqual(self.client.post('/api/creative/prompt',self.body,content_type='application/json').status_code,404)
 def test_prompt_composes_context_and_rejects_unowned_reference(self):
  with patch('studio.creative.httpx.Client') as provider:
   r=self.client.post('/api/creative/prompt',self.body,content_type='application/json')
   self.assertEqual(r.status_code,200)
   for text in ['A forest','Mila','Warm sunset','A forest walk.','Wide shot']:
    self.assertIn(text,r.json()['prompt'])
   provider.assert_not_called()
  r=self.client.post('/api/creative/prompt',{**self.body,'references':['00000000-0000-0000-0000-000000000001']},content_type='application/json')
  self.assertEqual(r.status_code,400)
 def test_generate_persists_locally_and_uses_edit_endpoint_for_reference(self):
  with TemporaryDirectory() as directory,override_settings(MEDIA_ROOT=directory,OPENAI_API_KEY='test-only'),patch('studio.creative.httpx.Client') as provider:
   client=provider.return_value.__enter__.return_value
   client.post.return_value=MagicMock(status_code=200)
   client.post.return_value.json.return_value={'data':[{'b64_json':base64.b64encode(PNG).decode()}]}
   r=self.client.post('/api/creative/generate',self.body,content_type='application/json')
   self.assertEqual(r.status_code,201,r.content)
   self.assertTrue(client.post.call_args.args[0].endswith('/generations'))
   self.assertNotIn('response_format',client.post.call_args.kwargs['json'])
   asset=MediaAsset.objects.get(pk=r.json()['id'])
   self.assertEqual(asset.file.read(),PNG)
   asset.file.close()
   r=self.client.post('/api/creative/generate',{**self.body,'references':[str(asset.pk)],'model':'gpt-image-2.5-sunburst'},content_type='application/json')
   self.assertEqual(r.status_code,201,r.content)
   self.assertTrue(client.post.call_args.args[0].endswith('/edits'))
   self.assertEqual(client.post.call_args.kwargs['files'][0][0],'image[]')
