import json
from pathlib import Path
import subprocess
import tempfile
from unittest.mock import patch
import imageio_ffmpeg
from django.conf import settings
from django.test import Client, TestCase, override_settings
from .models import Budget, Job
from .video_processing import gallery_file, media_data, probe, process_one, transcode


class ProcessingTests(TestCase):
    def setUp(self):
        temporary=tempfile.TemporaryDirectory(dir=Path(settings.BASE_DIR)/'.runtime')
        self.addCleanup(temporary.cleanup);self.root=Path(temporary.name)
        local=override_settings(MEDIA_ROOT=self.root);local.enable();self.addCleanup(local.disable)
        runner=patch('studio.video_processing.ensure_runner');runner.start();self.addCleanup(runner.stop)
        self.budget=Budget.objects.create(name='processing-test')
        (self.root/'original.mp4').write_bytes(b'original-with-sound')
        self.job=Job.objects.create(title='Scene',prompt='Test',model_id='wan22-5b',budget=self.budget,
                                   status='completed',mode='modal',video='original.mp4')

    def queue(self):
        return self.client.post(f'/api/creative/videos/{self.job.pk}/process/','{}',content_type='application/json')

    def gallery(self,value=True):
        return self.client.patch(f'/api/jobs/{self.job.pk}/',json.dumps({'in_gallery':value}),content_type='application/json')

    def test_legacy_files_stay_available_until_explicit_processing(self):
        self.assertEqual(gallery_file(self.job).name,'original.mp4')
        self.assertTrue(media_data(self.job)['gallery_ready'])
        response=self.queue();self.assertEqual(response.status_code,202)
        self.job.refresh_from_db();self.assertEqual(self.job.processing_status,'pending')
        self.assertIsNone(media_data(self.job)['video_url'])
        self.assertEqual(self.gallery().status_code,400)
        original=self.client.get(media_data(self.job)['original_url'])
        self.assertEqual(b''.join(original.streaming_content),b'original-with-sound')

    @patch('studio.video_processing.transcode')
    def test_processed_file_is_canonical_in_preview_download_and_klipanje_gallery(self,encode):
        def write(source,destination,speed):
            destination.parent.mkdir(parents=True,exist_ok=True);destination.write_bytes(b'small-silent')
            return {'max_edge':1200,'muted':True,'original_bytes':19,'processed_bytes':12}
        encode.side_effect=write;self.queue();process_one(self.job.pk);self.job.refresh_from_db()
        self.assertEqual(self.job.processing_status,'ready');self.assertEqual(self.job.video.name,'original.mp4')
        self.assertIn('?v=1200-',media_data(self.job)['video_url'])
        self.assertTrue(self.gallery().json()['in_gallery'])
        url=media_data(self.job)['video_url'];response=self.client.get(url,HTTP_RANGE='bytes=0-4')
        self.assertEqual(response.status_code,206);self.assertEqual(b''.join(response.streaming_content),b'small')
        download=self.client.get(media_data(self.job)['download_url']);self.assertIn('attachment',download['Content-Disposition'])
        self.assertEqual(b''.join(download.streaming_content),b'small-silent')
        listing=self.client.get('/api/creative/gallery/',HTTP_ORIGIN='http://127.0.0.1:5175').json()
        self.assertEqual(listing['jobs'][0]['video_url'],url)
        transfer=self.client.get(f'/api/creative/gallery/{self.job.pk}/video/',HTTP_ORIGIN='http://127.0.0.1:5175')
        self.assertEqual(b''.join(transfer.streaming_content),b'small-silent')
        process_one(self.job.pk);self.queue();encode.assert_called_once()

    @patch('studio.video_processing.transcode',side_effect=ValueError('test'))
    def test_failed_processing_preserves_original_and_can_retry_without_generation(self,encode):
        self.queue();process_one(self.job.pk);self.job.refresh_from_db()
        self.assertEqual(self.job.processing_status,'failed');self.assertEqual(self.job.status,'completed')
        self.assertIsNone(gallery_file(self.job));self.assertEqual(self.gallery().status_code,400)
        self.assertTrue(self.job.video.storage.exists(self.job.video.name));self.assertEqual(Job.objects.count(),1)
        self.queue();self.job.refresh_from_db();self.assertEqual(self.job.processing_status,'pending')
        self.assertEqual(self.job.processing_error,'')

    def test_missing_incomplete_and_csrf_rejected(self):
        self.assertEqual(Client(enforce_csrf_checks=True).post(f'/api/creative/videos/{self.job.pk}/process/').status_code,403)
        self.job.status='running';self.job.save();self.assertEqual(self.queue().status_code,400)
        self.job.status='completed';self.job.video='missing.mp4';self.job.save();self.assertEqual(self.queue().status_code,400)

    def test_speed_validation_and_pending_settings_are_persistent(self):
        url=f'/api/creative/videos/{self.job.pk}/process/'
        for speed in [True,0,3,'2',None]:
            self.assertEqual(self.client.post(url,json.dumps({'speed':speed}),content_type='application/json').status_code,400)
        self.assertEqual(self.client.post(url,json.dumps({'speed':1.5}),content_type='application/json').status_code,202)
        self.job.refresh_from_db();self.assertEqual(self.job.processing_speed,1.5)
        self.assertEqual(self.client.post(url,json.dumps({'speed':2}),content_type='application/json').status_code,409)
        self.assertEqual(self.client.post(url,json.dumps({'speed':1.5}),content_type='application/json').status_code,202)
        self.assertEqual(Job.objects.count(),1)

    @patch('studio.video_processing.transcode',return_value={})
    def test_restart_resumes_processing_and_missing_processed_never_falls_back_to_original(self,encode):
        self.job.processing_status='processing';self.job.save();process_one(self.job.pk);encode.assert_called_once()
        self.job.refresh_from_db();self.job.processing_status='ready';self.job.processed_video='gone.mp4';self.job.save()
        self.assertIsNone(gallery_file(self.job));self.assertEqual(self.gallery().status_code,400)
        self.queue();self.job.refresh_from_db();self.assertEqual(self.job.processing_status,'pending')

    def test_real_local_export_caps_dimensions_removes_audio_and_preserves_duration(self):
        source=self.root/'audio-source.mp4';destination=self.root/'processed'/'silent.mp4'
        subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-hide_banner','-loglevel','error','-y',
            '-f','lavfi','-i','testsrc2=size=1344x768:rate=24','-f','lavfi','-i','sine=frequency=440',
            '-t','1','-c:v','libx264','-preset','ultrafast','-c:a','aac',str(source)],check=True,timeout=30,
            capture_output=True,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
        self.assertTrue(probe(source)['audio'])
        info=transcode(source,destination);result=probe(destination)
        self.assertEqual(result['width'],1200);self.assertLessEqual(result['height'],1200)
        self.assertFalse(result['audio']);self.assertAlmostEqual(result['duration'],1,delta=.05)
        self.assertLess(info['processed_bytes'],info['original_bytes']);self.assertTrue(source.exists())
        self.assertFalse(destination.with_suffix('.part.mp4').exists())
        accelerated=self.root/'processed'/'fast.mp4'
        fast=transcode(source,accelerated,2)
        self.assertEqual(fast['speed'],2);self.assertAlmostEqual(probe(accelerated)['duration'],.5,delta=.12)
        self.assertNotEqual(fast['revision'],info['revision'])
