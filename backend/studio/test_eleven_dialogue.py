import base64
import io
import json
import wave
from unittest.mock import MagicMock, patch
from django.test import SimpleTestCase
from .eleven_dialogue import collect_audio, synthesize, DialogueError, RATE


def frame(text='A', size=RATE * 2):
    return json.dumps({'audio': base64.b64encode(b'\x01\x00' * (size // 2)).decode(), 'alignment': {'chars': [text], 'char_start_times_ms': [100], 'char_durations_ms': [200]}})

class DialogueTests(SimpleTestCase):
    def test_chunk_offsets_and_final_audio(self):
        socket = MagicMock()
        socket.recv.side_effect = [frame('A'), frame('B'), json.dumps({'is_final': True})]
        pcm, alignment = collect_audio(socket)
        self.assertEqual(len(pcm), RATE * 4)
        self.assertEqual(alignment['characters'], ['A', 'B'])
        self.assertEqual(alignment['character_start_times_seconds'], [.1, 1.1])
        self.assertEqual(alignment['character_end_times_seconds'], [.3, 1.3])

    def test_incomplete_alignment_does_not_pretend_to_be_complete(self):
        socket = MagicMock()
        socket.recv.side_effect = [frame(), json.dumps({'audio': 'AQA=', 'is_final': True})]
        self.assertIsNone(collect_audio(socket)[1])

    def test_error_and_empty_final_never_return_partial_success(self):
        for frames in [[frame(), json.dumps({'error': 'secret provider details'})], [json.dumps({'is_final': True})]]:
            socket = MagicMock()
            socket.recv.side_effect = frames
            with self.assertRaises((DialogueError, ValueError)):
                collect_audio(socket)

    def test_wav_transport_speed_and_single_voice(self):
        socket = MagicMock()
        socket.recv.side_effect = [frame(), json.dumps({'is_final': True})]
        with patch('studio.eleven_dialogue.connect') as connect:
            connect.return_value.__enter__.return_value = socket
            result = synthesize('test-key', {'voiceId': 'test-voice', 'text': 'A', 'speed': 1.2})
        self.assertIn('model_id=eleven_v4_turbo', connect.call_args.args[0])
        self.assertNotIn('test-key', connect.call_args.args[0])
        self.assertEqual(json.loads(socket.send.call_args_list[0].args[0]), {'voices': ['test-voice']})
        self.assertEqual(json.loads(socket.send.call_args_list[-1].args[0]), {'close_socket': True})
        self.assertAlmostEqual(result['alignment']['character_end_times_seconds'][0], .25)
        with wave.open(io.BytesIO(base64.b64decode(result['audio_base64']))) as wav:
            self.assertEqual(wav.getframerate(), RATE)
            self.assertLess(wav.getnframes(), RATE)
