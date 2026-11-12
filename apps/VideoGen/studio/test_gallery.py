import json
import tempfile
from pathlib import Path
from django.test import TestCase, override_settings
from django.conf import settings as django_settings
from .models import Budget, Job


class GalleryTests(TestCase):
    def setUp(self):
        runtime = Path(django_settings.BASE_DIR) / '.runtime'
        runtime.mkdir(exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=runtime)
        self.addCleanup(self.temp.cleanup)
        settings = override_settings(MEDIA_ROOT=self.temp.name, VIDEOGEN_ALLOW_PAID=False)
        settings.enable()
        self.addCleanup(settings.disable)
        self.budget = Budget.objects.create(name='tests')
        Path(self.temp.name, 'scene.mp4').write_bytes(b'local-test-placeholder')

    def job(self, **changes):
        values = dict(title='Gallery test', prompt='Test scene', model_id='wan21-1.3b', budget=self.budget, status='completed', mode='demo', video='scene.mp4')
        values.update(changes)
        return Job.objects.create(**values)

    def gallery(self, job, value):
        return self.client.patch(f'/api/jobs/{job.pk}/', json.dumps({'in_gallery': value}), content_type='application/json')

    def test_gallery_is_explicit_persistent_and_removal_preserves_original(self):
        job = self.job()
        self.assertFalse(job.in_gallery)
        self.assertTrue(self.gallery(job, True).json()['in_gallery'])
        self.assertTrue(next(j for j in self.client.get('/api/bootstrap/').json()['jobs'] if j['id'] == str(job.pk))['in_gallery'])
        self.assertFalse(self.gallery(job, False).json()['in_gallery'])
        job.refresh_from_db()
        self.assertEqual(job.video.name, 'scene.mp4')
        self.assertTrue(Path(self.temp.name, 'scene.mp4').exists())
        self.assertEqual(job.status, 'completed')
        self.assertIsNone(job.billed_usd)

    def test_rejects_incomplete_missing_and_non_boolean(self):
        for job in [self.job(status='running'), self.job(video=''), self.job(video='missing.mp4')]:
            self.assertEqual(self.gallery(job, True).status_code, 400)
        self.assertEqual(self.gallery(self.job(), 'true').status_code, 400)

    def test_old_gallery_entries_survive_history_limit(self):
        old = self.job(in_gallery=True)
        Job.objects.bulk_create([Job(title=f'New {n}', model_id='wan21-1.3b', budget=self.budget) for n in range(101)])
        rows = self.client.get('/api/bootstrap/').json()['jobs']
        self.assertIn(str(old.pk), [row['id'] for row in rows])

    def test_gallery_requires_csrf_with_browser_client(self):
        from django.test import Client
        job = self.job()
        response = Client(enforce_csrf_checks=True).patch(f'/api/jobs/{job.pk}/', json.dumps({'in_gallery': True}), content_type='application/json')
        self.assertEqual(response.status_code, 403)
