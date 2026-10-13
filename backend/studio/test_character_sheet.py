import json
import struct
import zlib
from tempfile import TemporaryDirectory
from unittest.mock import MagicMock,patch
from django.test import override_settings
from .test_profiles import ProfileTests
from .models import MediaAsset,LocalScript
from .character_sheet import png_size,SHEET_BOXES

def test_png(width=1536,height=1024):
    def chunk(kind,data):return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data)&0xffffffff)
    rows=b''.join(b'\0'+bytes([y%256,100,180])*width for y in range(height))
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',width,height,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(rows))+chunk(b'IEND',b'')

class CharacterSheetTests(ProfileTests):
    @override_settings(OPENAI_API_KEY='test-only')
    def test_one_generation_five_local_crops_and_reusable_original(self):
        with TemporaryDirectory() as directory,override_settings(MEDIA_ROOT=directory),patch('studio.creative.request_image',return_value=(test_png(),MagicMock(estimated_usd=None))) as provider:
            result=self.client.post('/api/creative/character',{**self.body,'view':'sheet'},content_type='application/json')
            self.assertEqual(result.status_code,201,result.content)
            data=result.json();self.assertEqual(len(data['assets']),5)
            provider.assert_called_once()
            self.assertEqual(provider.call_args.args[0]['size'],'1536x1024')
            self.assertIn('exactly five',provider.call_args.args[2])
            self.assertNotIn('ONE view:',provider.call_args.args[2])
            self.assertEqual(MediaAsset.objects.filter(project=self.project).count(),6)
            for item in data['assets']:
                asset=MediaAsset.objects.get(pk=item['id'])
                with asset.file.open('rb') as image:width,height=png_size(image.read())
                self.assertEqual((width,height),tuple(SHEET_BOXES[item['metadata']['view']][2:]))
                self.assertEqual(item['metadata']['estimatedUsd'],0)
            boxes=data['boxes'];boxes['head-front'][0]+=5
            again=self.client.post('/api/creative/character/crop',{'sheet':data['sheet']['id'],'boxes':boxes},content_type='application/json')
            self.assertEqual(again.status_code,201,again.content);provider.assert_called_once()
            self.assertEqual(MediaAsset.objects.filter(project=self.project).count(),11)
            self.assertEqual(again.json()['sheet']['metadata']['cropBoxes']['head-front'][0],101)
            boxes['head-front'][2]=9000
            self.assertEqual(self.client.post('/api/creative/character/crop',{'sheet':data['sheet']['id'],'boxes':boxes},content_type='application/json').status_code,400)
            self.client.force_login(self.other)
            self.assertEqual(self.client.post('/api/creative/character/crop',{'sheet':data['sheet']['id'],'boxes':data['boxes']},content_type='application/json').status_code,404)

    @override_settings(OPENAI_API_KEY='test-only')
    def test_crop_failure_preserves_paid_sheet_for_recovery(self):
        with TemporaryDirectory() as directory,override_settings(MEDIA_ROOT=directory),patch('studio.creative.request_image',return_value=(test_png(),MagicMock(estimated_usd=None))) as provider,patch('studio.character_sheet.crop_sheet',side_effect=OSError('test')):
            response=self.client.post('/api/creative/character',{**self.body,'view':'sheet'},content_type='application/json')
            self.assertEqual(response.status_code,201)
            self.assertTrue(response.json()['cropError']);self.assertEqual(response.json()['assets'],[])
            self.assertEqual(MediaAsset.objects.count(),1);provider.assert_called_once()

    @override_settings(OPENAI_API_KEY='test-only',OPENAI_MODEL='test-text')
    def test_frame_prompt_uses_story_and_selected_group_without_image_generation(self):
        script=LocalScript.objects.create(project=self.project,owner=self.user,title='Episode',content='Mila finds a rabbit. They go home.',segments=[{'id':'a','start':0,'end':3,'text':'Mila finds a rabbit.'},{'id':'b','start':3,'end':5,'text':'They smile.'},{'id':'c','start':5,'end':8,'text':'They go home.'}])
        payload={'script':str(script.pk),'segments':['a','b'],'current':'Keep the blue coat','aspect':'9:16'}
        with patch('studio.creative.httpx.Client') as provider,patch('studio.creative.request_image') as image:
            response=provider.return_value.__enter__.return_value.post.return_value
            response.is_success=True;response.json.return_value={'output':[{'content':[{'type':'output_text','text':'Mila and rabbit in the forest.'}]}]}
            result=self.client.post('/api/creative/frame-prompt',payload,content_type='application/json')
            self.assertEqual(result.status_code,200,result.content)
            request=provider.return_value.__enter__.return_value.post.call_args.kwargs['json']
            context=json.loads(request['input'])
            self.assertEqual([s['id'] for s in context['requestedFrames']],['a','b'])
            self.assertIn('They go home',context['story']);self.assertEqual(context['rules']['characters'][0]['name'],'Mila')
            self.assertIn('ONE coherent scene',request['instructions']);image.assert_not_called()
            for ids in [['a','c'],['foreign'],['a','a']]:
                self.assertEqual(self.client.post('/api/creative/frame-prompt',{**payload,'segments':ids},content_type='application/json').status_code,400)
            self.client.force_login(self.other)
            self.assertEqual(self.client.post('/api/creative/frame-prompt',payload,content_type='application/json').status_code,404)
