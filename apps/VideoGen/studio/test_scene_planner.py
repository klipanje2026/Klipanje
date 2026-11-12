import io
import json
import urllib.error
from types import SimpleNamespace
from unittest.mock import patch
from django.test import SimpleTestCase
from .scene_planner import plan_scene, provider


class ScenePlannerTests(SimpleTestCase):
    @patch('studio.scene_planner.urllib.request.urlopen')
    @patch('studio.scene_planner.ROOT_ENV', {'OPENAI_API_KEY': 'test-secret'})
    def test_scene_request_satisfies_json_mode_in_actual_input(self, open_url):
        expected={'title':'Scena','description':'Junak ulazi u sobu.','prompt':'The hero enters the room.'}
        response={'output':[{'content':[{'type':'output_text','text':json.dumps(expected)}]}]}
        open_url.return_value.__enter__.return_value=io.StringIO(json.dumps(response))
        result=plan_scene('Junak ulazi u sobu',SimpleNamespace(name='Film',context={}),[], 'cinematic','16:9',5)
        self.assertEqual(result,expected)
        request=json.loads(open_url.call_args.args[0].data)
        self.assertIn('json',request['input'][0]['content'][0]['text'].lower())
        self.assertIn('Junak ulazi u sobu',request['input'][0]['content'][0]['text'])
        self.assertFalse(request['store'])

    @patch('studio.scene_planner.ROOT_ENV', {'OPENAI_API_KEY': 'test-secret'})
    def test_provider_errors_distinguish_format_auth_credit_and_connection(self):
        cases=[(400,None,'format'),(401,None,'ključ'),(403,None,'pristup'),
               (429,'insufficient_quota','Modal sredstva su odvojena'),
               (429,'project_spend_limit_exceeded','limit'),(429,None,'broj zahtjeva'),(503,None,'smetnje')]
        for status,code,expected in cases:
            with self.subTest(status=status,code=code):
                error=urllib.error.HTTPError('https://api.openai.com',status,'error',{},io.BytesIO(json.dumps({'error':{'code':code,'message':'test-secret private input'}}).encode()))
                with patch('studio.scene_planner.urllib.request.urlopen',side_effect=error):
                    with self.assertRaises(ValueError) as caught:provider('responses',{})
                self.assertIn(expected,str(caught.exception))
                self.assertNotIn('test-secret',str(caught.exception))
                self.assertNotIn('private input',str(caught.exception))
        with patch('studio.scene_planner.urllib.request.urlopen',side_effect=urllib.error.URLError('private details')):
            with self.assertRaisesMessage(ValueError,'Veza s OpenAI'):provider('responses',{})
