from unittest.mock import patch
import httpx
from django.test import override_settings
from .test_production import ProductionTests


class NarrationSyncTests(ProductionTests):
    @override_settings(LOCAL_APP=True, ELEVENLABS_API_KEY='test-only')
    def test_timestamp_request_preserves_speed_and_alignment(self):
        response=httpx.Response(200,json={'audio_base64':'YWJj','alignment':{'characters':['A'],'character_start_times_seconds':[0],'character_end_times_seconds':[.2]}})
        with patch('studio.ai.voice_guard',return_value=None),patch('studio.ai.httpx.post',return_value=response) as provider:
            result=self.client.post('/api/narration',{'voiceId':'test','text':'A','speed':1.15,'timestamps':True},content_type='application/json')
        self.assertEqual(result.status_code,200)
        self.assertEqual(result.json()['alignment']['characters'],['A'])
        self.assertIn('/with-timestamps',provider.call_args.args[0])
        self.assertEqual(provider.call_args.kwargs['json']['voice_settings']['speed'],1.15)

    def test_grouped_frames_use_combined_context_and_validate_membership(self):
        self.script.segments.extend([{'id':'two','start':5,'end':7,'text':'Friends arrive.'},{'id':'three','start':7,'end':9,'text':'They rest.'}])
        self.script.save()
        result=self.client.post('/api/creative/prompt',{**self.body,'segments':['one','two']},content_type='application/json')
        self.assertEqual(result.status_code,200)
        self.assertIn('A forest walk. Friends arrive.',result.json()['prompt'])
        for ids in [['one','unknown'],['one','three'],['one','one']]:
            self.assertEqual(self.client.post('/api/creative/prompt',{**self.body,'segments':ids},content_type='application/json').status_code,400)
