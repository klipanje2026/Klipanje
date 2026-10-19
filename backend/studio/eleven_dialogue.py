"""Local narration via ElevenLabs Text to Dialogue; credentials stay server-side."""
import base64
import io
import json
import math
import subprocess
import time
import wave
from websockets.sync.client import connect
from websockets.exceptions import WebSocketException
from imageio_ffmpeg import get_ffmpeg_exe

RATE = 24000
URL = ('wss://api.elevenlabs.io/v1/text-to-dialogue/stream-input'
       '?model_id=eleven_v4_turbo&output_format=pcm_24000&sync_alignment=true&language_code=bs')

class DialogueError(Exception):
    pass


def collect_audio(socket):
    pcm = bytearray()
    alignment = {'characters': [], 'character_start_times_seconds': [], 'character_end_times_seconds': []}
    complete_alignment = True
    deadline = time.monotonic() + 180
    while True:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise TimeoutError('Dialogue timed out')
        msg = json.loads(socket.recv(timeout=min(60, remaining)))
        if msg.get('error'):
            # Never expose provider payloads, which can contain the submitted text.
            raise DialogueError('ElevenLabs nije prihvatio V4 Turbo zahtjev. Provjeri glas, pristup modelu i kredite.')
        audio = base64.b64decode(msg.get('audio') or '', validate=True)
        offset = len(pcm) / (RATE * 2)
        if audio:
            chunk = msg.get('alignment') or {}
            chars, starts, lengths = (chunk.get('chars', []), chunk.get('char_start_times_ms', []), chunk.get('char_durations_ms', []))
            if chars and len(chars) == len(starts) == len(lengths):
                for char, start, length in zip(chars, starts, lengths):
                    if not isinstance(char, str) or not all(isinstance(v, (float, int)) and math.isfinite(v) and v >= 0 for v in (start, length)):
                        raise ValueError('Invalid alignment')
                    alignment['characters'].append(char)
                    alignment['character_start_times_seconds'].append(offset + start / 1000)
                    alignment['character_end_times_seconds'].append(offset + (start + length) / 1000)
            elif chars or any(audio):
                complete_alignment = False
            pcm.extend(audio)
            if len(pcm) > RATE * 2 * 1800:
                raise ValueError('Audio exceeds limit')
        if msg.get('is_final'):
            if not pcm or len(pcm) % 2:
                raise ValueError('Missing or incomplete audio')
            return bytes(pcm), alignment if complete_alignment and alignment['characters'] else None


def synthesize(key, data):
    try:
        with connect(URL, additional_headers={'xi-api-key': key}, open_timeout=15, close_timeout=5, max_size=16 * 1024 * 1024, proxy=None) as socket:
            socket.send(json.dumps({'voices': [data['voiceId']]}))
            socket.send(json.dumps({'inputs': [{'text': data['text'], 'voice_id': data['voiceId'], 'new_turn': False}]}))
            socket.send(json.dumps({'close_socket': True}))
            pcm, alignment = collect_audio(socket)
        speed = data['speed']
        if speed != 1:
            converted = subprocess.run([get_ffmpeg_exe(), '-nostdin', '-v', 'error', '-f', 's16le', '-ar', str(RATE), '-ac', '1', '-i', 'pipe:0', '-af', f'atempo={speed}', '-f', 's16le', '-ar', str(RATE), '-ac', '1', 'pipe:1'], input=pcm, capture_output=True, timeout=60, check=True)
            pcm = converted.stdout
            if alignment:
                for field in ['character_start_times_seconds', 'character_end_times_seconds']:
                    alignment[field] = [t / speed for t in alignment[field]]
        output = io.BytesIO()
        with wave.open(output, 'wb') as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(RATE)
            wav.writeframes(pcm)
        return {'audio_base64': base64.b64encode(output.getvalue()).decode('ascii'), 'content_type': 'audio/wav', 'alignment': alignment}
    except DialogueError:
        raise
    except (WebSocketException, OSError, TimeoutError, ValueError, TypeError, subprocess.SubprocessError) as exc:
        raise DialogueError('V4 Turbo naracija nije završena. Provjeri vezu i pristup modelu prije ponovnog generisanja.') from exc
