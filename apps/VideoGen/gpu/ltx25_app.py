"""Isolated LTX-2.5 runtime. Deployment never starts inference or downloads weights.

Deploy with the selected Modal profile; secret videogen-huggingface must
contain HF_TOKEN with access to Lightricks/LTX-2.5. Preparation runs on CPU only.
"""
import json
import time
from pathlib import Path

import modal

SOURCE_REV = '4f521619ae0029e8fbb64d555030c2b121a33b4f'
REV = '49b093a39c19169a8a81721dcc541e07e945232f'
REPO = 'Lightricks/LTX-2.5'
FOLDER = '/cache/videogen-ltx25/' + REV
MODELS = {'ltx25-dev': 'dev', 'ltx25-distilled': 'distilled'}
COMMON = {
    'text-encoder-path': 'text_encoders/gemma4-12b-with-proj-ltx-2.5-bf16.safetensors',
    'video-vae-path': 'vae/ltx-2.5-video-vae-bf16.safetensors',
    'audio-vae-path': 'vae/ltx-2.5-audio-vae-bf16.safetensors',
    'spatial-upsampler-path': 'latent_upscale_models/ltx-2.5-latent-spatial-upscaler-x2-bf16-1.0.safetensors',
}
LORA = 'loras/ltx-2.5-22b-distilled-lora-450-bf16.safetensors'
app = modal.App('videogen-ltx25')
cache = modal.Volume.from_name('videogen-model-cache', create_if_missing=True)
hf_secrets = [modal.Secret.from_name('videogen-huggingface', required_keys=['HF_TOKEN'])]
# Use the upstream workspace resolver: it includes required CUDA/cuDNN overrides.
image = (modal.Image.debian_slim(python_version='3.12')
         .apt_install('git', 'ffmpeg', 'libgomp1')
         .pip_install('uv==0.9.13')
         .run_commands('git clone https://github.com/Lightricks/LTX-2.git /opt/ltx25',
                       f'cd /opt/ltx25 && git checkout {SOURCE_REV}',
                       'cd /opt/ltx25 && uv sync --no-dev --package ltx-pipelines',
                       '/opt/ltx25/.venv/bin/python -c "import ltx_pipelines.distilled; import ltx_pipelines.ti2vid_two_stages; print(\'LTX-2.5 pipeline imports OK; no inference\')"')
         .env({'PATH': '/opt/ltx25/.venv/bin:/usr/local/bin:/usr/bin:/bin',
               'HF_HOME': '/cache/huggingface', 'HF_HUB_DISABLE_TELEMETRY': '1'}))


def component_files(model_id):
    variant = MODELS[model_id]
    files = {**COMMON, 'transformer-path': f'diffusion_models/ltx-2.5-22b-{variant}-transformer-bf16.safetensors'}
    if variant == 'dev':
        files['distilled-lora'] = LORA
    return files


def validate_payload(payload, gpu):
    if payload.get('model_id') not in MODELS or payload.get('gpu') != gpu or gpu != 'RTX-PRO-6000' or payload.get('placement') != 'native':
        raise ValueError('Invalid LTX-2.5 model/GPU/profile.')
    steps = [8] if payload['model_id'] == 'ltx25-distilled' else [20, 30, 40]
    if payload.get('steps') not in steps or payload.get('seconds') not in range(1, 11):
        raise ValueError('Invalid LTX-2.5 steps or duration.')
    if payload.get('aspect') not in ['16:9', '9:16', '1:1'] or payload.get('render_profile', 'standard') != 'standard':
        raise ValueError('LTX-2.5 currently supports the standard profile only.')
    if payload.get('image_role', 'start') not in ['start', 'reference']:
        raise ValueError('Invalid image role.')
    for name in ['reference', 'end_reference']:
        data = payload.get(name)
        if name == 'end_reference' and not data:
            continue
        if not isinstance(data, bytes) or not 0 < len(data) <= 8 * 1024 * 1024:
            raise ValueError('A valid starting image is required; each image must be <=8 MB.')


def cli_arguments(payload, files, folder):
    """Argument list, never shell interpolation of prompts or filenames."""
    width, height = {'16:9': (1024, 576), '9:16': (576, 1024), '1:1': (768, 768)}[payload['aspect']]
    module = 'ltx_pipelines.distilled' if payload['model_id'] == 'ltx25-distilled' else 'ltx_pipelines.ti2vid_two_stages'
    args = ['/opt/ltx25/.venv/bin/python', '-m', module]
    reference_frame = (payload['seconds'] * 24 // 2 // 8) * 8 if payload.get('image_role') == 'reference' else 0
    strength = '0.5' if payload.get('image_role') == 'reference' else '0.8'
    for flag, path in files.items():
        args.extend(['--' + flag, path])
    args.extend(['--prompt', payload['prompt'], '--seed', str(payload['seed']), '--height', str(height),
                 '--width', str(width), '--num-frames', str(payload['seconds'] * 24 + 1), '--frame-rate', '24',
                 '--offload', 'cpu', '--image', str(Path(folder, 'reference.png')), str(reference_frame), strength,
                 '--output-path', str(Path(folder, 'video.mp4'))])
    if payload.get('end_reference'):
        args.extend(['--image', str(Path(folder, 'end.png')), str(payload['seconds'] * 24), '0.8'])
    if payload['model_id'] == 'ltx25-dev':
        args.extend(['--num-inference-steps', str(payload['steps'])])
        if payload.get('negative_prompt'):
            args.extend(['--negative-prompt', payload['negative_prompt']])
    return args


@app.function(image=image, cpu=2, memory=131072, timeout=1200, min_containers=0, max_containers=1,
              scaledown_window=2, retries=0, volumes={'/cache': cache}, secrets=hf_secrets)
def prepare_ltx25(payload: dict):
    import subprocess
    started = time.monotonic()
    try:
        model_id = payload['model_id']
        files = component_files(model_id)
        marker = Path(FOLDER, model_id + '.json')
        cache.reload()
        if marker.exists():
            details = json.loads(marker.read_text())
            if details.get('source_revision') == SOURCE_REV and all(Path(p).is_file() for p in details['files'].values()):
                return {'ok': True, 'cached': True, 'elapsed_seconds': time.monotonic() - started, 'validation': details}
        if payload.get('cached_only'):
            raise ValueError('LTX-2.5 weights have not been prepared.')
        # Run inside the upstream venv; no GPU is attached to this function.
        script = '''import json,sys
from huggingface_hub import hf_hub_download
from safetensors import safe_open
repo,rev,folder,files=json.loads(sys.argv[1])
paths={}
for flag,name in files.items():
 p=hf_hub_download(repo,name,revision=rev,local_dir=folder)
 with safe_open(p,framework='pt',device='cpu') as f:
  if not f.keys(): raise ValueError('Empty model component')
 paths[flag]=p
print(json.dumps(paths))
'''
        result = subprocess.run(['/opt/ltx25/.venv/bin/python', '-c', script,
                                 json.dumps([REPO, REV, FOLDER, files])], capture_output=True, text=True, timeout=1100)
        if result.returncode:
            if any(code in result.stderr for code in ['401', '403', 'GatedRepoError']):
                raise RuntimeError('LTX-2.5 zahtijeva odobren Hugging Face pristup i HF_TOKEN u Modal secretu videogen-huggingface.')
            raise RuntimeError('CPU preparation failed: ' + result.stderr[-1400:])
        paths = json.loads(result.stdout.strip().splitlines()[-1])
        details = {'repo': REPO, 'revision': REV, 'source_revision': SOURCE_REV, 'files': paths}
        marker.write_text(json.dumps(details)); cache.commit()
        return {'ok': True, 'elapsed_seconds': time.monotonic() - started, 'validation': details}
    except Exception as exc:
        cache.commit()
        return {'ok': False, 'elapsed_seconds': time.monotonic() - started, 'error': str(exc)[:1800]}


def run_ltx25(payload, gpu):
    import os
    import socket
    import resource
    import subprocess
    import tempfile
    started = time.monotonic()
    metrics = {'gpu': gpu, 'engine': 'ltx25-native', 'placement': 'native', 'offload': 'cpu',
               'source_revision': SOURCE_REV, 'revision': REV, 'repo': REPO, 'requested_ram_gib': 128,
               'preparation_ram_gib': 128, 'native_audio': True, 'weight_dtype': 'bfloat16',
               'negative_prompt_applied': payload.get('model_id') == 'ltx25-dev',
               'container_hostname': socket.gethostname(), 'worker_pid': os.getpid()}
    try:
        validate_payload(payload, gpu)
        cache.reload()
        details = json.loads(Path(FOLDER, payload['model_id'] + '.json').read_text())
        if details['source_revision'] != SOURCE_REV:
            raise ValueError('Repeat CPU preparation for the current runtime.')
        with tempfile.TemporaryDirectory() as folder:
            Path(folder, 'reference.png').write_bytes(payload['reference'])
            if payload.get('end_reference'):
                Path(folder, 'end.png').write_bytes(payload['end_reference'])
            with open(Path(folder, 'runtime.log'), 'w+') as log:
                result = subprocess.run(cli_arguments(payload, details['files'], folder), stdout=log, stderr=log,
                                        timeout=min(850, max(1, int(payload.get('_timeout_seconds', 850)))))
                if result.returncode:
                    log.seek(0, 2); size = log.tell(); log.seek(max(0, size - 1800))
                    raise RuntimeError('LTX-2.5 runtime failed: ' + log.read())
            video = Path(folder, 'video.mp4').read_bytes()
        metrics.update(output_fps=24, endpoint_conditioning=bool(payload.get('end_reference')),
                       peak_cpu_ram_gib=round(resource.getrusage(resource.RUSAGE_CHILDREN).ru_maxrss / 1024**2, 3),
                       timing_note='Includes component loading, sampling, decoding and export; not benchmarked yet.')
        return {'ok': True, 'video': video, 'elapsed_seconds': time.monotonic() - started, 'metrics': metrics}
    except Exception as exc:
        return {'ok': False, 'elapsed_seconds': time.monotonic() - started, 'metrics': metrics, 'error': str(exc)[:1800]}


@app.function(image=image, gpu='RTX-PRO-6000', cpu=2, memory=131072, timeout=900,
              min_containers=0, max_containers=1, scaledown_window=2, retries=0, volumes={'/cache': cache})
def generate_ltx25_rtx(payload: dict):
    return run_ltx25(payload, 'RTX-PRO-6000')






def run_comparison_pair(payload, gpu):
    """Two sequential clips inside ONE invocation: no container scheduling gap.

    This measures warm container/storage, not resident model weights: the exact
    same CLI pipeline as the RTX comparison still loads components per clip.
    """
    scenes = payload.get('scenes', [])
    if len(scenes) != 2 or scenes[0].get('model_id') != scenes[1].get('model_id'):
        raise ValueError('A comparison requires two scenes of the same model.')
    for scene in scenes:
        validate_payload(scene, gpu)
    allowance = min(850, max(1, int(payload['budget_seconds'])))
    started = time.monotonic()
    results = []
    for index, scene in enumerate(scenes):
        remaining = allowance - (time.monotonic() - started)
        if remaining < 2:
            break
        result = run_ltx25({**scene, '_timeout_seconds': int(remaining)}, gpu)
        result['metrics']['pair_order'] = index + 1
        result['metrics']['warm_container'] = index == 1
        results.append(result)
        if not result.get('ok'):
            break
    return {'results': results, 'elapsed_seconds': time.monotonic() - started,
            'ok': len(results) == 2 and all(r.get('ok') for r in results)}
