import tempfile
from pathlib import Path
from django.test import TestCase,override_settings
from django.conf import settings
from django.core.files.base import ContentFile
from studio.models import Budget,Job
class VideoStreamingTests(TestCase):
 def setUp(self):
  runtime=Path(settings.BASE_DIR)/'.runtime';runtime.mkdir(exist_ok=True);self.tmp=tempfile.TemporaryDirectory(dir=runtime);self.addCleanup(self.tmp.cleanup)
  scope=override_settings(MEDIA_ROOT=self.tmp.name);scope.enable();self.addCleanup(scope.disable)
  self.job=Job.objects.create(title='Video',model_id='wan22-5b',budget=Budget.objects.create(name='creative'),status='completed');self.job.video.save('test.mp4',ContentFile(b'0123456789'),save=True);self.url=f'/api/creative/videos/{self.job.pk}/'
 def test_full_video_and_byte_range_for_seeking(self):
  response=self.client.get(self.url);self.assertEqual(response.status_code,200);self.assertEqual(b''.join(response.streaming_content),b'0123456789');self.assertEqual(response['Accept-Ranges'],'bytes')
  response=self.client.get(self.url,HTTP_RANGE='bytes=2-5');self.assertEqual(response.status_code,206);self.assertEqual(response['Content-Range'],'bytes 2-5/10');self.assertEqual(b''.join(response.streaming_content),b'2345')
 def test_suffix_and_open_ended_ranges(self):
  for spec,expected in [('bytes=-3',b'789'),('bytes=7-',b'789')]:
   response=self.client.get(self.url,HTTP_RANGE=spec);self.assertEqual(response.status_code,206);self.assertEqual(b''.join(response.streaming_content),expected)
 def test_invalid_multi_and_out_of_bounds_ranges(self):
  for spec in ['bytes=15-20','bytes=0-1,5-6','bytes=-0','bytes=-','bytes=5-2']:
   response=self.client.get(self.url,HTTP_RANGE=spec);self.assertEqual(response.status_code,416);self.assertEqual(response['Content-Range'],'bytes */10')
 def test_head_and_missing_media(self):
  response=self.client.head(self.url);self.assertEqual(response.status_code,200);self.assertEqual(response['Content-Length'],'10');self.assertEqual(response.content,b'')
  self.job.video.name='missing.mp4';self.job.save();self.assertEqual(self.client.get(self.url).status_code,404)
