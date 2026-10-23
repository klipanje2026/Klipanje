from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
import httpx

from .models import Project, Workspace, LocalScript, ImageSpend, NarrationSpend, MediaAsset
from .ai import record_narration


class AdminUsageTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username='owner', is_staff=True)
        self.other = get_user_model().objects.create_user(username='other')
        self.project = Project.objects.create(workspace=Workspace.objects.create(name='Local'), created_by=self.user, name='Story', kind='production')
        self.script = LocalScript.objects.create(owner=self.user, project=self.project, title='Scene', content='Hello')
        self.client.force_login(self.user)

    def test_statistics_and_historical_crops_are_not_double_counted(self):
        ImageSpend.objects.create(user=self.user, project=self.project, model='test', estimated_usd=Decimal('0.25'))
        ImageSpend.objects.create(user=self.user, model='test', estimated_usd=Decimal('1'))
        NarrationSpend.objects.create(user=self.user, project=self.project, model='v2', characters=100, credits=50)
        NarrationSpend.objects.create(user=self.user, project=self.project, model='v4', characters=20)
        for meta in [{'fullPrompt':'old','estimatedUsd':0.1}, {'fullPrompt':'new','spendId':'ledger','estimatedUsd':0.25}, {'localCrop':True,'fullPrompt':'crop','estimatedUsd':0}]:
            MediaAsset.objects.create(project=self.project, name='test.png', file='test.png', content_type='image/png', size=1, metadata=meta)
        result = self.client.get('/api/administration').json()
        self.assertEqual(result['usage']['estimatedUsd'], 1.25)
        usage = result['projects'][0]['usage']
        self.assertEqual(usage['images'], 1)
        self.assertEqual(usage['historicalImages'], 1)
        self.assertEqual(usage['historicalUsd'], 0.1)
        self.assertEqual(usage['credits'], 50)
        self.assertEqual(usage['characters'], 120)
        self.assertEqual(usage['unknownCredits'], 1)
        self.client.force_login(self.other)
        self.assertEqual(self.client.get('/api/administration').status_code, 403)

    def test_unknown_credit_cost_is_not_zero(self):
        request = SimpleNamespace(user=self.user, narration_project=self.project)
        for value in [None, 'NaN', '-1', 'not-a-number']:
            record_narration(request, {'model':'test','text':'hello'}, value)
        self.assertEqual(NarrationSpend.objects.filter(credits__isnull=True).count(), 4)
        record_narration(request, {'model':'test','text':'hello'}, '2.5')
        self.assertEqual(NarrationSpend.objects.get(credits__isnull=False).credits, Decimal('2.5'))

    @override_settings(LOCAL_APP=True, ELEVENLABS_API_KEY='test-only')
    def test_narration_records_provider_cost_and_rejects_foreign_script(self):
        body = {'script':str(self.script.pk), 'voiceId':'voice', 'text':'Hello', 'timestamps':True}
        with patch('studio.ai.httpx.post', return_value=httpx.Response(200, headers={'character-cost':'2.5'}, json={'audio_base64':'YQ=='})) as provider:
            self.assertEqual(self.client.post('/api/narration', body, content_type='application/json').status_code, 200)
            row = NarrationSpend.objects.get()
            self.assertEqual(row.project, self.project)
            self.assertEqual(row.credits, Decimal('2.5'))
            self.script.owner = self.other
            self.script.save()
            self.assertEqual(self.client.post('/api/narration', body, content_type='application/json').status_code, 404)
            self.assertEqual(provider.call_count, 1)
