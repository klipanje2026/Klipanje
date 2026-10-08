from unittest.mock import patch,MagicMock
from django.test import TestCase,override_settings
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from .models import Workspace,Membership,Project,MultipartMediaUpload,MediaAsset
from .multipart_upload import PART_SIZE

@override_settings(STORAGE_BACKEND='r2',ACCESS_APPROVAL_REQUIRED=False)
class MultipartTests(TestCase):
 def setUp(self):
  self.user=get_user_model().objects.create_user('u',is_staff=True);self.other=get_user_model().objects.create_user('other',is_staff=True)
  workspace=Workspace.objects.create(name='w');Membership.objects.create(user=self.user,workspace=workspace)
  self.project=Project.objects.create(workspace=workspace,created_by=self.user,name='video',kind='video')
  self.client=APIClient();self.client.force_authenticate(self.user)
  self.storage=MagicMock();self.storage.bucket_name='test-only';self.remote=self.storage.connection.meta.client
  self.remote.create_multipart_upload.return_value={'UploadId':'remote-id'}
  self.remote.upload_part.return_value={'ETag':'part-etag'}
  self.patcher=patch('studio.multipart_upload.default_storage',self.storage);self.patcher.start();self.addCleanup(self.patcher.stop)
 def begin(self,size=PART_SIZE+3):
  r=self.client.post(f'/api/projects/{self.project.pk}/uploads',{'name':'clip.mp4','contentType':'video/mp4','size':size},format='json');self.assertEqual(r.status_code,201);return r.data['id']
 def test_parts_and_idempotent_finish(self):
  key=self.begin();file=SimpleUploadedFile('part',b'x'*PART_SIZE)
  self.assertEqual(self.client.post(f'/api/uploads/{key}/parts/1',{'file':file}).status_code,200)
  self.assertEqual(self.client.post(f'/api/uploads/{key}',{},format='json').status_code,409)
  file=SimpleUploadedFile('part',b'end');self.assertEqual(self.client.post(f'/api/uploads/{key}/parts/2',{'file':file}).status_code,200)
  self.remote.head_object.return_value={'ContentLength':PART_SIZE+3}
  with patch('studio.multipart_upload.asset_payload',side_effect=lambda a:{'id':str(a.pk)}):
   self.assertEqual(self.client.post(f'/api/uploads/{key}',{},format='json').status_code,201)
   self.assertEqual(self.client.post(f'/api/uploads/{key}',{},format='json').status_code,200)
  self.assertEqual(MediaAsset.objects.count(),1)
 def test_ownership_and_size(self):
  key=self.begin();self.client.force_authenticate(self.other)
  self.assertEqual(self.client.post(f'/api/uploads/{key}/parts/1',{'file':SimpleUploadedFile('p',b'x')}).status_code,404)
  self.assertEqual(self.client.post(f'/api/uploads/{key}',{},format='json').status_code,404)
  self.client.force_authenticate(self.user)
  self.assertEqual(self.client.post(f'/api/uploads/{key}/parts/1',{'file':SimpleUploadedFile('p',b'x')}).status_code,400)
  self.assertEqual(self.remote.upload_part.call_count,0)
 def test_cancel(self):
  key=self.begin();self.assertEqual(self.client.delete(f'/api/uploads/{key}').status_code,204)
  self.assertFalse(MultipartMediaUpload.objects.exists());self.remote.abort_multipart_upload.assert_called()
 def test_large_file_not_one_request(self):
  self.begin(1024**3);self.assertEqual(self.remote.create_multipart_upload.call_count,1)
  self.assertEqual(self.remote.upload_part.call_count,0)

 def test_resume_only_returns_owned_confirmed_parts(self):
  key=self.begin();self.client.post(f'/api/uploads/{key}/parts/1',{'file':SimpleUploadedFile('part',b'x'*PART_SIZE)})
  r=self.client.get(f'/api/uploads/{key}');self.assertEqual(r.status_code,200)
  self.assertEqual(r.data['parts'],['1']);self.assertEqual(r.data['projectId'],str(self.project.pk))
  self.client.force_authenticate(self.other);self.assertEqual(self.client.get(f'/api/uploads/{key}').status_code,404)
 def test_ten_gib_boundary(self):
  self.begin(10*1024**3)
  r=self.client.post(f'/api/projects/{self.project.pk}/uploads',{'name':'clip.mp4','contentType':'video/mp4','size':10*1024**3+1},format='json')
  self.assertEqual(r.status_code,413)
