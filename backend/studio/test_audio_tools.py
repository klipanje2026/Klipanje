import io
import math
import struct
import wave
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient

class AudioToolsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = get_user_model().objects.create_user(username='audio-tool-test', password='test-only-password')
        self.client.force_authenticate(self.user)

    def audio(self):
        data=io.BytesIO()
        with wave.open(data,'wb') as f:
            f.setnchannels(1);f.setsampwidth(2);f.setframerate(44100)
            f.writeframes(b''.join(struct.pack('<h',int(8000*math.sin(i*440*2*math.pi/44100))) for i in range(44100*4)))
        return SimpleUploadedFile('waves.wav',data.getvalue(),content_type='audio/wav')

    def test_real_trim_and_compression(self):
        response=self.client.post('/api/audio/trim',{'file':self.audio(),'start':'1','end':'2','bitrate':'128'},format='multipart')
        self.assertEqual(response.status_code,200)
        output=b''.join(response.streaming_content)
        response.close()
        self.assertEqual(response['Content-Type'],'audio/mpeg')
        # One second at128kbps plus MP3 headers, not the entire four-second source.
        self.assertGreater(len(output),15000)
        self.assertLess(len(output),20000)

    def test_invalid_ranges(self):
        for start,end in [('nan','2'),('0','inf'),('2','1'),('-1','2'),('0','4000')]:
            response=self.client.post('/api/audio/trim',{'file':self.audio(),'start':start,'end':end},format='multipart')
            self.assertEqual(response.status_code,400)

    def test_invalid_content_and_format(self):
        response=self.client.post('/api/audio/trim',{'file':SimpleUploadedFile('bad.wav',b'not audio'),'start':0,'end':1},format='multipart')
        self.assertEqual(response.status_code,400)
        response=self.client.post('/api/audio/trim',{'file':SimpleUploadedFile('list.m3u',b'http://localhost/'),'start':0,'end':1},format='multipart')
        self.assertEqual(response.status_code,400)

    def test_authentication_required(self):
        self.client.force_authenticate(None)
        response=self.client.post('/api/audio/trim',{})
        self.assertIn(response.status_code,(401,403))
