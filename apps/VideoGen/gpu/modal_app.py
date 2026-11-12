"""VideoGen GPU workers. Import/deploy does not execute inference.

Deploy: .venv/Scripts/python -m modal deploy gpu/modal_app.py
One GPU per function, no retries, no warm pool, 15-minute per-job timeout.
"""
import time
import modal


# One pipeline per single-input container. No warm pool or idle extension.
_PIPELINE_CACHE = {}
def cached_pipeline(key, build):
    if key in _PIPELINE_CACHE:
        return _PIPELINE_CACHE[key], True
    _PIPELINE_CACHE.clear()
    import gc
    gc.collect()
    pipeline = build()
    _PIPELINE_CACHE[key] = pipeline
    return pipeline, False


def reload_models(key):
    if key not in _PIPELINE_CACHE:
        _PIPELINE_CACHE.clear()
        import gc
        gc.collect()
        cache.reload()


app = modal.App('videogen-gpu')
cache = modal.Volume.from_name('videogen-model-cache', create_if_missing=True)
image = (modal.Image.debian_slim(python_version='3.12')
         .apt_install('ffmpeg')
         .pip_install('torch==2.8.0', 'transformers==4.57.1', 'accelerate==1.10.1', 'safetensors==0.6.2', 'sentencepiece==0.2.1', 'ftfy==6.3.1', 'imageio[ffmpeg]==2.37.0', 'Pillow==11.3.0')
         # 0.36 fixes Wan2.2's patchify-before-tiled-encode path.
         .pip_install('diffusers==0.36.0')
         .env({'HF_HOME': '/cache/huggingface', 'HF_HUB_DISABLE_TELEMETRY': '1'}))

LTX_REPO = 'Lightricks/LTX-Video'
LTX_REVISION = '8984fa25007f376c1a299016d0957a37a2f797bb'
LTX_FILE = 'ltxv-2b-0.9.6-distilled-04-25.safetensors'
LTX_FOLDER = '/cache/videogen-ltx-2b-096-distilled-v1'
# Read from the official checkpoint's allowed_inference_steps metadata.
LTX_TIMESTEPS = [1000.0, 993.7, 987.5, 981.2, 975.0, 909.4, 725.0, 421.9]

def configure_ltx_i2v_schedule(pipe):
    """Use the checkpoint's SDE recipe with the legacy 2B I2V velocity convention."""
    from diffusers import FlowMatchEulerDiscreteScheduler
    pipe.scheduler = FlowMatchEulerDiscreteScheduler.from_config(
        pipe.scheduler.config, stochastic_sampling=True, use_dynamic_shifting=False,
        shift=1.0, shift_terminal=None)
    original = pipe.scheduler.set_timesteps
    def distilled_set_timesteps(num_inference_steps=None, device=None, sigmas=None, mu=None, timesteps=None, **kwargs):
        # Diffusers 0.36 I2V supplies a generic sigma array internally. Replace it
        # with the official distilled grid without passing both sigma/time grids.
        if num_inference_steps is not None and num_inference_steps != 8:
            raise ValueError('LTX distilled raspored koristi 8 koraka.')
        return original(device=device, timesteps=LTX_TIMESTEPS)
    pipe.scheduler.set_timesteps = distilled_set_timesteps

def configure_ltx_endpoint_schedule(pipe):
    """ConditionPipeline passes negative velocity; SDE expects positive velocity."""
    configure_ltx_i2v_schedule(pipe)
    original_step = pipe.scheduler.step
    def conditioned_step(model_output, timestep, sample, **kwargs):
        if kwargs.get('per_token_timesteps') is not None:
            model_output = -model_output
        return original_step(model_output, timestep, sample, **kwargs)
    pipe.scheduler.step = conditioned_step

@app.function(image=image, cpu=2, memory=49152, timeout=900,
              min_containers=0, max_containers=1, scaledown_window=2,
              retries=0, volumes={'/cache': cache})
def prepare_ltx(payload: dict):
    """Convert official 2B weights and exercise the complete tiny pipeline on CPU."""
    started = time.monotonic()
    try:
        import json
        from pathlib import Path
        import torch
        from PIL import Image
        from diffusers import LTXImageToVideoPipeline
        from transformers import T5EncoderModel
        from huggingface_hub import hf_hub_download
        cache.reload()
        if payload.get('model_id') != 'ltx-2b':
            raise ValueError('Pogrešan model za LTX pripremu.')
        marker = Path(LTX_FOLDER) / 'videogen-validation-i2v-v3.json'
        if not marker.exists():
            torch.set_num_threads(2)
            converted_exists = Path(LTX_FOLDER, 'model_index.json').exists()
            if converted_exists:
                pipe = LTXImageToVideoPipeline.from_pretrained(LTX_FOLDER,torch_dtype=torch.bfloat16,local_files_only=True)
            else:
                checkpoint = hf_hub_download(LTX_REPO, LTX_FILE, revision=LTX_REVISION)
                cache.commit()
                text_encoder = T5EncoderModel.from_pretrained('PixArt-alpha/PixArt-XL-2-1024-MS',
                                                             subfolder='text_encoder',torch_dtype=torch.bfloat16)
                pipe = LTXImageToVideoPipeline.from_single_file(checkpoint,
                           config='Lightricks/LTX-Video-0.9.5', text_encoder=text_encoder,torch_dtype=torch.bfloat16)
            if pipe.transformer.config.num_layers != 28:
                raise RuntimeError('Checkpoint nije očekivani LTX 2B transformer.')
            configure_ltx_i2v_schedule(pipe)
            # Save before inference so the GPU path only reads converted local weights.
            if not converted_exists:
                pipe.save_pretrained(LTX_FOLDER, safe_serialization=True)
            torch.manual_seed(42)
            result = pipe(image=Image.new('RGB', (64,64), '#807050'), prompt='A small cube moves gently.',
                          width=64, height=64, num_frames=9, frame_rate=24,
                          num_inference_steps=8, guidance_scale=1.0,
                          decode_timestep=.05, decode_noise_scale=.025,
                          max_sequence_length=32, generator=torch.Generator('cpu').manual_seed(42)).frames[0]
            if len(result) != 9 or result[0].size != (64,64):
                raise RuntimeError('LTX CPU provjera nije vratila očekivani video.')
            actual_grid = pipe.scheduler.timesteps.detach().cpu().float()
            if len(actual_grid) != 8 or not torch.allclose(actual_grid, torch.tensor(LTX_TIMESTEPS)):
                raise RuntimeError('LTX CPU provjera nije koristila propisani distilled raspored.')
            sheet=Image.new('RGB',(192,64))
            for i,frame in enumerate([result[0],result[4],result[-1]]):
                sheet.paste(frame,(64*i,0))
            sheet.save('/cache/ltx-cpu-i2v-v3-check.png')
            marker.write_text(json.dumps({'checkpoint': LTX_FILE, 'revision': LTX_REVISION,
                              'layers':28, 'cpu_frames':9, 'size':[64,64], 'timesteps':actual_grid.tolist(),
                              'stochastic_sampling':True, 'engine':'i2v-sde-v3', 'probe_device':'cpu'}))
            cache.commit()
        if payload.get('endpoints'):
            from diffusers.pipelines.ltx.pipeline_ltx_condition import LTXConditionPipeline, LTXVideoCondition
            endpoint_marker=Path(LTX_FOLDER)/'videogen-validation-endpoints-v1.json'
            if not endpoint_marker.exists():
                torch.set_num_threads(2)
                if 'pipe' in locals():
                    del pipe
                    import gc
                    gc.collect()
                pipe=LTXConditionPipeline.from_pretrained(LTX_FOLDER,torch_dtype=torch.bfloat16,local_files_only=True)
                configure_ltx_endpoint_schedule(pipe)
                result=pipe(conditions=[LTXVideoCondition(image=Image.new('RGB',(64,64),'#807050'),frame_index=0),
                                        LTXVideoCondition(image=Image.new('RGB',(64,64),'#506080'),frame_index=8)],
                            prompt='A small cube moves gently.',width=64,height=64,num_frames=9,frame_rate=24,
                            num_inference_steps=8,timesteps=LTX_TIMESTEPS,guidance_scale=1.0,
                            decode_timestep=.05,decode_noise_scale=.025,image_cond_noise_scale=.025,
                            max_sequence_length=32,generator=torch.Generator('cpu').manual_seed(42)).frames[0]
                if len(result)!=9 or result[0].size!=(64,64):
                    raise RuntimeError('LTX endpoint CPU probe returned unexpected frames.')
                endpoint_marker.write_text(json.dumps({'engine':'condition-sde-endpoints-v1','frames':9,
                                            'conditioning_frames':[0,8],'steps':8,'probe_device':'cpu'}))
                cache.commit()
        return {'ok':True, 'elapsed_seconds':time.monotonic()-started}
    except Exception as exc:
        _PIPELINE_CACHE.clear()
        cache.commit()
        return {'ok':False, 'error':f'LTX CPU priprema: {type(exc).__name__}: {str(exc)[:1500]}',
                'elapsed_seconds':time.monotonic()-started}

def run_ltx_generation(payload, expected_gpu):
    started = time.monotonic()
    metrics = {'gpu':expected_gpu, 'placement':payload.get('placement','offload'),
               'checkpoint':LTX_FILE, 'guidance_scale':1.0, 'negative_prompt_applied':0,
               'preparation_ram_gib':48, 'sampling_steps':8, 'stochastic_sampling':1,
               'engine':'i2v-sde-v3', 'generator_device':'cuda'}
    try:
        import io
        import tempfile
        from pathlib import Path
        import torch
        from PIL import Image
        from diffusers import LTXImageToVideoPipeline
        from diffusers.pipelines.ltx.pipeline_ltx_condition import LTXConditionPipeline, LTXVideoCondition
        from diffusers.utils import export_to_video
        reload_models(('ltx',payload.get('placement','offload'),bool(payload.get('end_reference'))))
        if payload.get('model_id') != 'ltx-2b' or payload.get('gpu') != expected_gpu:
            raise ValueError('Pogrešan LTX worker.')
        if int(payload['steps']) != 8 or int(payload['seconds']) not in [2,3,4,5,7,10]:
            raise ValueError('LTX distilled profil koristi 8 koraka i 2–5 sekundi.')
        placement = payload.get('placement', 'offload')
        if placement not in ['offload','resident'] or (placement == 'resident' and expected_gpu != 'L40S'):
            raise ValueError('LTX resident profil je dozvoljen na L40S.')
        if not Path(LTX_FOLDER, 'videogen-validation-i2v-v3.json').exists():
            raise RuntimeError('Prvo završi LTX CPU provjeru.')
        reference = payload.get('reference')
        if not isinstance(reference, bytes) or not 0 < len(reference) <= 8*1024*1024:
            raise ValueError('LTX test traži početnu sliku do 8 MB.')
        end_reference=payload.get('end_reference')
        if end_reference and (not isinstance(end_reference,bytes) or len(end_reference)>8*1024*1024):
            raise ValueError('Neispravna završna slika.')
        if end_reference and not Path(LTX_FOLDER,'videogen-validation-endpoints-v1.json').exists():
            raise RuntimeError('Prvo završi endpoint CPU provjeru.')
        sizes={'16:9':(1280,704),'9:16':(704,1280),'1:1':(704,704)}
        width,height=sizes[payload['aspect']]
        frames=int(payload['seconds'])*24+1
        if (frames-1)%8:
            frames=((frames-1+7)//8)*8+1
        seed=int(payload['seed'])
        torch.manual_seed(seed)
        metrics['gpu_name']=torch.cuda.get_device_name(0)
        torch.cuda.reset_peak_memory_stats()
        pipeline_class=LTXConditionPipeline if end_reference else LTXImageToVideoPipeline
        def build_pipeline():
            pipe=pipeline_class.from_pretrained(LTX_FOLDER,torch_dtype=torch.bfloat16,local_files_only=True)
            if end_reference:
                configure_ltx_endpoint_schedule(pipe)
                metrics.update(engine='condition-sde-endpoints-v1',conditioning_frames=[0,frames-1])
            else:
                configure_ltx_i2v_schedule(pipe)
            if placement=='resident':
                pipe.to('cuda')
            else:
                pipe.enable_model_cpu_offload()
            pipe.vae.enable_tiling()
            return pipe
        pipe,reused=cached_pipeline(('ltx',placement,bool(end_reference)),build_pipeline)
        metrics['pipeline_reused']=reused
        token_count=len(pipe.tokenizer(payload['prompt'],add_special_tokens=True).input_ids)
        metrics['prompt_tokens']=token_count
        if token_count>512:
            raise ValueError('LTX prompt ima više od 512 tokena.')
        torch.cuda.synchronize()
        metrics['load_seconds']=round(time.monotonic()-started,3)
        original_decode=getattr(pipe.vae.decode, '_vg_original', pipe.vae.decode)
        def measured_decode(*args,**kwargs):
            torch.cuda.synchronize()
            t=time.monotonic()
            result=original_decode(*args,**kwargs)
            torch.cuda.synchronize()
            metrics['decode_seconds']=round(time.monotonic()-t,3)
            return result
        measured_decode._vg_original = original_decode
        pipe.vae.decode=measured_decode
        t=time.monotonic()
        condition_args={'image':Image.open(io.BytesIO(reference)).convert('RGB')}
        if end_reference:
            condition_args={'conditions':[LTXVideoCondition(image=Image.open(io.BytesIO(reference)).convert('RGB'),frame_index=0),
                                          LTXVideoCondition(image=Image.open(io.BytesIO(end_reference)).convert('RGB'),frame_index=frames-1)],
                            'timesteps':LTX_TIMESTEPS,'image_cond_noise_scale':.025}
        output=pipe(**condition_args, prompt=payload['prompt'],
                    negative_prompt=payload.get('negative_prompt',''), width=width,height=height,
                    num_frames=frames,frame_rate=24,num_inference_steps=8,
                    guidance_scale=1.0,decode_timestep=.05,decode_noise_scale=.025,
                    max_sequence_length=512,generator=torch.Generator('cuda').manual_seed(seed)).frames[0]
        torch.cuda.synchronize()
        metrics['pipeline_seconds']=round(time.monotonic()-t,3)
        metrics['sampling_and_conditioning_seconds']=round(metrics['pipeline_seconds']-metrics.get('decode_seconds',0),3)
        metrics['peak_allocated_vram_gib']=round(torch.cuda.max_memory_allocated()/1024**3,3)
        metrics['peak_reserved_vram_gib']=round(torch.cuda.max_memory_reserved()/1024**3,3)
        import resource
        metrics['peak_cpu_ram_gib']=round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss/1024**2,3)
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/'video.mp4'
            export_to_video(output,str(path),fps=24)
            video=path.read_bytes()
        return {'ok':True,'video':video,'elapsed_seconds':time.monotonic()-started,'metrics':metrics}
    except Exception as exc:
        _PIPELINE_CACHE.clear()
        return {'ok':False,'error':f'{type(exc).__name__}: {str(exc)[:1500]}',
                'elapsed_seconds':time.monotonic()-started,'metrics':metrics}

@app.function(image=image, gpu='L40S', cpu=2, memory=32768, timeout=900,
              min_containers=0, max_containers=1, scaledown_window=2,
              retries=0, volumes={'/cache':cache})
def generate_ltx_l40s(payload:dict):
    return run_ltx_generation(payload,'L40S')

@app.function(image=image, gpu='L4', cpu=2, memory=32768, timeout=900,
              min_containers=0, max_containers=1, scaledown_window=2,
              retries=0, volumes={'/cache':cache})
def generate_ltx_l4(payload:dict):
    return run_ltx_generation(payload,'L4')

@app.function(image=image, gpu='A10', cpu=2, memory=32768, timeout=900,
              min_containers=0, max_containers=1, scaledown_window=2,
              retries=0, volumes={'/cache':cache})
def generate_ltx_a10(payload:dict):
    return run_ltx_generation(payload,'A10')

@app.function(image=image, cpu=2, memory=8192, timeout=900,
              min_containers=0, max_containers=1, scaledown_window=2,
              retries=0, volumes={'/cache': cache})
def prepare_model(payload: dict):
    """Import-check and fetch weights on a small CPU container BEFORE paying for a GPU."""
    started = time.monotonic()
    try:
        import gc
        from pathlib import Path
        import torch
        import diffusers
        from diffusers import AutoencoderKLWan, WanPipeline, WanImageToVideoPipeline
        from huggingface_hub import snapshot_download
        cache.reload()
        repos = {'wan21-1.3b': 'Wan-AI/Wan2.1-T2V-1.3B-Diffusers',
                 'wan22-5b': 'Wan-AI/Wan2.2-TI2V-5B-Diffusers'}
        if payload.get('model_id') not in repos:
            raise ValueError('Model nije dozvoljen.')
        snapshot_download(repos[payload['model_id']], max_workers=4,
                          allow_patterns=['model_index.json', 'scheduler/*', 'tokenizer/*', 'text_encoder/*', 'transformer/*', 'vae/*'],
                          ignore_patterns=['*.bin', '*.onnx', '*.h5', '*.msgpack'])
        # Exercise image encoding and decoding on CPU before allowing a paid GPU call.
        # A marker avoids reloading the VAE on every generation.
        marker = Path('/cache') / f"validated-{payload['model_id']}-{diffusers.__version__}"
        if not marker.exists():
            torch.set_num_threads(2)
            vae = AutoencoderKLWan.from_pretrained(repos[payload['model_id']], subfolder='vae', torch_dtype=torch.float32)
            vae.enable_tiling(tile_sample_min_height=32, tile_sample_min_width=32,
                              tile_sample_stride_height=16, tile_sample_stride_width=16)
            with torch.no_grad():
                latents = vae.encode(torch.zeros(1, 3, 1, 64, 64)).latent_dist.mode()
                decoded = vae.decode(latents).sample
                if tuple(decoded.shape) != (1, 3, 1, 64, 64):
                    raise RuntimeError(f'VAE CPU provjera vratila je pogrešan oblik: {tuple(decoded.shape)}')
            del vae, latents, decoded
            gc.collect()
            marker.write_text('encode/decode passed on CPU')
        cache.commit()
        return {'ok': True, 'elapsed_seconds': time.monotonic()-started}
    except Exception as exc:
        _PIPELINE_CACHE.clear()
        return {'ok': False, 'error': f'Priprema modela: {type(exc).__name__}: {str(exc)[:1500]}', 'elapsed_seconds': time.monotonic()-started}

def run_generation(payload, expected_model, expected_gpu):
    started = time.monotonic()
    metrics = {'gpu': expected_gpu, 'placement': payload.get('placement', 'offload')}
    try:
        reload_models(('wan',expected_model,payload.get('placement','offload'),bool(payload.get('reference'))))
        import io
        import tempfile
        from pathlib import Path
        import torch
        from PIL import Image
        from diffusers import AutoencoderKLWan, WanPipeline, WanImageToVideoPipeline
        from diffusers.utils import export_to_video
        if payload.get('model_id') != expected_model:
            raise ValueError('Pogrešan worker za model.')
        if payload.get('gpu', expected_gpu) != expected_gpu:
            raise ValueError('Pogrešan GPU worker.')
        placement = payload.get('placement', 'offload')
        if placement not in ['offload', 'resident'] or (placement == 'resident' and expected_gpu not in ['L40S', 'A100-80GB', 'RTX-PRO-6000', 'B200']):
            raise ValueError('Neispravan profil memorije.')
        metrics['gpu_name'] = torch.cuda.get_device_name(0)
        metrics.update(gpu_total_memory_gib=round(torch.cuda.get_device_properties(0).total_memory/1024**3,2),torch_version=str(torch.__version__),cuda_version=torch.version.cuda)
        torch.cuda.reset_peak_memory_stats()
        duration = int(payload['seconds'])
        steps = int(payload['steps'])
        if duration not in [2,3,4,5,7,10] or not 10 <= steps <= 50 or payload['aspect'] not in ['16:9', '9:16', '1:1']:
            raise ValueError('Postavke su izvan štedljivog profila.')
        if not 10 <= len(payload['prompt']) <= 4500:
            raise ValueError('Neispravan prompt.')
        economy = expected_model == 'wan21-1.3b'
        repo = 'Wan-AI/Wan2.1-T2V-1.3B-Diffusers' if economy else 'Wan-AI/Wan2.2-TI2V-5B-Diffusers'
        fps = 16 if economy else 24
        frames = duration * fps + 1
        width, height = (832, 480) if economy else (1280, 704)
        if payload['aspect'] == '9:16':
            width, height = height, width
        elif payload['aspect'] == '1:1':
            width = height = 480 if economy else 704
        reference = payload.get('reference')
        if economy and reference:
            raise ValueError('Economy podržava tekst; za sliku koristi Balanced.')
        def build_pipeline():
            vae = AutoencoderKLWan.from_pretrained(repo, subfolder='vae', torch_dtype=torch.float32)
            pipeline_type = WanImageToVideoPipeline if reference else WanPipeline
            pipe = pipeline_type.from_pretrained(repo, vae=vae, torch_dtype=torch.bfloat16)
            if placement == 'resident':
                pipe.to('cuda')
            else:
                pipe.enable_model_cpu_offload()
            pipe.vae.enable_tiling()
            return pipe
        pipe,reused=cached_pipeline(('wan',expected_model,placement,bool(reference)),build_pipeline)
        metrics['pipeline_reused']=reused
        torch.cuda.synchronize()
        load_seconds = time.monotonic() - started
        metrics['load_seconds'] = round(load_seconds, 3)
        original_decode = getattr(pipe.vae.decode, '_vg_original', pipe.vae.decode)
        def measured_decode(*args, **kwargs):
            torch.cuda.synchronize()
            decode_started = time.monotonic()
            result = original_decode(*args, **kwargs)
            torch.cuda.synchronize()
            metrics['decode_seconds'] = round(time.monotonic() - decode_started, 3)
            return result
        measured_decode._vg_original = original_decode
        pipe.vae.decode = measured_decode
        kwargs = dict(prompt=payload['prompt'], negative_prompt=payload.get('negative_prompt', ''),
                      height=height, width=width, num_frames=frames, num_inference_steps=steps,
                      guidance_scale=5.0, generator=torch.Generator(device='cpu').manual_seed(int(payload['seed'])))
        if reference:
            if len(reference) > 8 * 1024 * 1024:
                raise ValueError('Prevelika referentna slika.')
            kwargs['image'] = Image.open(io.BytesIO(reference)).convert('RGB')
        pipeline_started = time.monotonic()
        output = pipe(**kwargs).frames[0]
        torch.cuda.synchronize()
        metrics['pipeline_seconds'] = round(time.monotonic() - pipeline_started, 3)
        metrics['sampling_and_conditioning_seconds'] = round(metrics['pipeline_seconds'] - metrics.get('decode_seconds', 0), 3)
        metrics['peak_allocated_vram_gib'] = round(torch.cuda.max_memory_allocated() / 1024**3, 3)
        metrics['peak_reserved_vram_gib'] = round(torch.cuda.max_memory_reserved() / 1024**3, 3)
        import resource
        metrics['peak_cpu_ram_gib'] = round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024**2, 3)
        with tempfile.TemporaryDirectory() as folder:
            path = str(Path(folder)/'video.mp4')
            export_to_video(output, path, fps=fps)
            data = Path(path).read_bytes()
        cache.commit()
        return {'ok': True, 'video': data, 'elapsed_seconds': time.monotonic()-started, 'load_seconds': load_seconds, 'metrics': metrics}
    except Exception as exc:
        _PIPELINE_CACHE.clear()
        # Return failures so Django can retain cost reservation and explain the failure.
        return {'ok': False, 'error': f'{type(exc).__name__}: {str(exc)[:1500]}', 'elapsed_seconds': time.monotonic()-started, 'metrics': metrics}

@app.function(image=image, gpu='L4', cpu=2, memory=49152, timeout=900,
              min_containers=0, max_containers=1, scaledown_window=2,
              retries=0, volumes={'/cache': cache})
def generate_economy(payload: dict):
    return run_generation(payload, 'wan21-1.3b', 'L4')

@app.function(image=image, gpu='L40S', cpu=2, memory=65536, timeout=900,
              min_containers=0, max_containers=1, scaledown_window=2,
              retries=0, volumes={'/cache': cache})
def generate_balanced(payload: dict):
    return run_generation(payload, 'wan22-5b', 'L40S')

@app.function(image=image, gpu='A100-80GB', cpu=2, memory=65536, timeout=900,
              min_containers=0, max_containers=1, scaledown_window=2,
              retries=0, volumes={'/cache': cache})
def generate_balanced_a100(payload: dict):
    return run_generation(payload, 'wan22-5b', 'A100-80GB')

@app.function(image=image, gpu='A10', cpu=2, memory=65536, timeout=900,
              min_containers=0, max_containers=1, scaledown_window=2,
              retries=0, volumes={'/cache': cache})
def generate_balanced_a10(payload: dict):
    return run_generation(payload, 'wan22-5b', 'A10')


@app.function(image=image,gpu='RTX-PRO-6000',cpu=2,memory=65536,timeout=420,
              min_containers=0,max_containers=1,scaledown_window=2,retries=0,volumes={'/cache':cache})
def generate_balanced_rtx(payload:dict):
    return run_generation(payload,'wan22-5b','RTX-PRO-6000')


@app.function(image=image,gpu='B200',cpu=2,memory=65536,timeout=300,
              min_containers=0,max_containers=1,scaledown_window=2,retries=0,volumes={'/cache':cache})
def generate_balanced_b200(payload:dict):
    return run_generation(payload,'wan22-5b','B200')
