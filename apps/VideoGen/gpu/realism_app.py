"""Isolated, pinned native LTX-2.3 runtime. Deploying does not run inference."""
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


app=modal.App('videogen-realism')
cache=modal.Volume.from_name('videogen-model-cache',create_if_missing=True)
SOURCE_REV='d151147788a9284cca791edc6ce898007e727fe6'
REPO='Lightricks/LTX-2.3'
REV='c1521179de480464f366a98a9d9b2acc4cc097b9'
TEXT_REPO='Lightricks/LTX-2'
TEXT_REV='64f65d09e0b76c96202b5bc09997673184cf9b5d'
WEIGHTS='ltx-2.3-22b-distilled-1.1.safetensors'
UPSCALER='ltx-2.3-spatial-upscaler-x2-1.1.safetensors'
FOLDER='/cache/videogen-ltx23-native-v1'
image=(modal.Image.debian_slim(python_version='3.12').apt_install('ffmpeg','git','libgomp1')
       .pip_install('torch==2.8.0','torchvision==0.23.0','torchaudio==2.8.0',
                    'transformers==5.14.1','accelerate==1.10.1','safetensors==0.8.0',
                    'einops==0.8.1','scipy==1.16.2','Pillow==11.3.0','av==16.0.1',
                    'OpenImageIO==3.1.10.0','cloudpickle==3.1.1')
       .pip_install(f'git+https://github.com/Lightricks/LTX-2.git@{SOURCE_REV}#subdirectory=packages/ltx-core',
                    f'git+https://github.com/Lightricks/LTX-2.git@{SOURCE_REV}#subdirectory=packages/ltx-pipelines')
       .env({'HF_HOME':'/cache/huggingface','HF_HUB_DISABLE_TELEMETRY':'1','HF_HUB_DISABLE_XET':'1'}))

@app.function(image=image,cpu=2,memory=131072,timeout=1200,min_containers=0,max_containers=1,
              scaledown_window=2,retries=0,volumes={'/cache':cache})
def prepare_ltx23(payload:dict):
    started=time.monotonic()
    try:
        if payload.get('cached_only'):
            from pathlib import Path
            cache.reload()
            if not Path(FOLDER,'ready.json').exists():raise RuntimeError('Prepared model cache missing; bounded round refuses downloads.')
            return {'ok':True,'cached':True,'elapsed_seconds':time.monotonic()-started}
        import json,os,resource
        from pathlib import Path
        import torch
        from huggingface_hub import snapshot_download,hf_hub_download
        from safetensors import safe_open
        from ltx_core.text_encoders.gemma.gemma_assets import GemmaAssets,build_gemma_hf_config,build_gemma_hf_tokenizer,build_gemma_processor
        from ltx_pipelines.distilled import DistilledPipeline
        from ltx_pipelines.utils.model_paths import ModelPaths
        from ltx_pipelines.utils.constants import DISTILLED_SIGMAS,STAGE_2_DISTILLED_SIGMAS,detect_model_version
        cache.reload();torch.set_num_threads(2)
        if payload.get('model_id')!='ltx23-22b':raise ValueError('Wrong model for preparation.')
        root=Path(FOLDER);root.mkdir(exist_ok=True);marker=root/'ready.json'
        if marker.exists():return {'ok':True,'cached':True,'elapsed_seconds':time.monotonic()-started}
        checkpoint=hf_hub_download(REPO,WEIGHTS,revision=REV)
        upscaler=hf_hub_download(REPO,UPSCALER,revision=REV);cache.commit()
        text_snapshot=Path(snapshot_download(TEXT_REPO,revision=TEXT_REV,max_workers=4,
            allow_patterns=['text_encoder/config.json','text_encoder/model-*.safetensors','text_encoder/model.safetensors.index.json','tokenizer/*']))
        gemma=root/'gemma';gemma.mkdir(exist_ok=True)
        for source in list((text_snapshot/'text_encoder').iterdir())+list((text_snapshot/'tokenizer').iterdir()):
            if source.is_file():
                dest=gemma/source.name
                if not dest.exists():os.symlink(str(source),dest)
        cache.commit()
        assets=GemmaAssets.load(gemma)
        config=build_gemma_hf_config(assets);tokenizer=build_gemma_hf_tokenizer(assets)
        processor=build_gemma_processor(assets,tokenizer)
        encoded=tokenizer('A person takes two natural steps.',return_tensors='pt')
        if not len(assets.weight_paths) or encoded['input_ids'].numel()<3:raise RuntimeError('Gemma assets failed validation.')
        if tuple(detect_model_version(checkpoint))[:2]!=(2,3):raise RuntimeError('Unexpected checkpoint generation.')
        with safe_open(checkpoint,framework='pt',device='cpu') as sf:
            tensor_count=len(sf.keys());metadata=sf.metadata()
        # Constructors are lazy; validate all component/config wiring on CPU before paid GPU work.
        pipeline=DistilledPipeline(model_paths=ModelPaths.from_monolith(checkpoint,str(gemma)),
                                   spatial_upsampler_path=upscaler,loras=[],device=torch.device('cpu'))
        details={'repo':REPO,'revision':REV,'checkpoint':checkpoint,'upscaler':upscaler,'gemma':str(gemma),
                 'text_repo':TEXT_REPO,'text_revision':TEXT_REV,'source_revision':SOURCE_REV,
                 'checkpoint_tensors':tensor_count,'model_version':list(detect_model_version(checkpoint)),
                 'stage1_sigmas':DISTILLED_SIGMAS.tolist(),'stage2_sigmas':STAGE_2_DISTILLED_SIGMAS.tolist(),
                 'text_config_class':type(config).__name__,'processor_class':type(processor).__name__,
                 'cpu_constructor_and_tokenizer_probe':True,'full_cpu_inference':False}
        marker.write_text(json.dumps(details));cache.commit()
        return {'ok':True,'elapsed_seconds':time.monotonic()-started,'validation':details,
                'peak_cpu_ram_gib':round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss/1024**2,3)}
    except Exception as exc:
        _PIPELINE_CACHE.clear()
        cache.commit()
        return {'ok':False,'elapsed_seconds':time.monotonic()-started,'error':f'{type(exc).__name__}: {str(exc)[:1800]}'}

def run_ltx23(payload:dict,expected_gpu:str):
    started=time.monotonic();metrics={'gpu':expected_gpu,'placement':'native','requested_ram_gib':128,
        'preparation_ram_gib':128,'engine':'ltx23-native-two-stage','source_revision':SOURCE_REV,
        'repo':REPO,'revision':REV,'text_repo':TEXT_REPO,'text_revision':TEXT_REV,
        'guidance_scale':1,'negative_prompt_applied':0,'native_audio':True,'weight_dtype':'bfloat16'}
    try:
        import json,tempfile,resource
        from pathlib import Path
        import torch
        from PIL import Image
        from ltx_pipelines.distilled import DistilledPipeline
        from ltx_pipelines.utils.model_paths import ModelPaths
        from ltx_pipelines.utils.args import ImageConditioningInput
        from ltx_pipelines.utils.constants import DISTILLED_SIGMAS,STAGE_2_DISTILLED_SIGMAS
        from ltx_pipelines.utils.media_io import encode_video
        from ltx_core.model.video_vae import AUTO_TILING,get_video_chunks_number
        reload_models(('native',expected_gpu))
        if payload.get('model_id')!='ltx23-22b' or payload.get('gpu')!=expected_gpu or payload.get('placement')!='native':raise ValueError('Wrong native H100 worker.')
        if int(payload['steps'])!=8 or int(payload['seconds']) not in [3,5,7,10] or payload['aspect'] not in ['9:16','16:9','1:1']:raise ValueError('Use the fixed 8-step distilled profile.')
        render_profile=payload.get('render_profile','standard')
        if render_profile not in ['standard','detail','ultra'] or (render_profile in ['detail','ultra'] and
                (expected_gpu not in ['RTX-PRO-6000','B200'] or payload['aspect']!='9:16' or int(payload['seconds'])!=5)):
            raise ValueError('Detail profile requires a five-second portrait on RTX/B200.')
        end_reference=payload.get('end_reference')
        if end_reference and (not isinstance(end_reference,bytes) or len(end_reference)>8*1024*1024):raise ValueError('Invalid end image.')
        reference=payload.get('reference')
        if not isinstance(reference,bytes) or not 0<len(reference)<=8*1024*1024:raise ValueError('Starting image is required.')
        ready=Path(FOLDER,'ready.json')
        if not ready.exists():raise RuntimeError('CPU preparation and validation must complete first.')
        details=json.loads(ready.read_text())
        metrics.update(gpu_name=torch.cuda.get_device_name(0),gpu_total_memory_gib=round(torch.cuda.get_device_properties(0).total_memory/1024**3,2),
                       torch_version=str(torch.__version__),cuda_version=torch.version.cuda,
                       stage1_sigmas=DISTILLED_SIGMAS.tolist(),stage2_sigmas=STAGE_2_DISTILLED_SIGMAS.tolist(),
                       stage1_steps=len(DISTILLED_SIGMAS)-1,stage2_steps=len(STAGE_2_DISTILLED_SIGMAS)-1)
        torch.manual_seed(int(payload['seed']));torch.cuda.reset_peak_memory_stats()
        width,height={'9:16':(576,1024),'16:9':(1024,576),'1:1':(768,768)}[payload['aspect']]
        if render_profile=='detail':width,height=896,1536
        if render_profile=='ultra':width,height=1152,2048
        metrics.update(render_profile=render_profile,render_width=width,render_height=height,endpoint_conditioning=bool(end_reference))
        with tempfile.TemporaryDirectory() as folder:
            source=Path(folder)/'reference.png';source.write_bytes(reference)
            with Image.open(source) as im:im.verify()
            reference_frame=(int(payload['seconds'])*24//2//8)*8 if payload.get('image_role')=='reference' else 0
            strength=.5 if payload.get('image_role')=='reference' else 1.
            conditions=[ImageConditioningInput(str(source),reference_frame,strength,None)]
            if end_reference:
                end=Path(folder)/'end-reference.png';end.write_bytes(end_reference)
                with Image.open(end) as im:im.verify()
                conditions.append(ImageConditioningInput(str(end),int(payload['seconds'])*24,1.,None))
            def build_pipeline():
                pipeline=DistilledPipeline(model_paths=ModelPaths.from_monolith(details['checkpoint'],details['gemma']),
                                           spatial_upsampler_path=details['upscaler'],loras=[],device=torch.device('cuda'))
                return pipeline
            pipeline,reused=cached_pipeline(('native',expected_gpu),build_pipeline)
            metrics['pipeline_reused']=reused
            torch.cuda.synchronize();metrics['load_seconds']=round(time.monotonic()-started,3)
            t=time.monotonic()
            with torch.inference_mode():
                frames,audio,num_frames,tiling=pipeline(prompt=payload['prompt'],seed=int(payload['seed']),height=height,width=width,
                    num_frames=int(payload['seconds'])*24+1,frame_rate=24.,images=conditions,
                    tiling_config=AUTO_TILING,enhance_prompt=False)
                torch.cuda.synchronize();metrics['sampling_and_conditioning_seconds']=round(time.monotonic()-t,3)
                t=time.monotonic();path=Path(folder)/'video.mp4'
                encode_video(video=frames,fps=24.,audio=audio,output_path=str(path),video_chunks_number=get_video_chunks_number(num_frames,tiling))
                if render_profile=='detail':
                    import subprocess
                    cropped=Path(folder)/'portrait.mp4'
                    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-i',str(path),'-vf','crop=864:1536:16:0',
                                    '-c:v','libx264','-preset','fast','-crf','16','-c:a','copy',str(cropped)],check=True,timeout=60)
                    path=cropped;width,height=864,1536
                    metrics['crop_note']='Generated 896x1536; cropped 16 pixels per side to exact 9:16. No resize/upscale after generation.'
                torch.cuda.synchronize();metrics['decode_seconds']=round(time.monotonic()-t,3)
            video=path.read_bytes()
        metrics.update(peak_allocated_vram_gib=round(torch.cuda.max_memory_allocated()/1024**3,3),
                       peak_reserved_vram_gib=round(torch.cuda.max_memory_reserved()/1024**3,3),
                       peak_cpu_ram_gib=round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss/1024**2,3),
                       output_width=width,output_height=height,output_fps=24,
                       timing_note='Native lazy component loading is included in model+input time; decode includes video export.')
        return {'ok':True,'video':video,'elapsed_seconds':time.monotonic()-started,'metrics':metrics}
    except Exception as exc:
        _PIPELINE_CACHE.clear()
        return {'ok':False,'elapsed_seconds':time.monotonic()-started,'metrics':metrics,
                'error':f'{type(exc).__name__}: {str(exc)[:1800]}'}


@app.function(image=image,gpu='H100!',cpu=2,memory=131072,timeout=600,min_containers=0,max_containers=1,
              scaledown_window=2,retries=0,volumes={'/cache':cache})
def generate_ltx23_h100(payload:dict):return run_ltx23(payload,'H100-SXM5')

@app.function(image=image,gpu='RTX-PRO-6000',cpu=2,memory=131072,timeout=600,min_containers=0,max_containers=1,
              scaledown_window=2,retries=0,volumes={'/cache':cache})
def generate_ltx23_rtx(payload:dict):return run_ltx23(payload,'RTX-PRO-6000')

@app.function(image=image,gpu='B200',cpu=2,memory=131072,timeout=600,min_containers=0,max_containers=1,
              scaledown_window=2,retries=0,volumes={'/cache':cache})
def generate_ltx23_b200(payload:dict):return run_ltx23(payload,'B200')
