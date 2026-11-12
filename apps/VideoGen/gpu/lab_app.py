"""Isolated experimental runtimes; deploying never starts inference."""
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


app=modal.App('videogen-lab')
cache=modal.Volume.from_name('videogen-model-cache',create_if_missing=True)
image=(modal.Image.debian_slim(python_version='3.12').apt_install('ffmpeg')
       .pip_install('torch==2.8.0','torchvision==0.23.0','transformers==4.57.1',
                    'accelerate==1.10.1','peft==0.17.1','safetensors==0.6.2',
                    'sentencepiece==0.2.1','ftfy==6.3.1','imageio[ffmpeg]==2.37.0','Pillow==11.3.0',
                    'diffusers==0.37.1')
       .env({'HF_HOME':'/cache/huggingface','HF_HUB_DISABLE_TELEMETRY':'1','HF_HUB_DISABLE_XET':'1'}))
HY_REPO='hunyuanvideo-community/HunyuanVideo-1.5-Diffusers-480p_i2v_step_distilled'
HY_REV='854c04a4c8a53d990b418c7478f0802c0fc8c726'
WAN_REPO='Wan-AI/Wan2.2-I2V-A14B-Diffusers'
WAN_REV='596658fd9ca6b7b71d5057529bbf319ecbc61d74'
LORA_REPO='lightx2v/Wan2.2-Distill-Loras'
LORA_REV='57adea585d1d21085e2dfc91ce3c7b646cdd9345'
LORA_FILES=['wan2.2_i2v_A14b_high_noise_lora_rank64_lightx2v_4step_1022.safetensors',
            'wan2.2_i2v_A14b_low_noise_lora_rank64_lightx2v_4step_1022.safetensors']
FUSED_FOLDER='/cache/videogen-lightx-wan22-fused-v1'

def configure_light_scheduler(pipe):
    """Author's DMD2 grid, shift 5, Euler updates and two high/two low steps."""
    from diffusers import FlowMatchEulerDiscreteScheduler
    pipe.scheduler=FlowMatchEulerDiscreteScheduler(shift=5.0,stochastic_sampling=False)
    original=pipe.scheduler.set_timesteps
    def set_grid(num_inference_steps=None,device=None,**kwargs):
        if num_inference_steps not in [None,4]: raise ValueError('LightX2V profile requires four steps.')
        return original(device=device,sigmas=[1.0,.75,.5,.25])
    pipe.scheduler.set_timesteps=set_grid

@app.function(image=image,cpu=2,memory=98304,timeout=300,min_containers=0,max_containers=1,
              scaledown_window=2,retries=0,volumes={'/cache':cache})
def prepare_light_merged(payload:dict):
    started=time.monotonic()
    try:
        import gc,json,resource
        from pathlib import Path
        import torch
        from huggingface_hub import hf_hub_download
        from diffusers import WanImageToVideoPipeline,WanTransformer3DModel
        cache.reload();torch.set_num_threads(2)
        if payload.get('model_id')!='lightx-wan22':raise ValueError('Wrong merged profile.')
        target=Path(FUSED_FOLDER);marker=target/'ready.json'
        if marker.exists():return {'ok':True,'elapsed_seconds':time.monotonic()-started,'cached':True}
        if not Path('/cache/videogen-lightx-wan22-037-v1.json').exists():raise RuntimeError('Validate original weights first.')
        target.mkdir(exist_ok=True)
        results=[]
        for subfolder,filename in zip(['transformer','transformer_2'],LORA_FILES):
            output=target/subfolder
            if (output/'merged-ready.json').exists():continue
            t=time.monotonic()
            model=WanTransformer3DModel.from_pretrained(WAN_REPO,subfolder=subfolder,revision=WAN_REV,
                                     torch_dtype=torch.bfloat16,local_files_only=True,low_cpu_mem_usage=True)
            lora=hf_hub_download(LORA_REPO,filename,revision=LORA_REV,local_files_only=True)
            state=WanImageToVideoPipeline.lora_state_dict(lora)
            WanImageToVideoPipeline.load_lora_into_transformer(state,transformer=model,
                                      adapter_name='distill',low_cpu_mem_usage=True)
            del state
            model.set_adapters('distill');model.fuse_lora(adapter_names=['distill'],safe_fusing=True)
            model.unload_lora()
            if any('lora_' in k for k in model.state_dict()):raise RuntimeError('Adapters were not fully merged/unloaded.')
            model.save_pretrained(output,safe_serialization=True,max_shard_size='5GB')
            details={'source_revision':WAN_REV,'adapter':filename,'adapter_revision':LORA_REV,
                     'elapsed_seconds':round(time.monotonic()-t,3),'fused':True,'dtype':'bfloat16'}
            (output/'merged-ready.json').write_text(json.dumps(details));cache.commit()
            results.append(details);del model;gc.collect()
        marker.write_text(json.dumps({'experts':['transformer','transformer_2'],'source_revision':WAN_REV,'adapter_revision':LORA_REV}))
        cache.commit()
        return {'ok':True,'elapsed_seconds':time.monotonic()-started,'experts':results,
                'peak_cpu_ram_gib':round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss/1024**2,3)}
    except Exception as exc:
        _PIPELINE_CACHE.clear()
        cache.commit()
        return {'ok':False,'elapsed_seconds':time.monotonic()-started,'error':f'{type(exc).__name__}: {str(exc)[:1800]}'}

@app.function(image=image,cpu=2,memory=98304,timeout=1500,min_containers=0,max_containers=1,
              scaledown_window=2,retries=0,volumes={'/cache':cache})
def prepare_lab(payload:dict):
    started=time.monotonic()
    try:
        if payload.get('cached_only'):
            from pathlib import Path
            cache.reload();model=payload['model_id']
            if model!='hunyuan15-step' or not Path('/cache',f'videogen-{model}-037-v2.json').exists():
                raise RuntimeError('Prepared Hunyuan cache missing; bounded round refuses downloads.')
            return {'ok':True,'cached':True,'elapsed_seconds':time.monotonic()-started}
        import json
        from pathlib import Path
        import torch
        from huggingface_hub import snapshot_download,hf_hub_download
        from diffusers import HunyuanVideo15ImageToVideoPipeline,WanImageToVideoPipeline,AutoencoderKLWan
        from safetensors import safe_open
        cache.reload();torch.set_num_threads(2)
        model=payload['model_id']
        if model not in ['hunyuan15-step','lightx-wan22']:raise ValueError('Unknown lab model.')
        validation_version='037-v2' if model=='hunyuan15-step' else '037-v1'
        marker=Path('/cache')/f'videogen-{model}-{validation_version}.json'
        if marker.exists():return {'ok':True,'elapsed_seconds':time.monotonic()-started,'cached':True}
        repo,revision=(HY_REPO,HY_REV) if model=='hunyuan15-step' else (WAN_REPO,WAN_REV)
        folder=snapshot_download(repo,revision=revision,max_workers=4,
                   allow_patterns=['*.json','*.safetensors','*.txt','*.model','*.jinja'],
                   ignore_patterns=['*.bin','*.onnx','*.h5'])
        cache.commit()
        config=json.loads(Path(folder,'transformer/config.json').read_text())
        if model=='hunyuan15-step':
            if not config.get('use_meanflow') or config['num_layers']!=54:
                raise RuntimeError('Not the expected Hunyuan step-distilled transformer.')
            # Construct all components on CPU to catch runtime/tokenizer issues before a GPU.
            pipe=HunyuanVideo15ImageToVideoPipeline.from_pretrained(folder,torch_dtype=torch.bfloat16,local_files_only=True)
            if pipe.guider.config.guidance_scale!=1.0:raise RuntimeError('Hunyuan distilled needs guidance 1.')
            if not pipe.tokenizer.chat_template:raise RuntimeError('Missing official tokenizer chat template.')
            embeds,mask=pipe._get_mllm_prompt_embeds(pipe.text_encoder,pipe.tokenizer,'Two adults gently hug.',
                                    device=torch.device('cpu'),tokenizer_max_length=32,crop_start=0)
            details={'repo':repo,'revision':revision,'meanflow':True,'layers':54,'cpu_component_load':True,
                     'chat_template_present':True,'cpu_text_probe_shape':list(embeds.shape)}
        else:
            adapters=[]
            for filename in LORA_FILES:
                path=hf_hub_download(LORA_REPO,filename,revision=LORA_REV)
                converted=WanImageToVideoPipeline.lora_state_dict(path)
                if not converted:raise RuntimeError('LightX2V adapter conversion returned no weights.')
                adapters.append({'file':filename,'converted_keys':len(converted)})
                del converted
            vae=AutoencoderKLWan.from_pretrained(folder,subfolder='vae',torch_dtype=torch.float32,local_files_only=True)
            with torch.no_grad():
                decoded=vae.decode(vae.encode(torch.zeros(1,3,1,32,32)).latent_dist.mode()).sample
                if tuple(decoded.shape)!=(1,3,1,32,32):raise RuntimeError('Unexpected Wan VAE probe output.')
            details={'repo':repo,'revision':revision,'adapters':adapters,'steps':4,'cfg':1,'shift':5,'engine':'diffusers-lightx-lora'}
        marker.write_text(json.dumps(details));cache.commit()
        return {'ok':True,'elapsed_seconds':time.monotonic()-started,'validation':details}
    except Exception as exc:
        _PIPELINE_CACHE.clear()
        cache.commit()
        return {'ok':False,'elapsed_seconds':time.monotonic()-started,'error':f'{type(exc).__name__}: {str(exc)[:1800]}'}

def run_lab(payload,model,gpu,requested_ram=96,group_blocks=2):
    started=time.monotonic();metrics={'gpu':gpu,'placement':payload.get('placement','offload'),
                                     'preparation_ram_gib':96,'requested_ram_gib':requested_ram,'engine':'diffusers-037'}
    try:
        import io,tempfile,json,resource
        from pathlib import Path
        import torch
        from PIL import Image,ImageOps
        from diffusers import HunyuanVideo15ImageToVideoPipeline,WanImageToVideoPipeline,AutoencoderKLWan
        from diffusers.utils import export_to_video
        reload_models(('hy',gpu,payload.get('placement')) if model=='hunyuan15-step' else ('lightx',gpu,payload.get('placement'),group_blocks))
        if payload.get('model_id')!=model or payload.get('gpu')!=gpu:raise ValueError('Wrong lab worker.')
        validation_version='037-v2' if model=='hunyuan15-step' else '037-v1'
        if not Path('/cache',f'videogen-{model}-{validation_version}.json').exists():raise RuntimeError('CPU validation is required.')
        reference=payload.get('reference');seconds=int(payload['seconds']);steps=int(payload['steps'])
        if not isinstance(reference,bytes) or not 0<len(reference)<=8*1024*1024:raise ValueError('Starting image is required.')
        if payload.get('end_reference'):raise ValueError('This profile supports only a starting image.')
        if seconds not in [3,5,7,10] or payload['aspect'] not in ['16:9','9:16','1:1']:raise ValueError('Use 3, 5, 7 or 10 seconds.')
        torch.manual_seed(int(payload['seed']));torch.cuda.reset_peak_memory_stats()
        metrics['gpu_name']=torch.cuda.get_device_name(0)
        metrics.update(gpu_total_memory_gib=round(torch.cuda.get_device_properties(0).total_memory/1024**3,2),torch_version=str(torch.__version__),cuda_version=torch.version.cuda)
        input_image=Image.open(io.BytesIO(reference)).convert('RGB')
        if model=='hunyuan15-step':
            valid_hy=(gpu in ['A100-80GB','RTX-PRO-6000'] and payload.get('placement')=='resident' and steps in [8,12]) or (gpu=='B200' and payload.get('placement')=='resident' and steps==8) or (gpu=='L40S' and payload.get('placement')=='offload' and steps==8) or (gpu=='A10' and payload.get('placement')=='merged-blocks' and steps==8)
            if not valid_hy:raise ValueError('Hunyuan uses resident A100 or an 8-step L40S offload profile.')
            def build_pipeline():
                pipe=HunyuanVideo15ImageToVideoPipeline.from_pretrained(HY_REPO,revision=HY_REV,torch_dtype=torch.bfloat16,local_files_only=True)
                if payload['placement']=='resident':pipe.to('cuda')
                elif gpu=='A10':
                    from accelerate import cpu_offload_with_hook
                    hooks=[]
                    for name in ['image_encoder','text_encoder','text_encoder_2','vae']:
                        component,hook=cpu_offload_with_hook(getattr(pipe,name),torch.device('cuda'),prev_module_hook=hooks[-1] if hooks else None)
                        setattr(pipe,name,component);hooks.append(hook)
                    pipe.transformer.enable_group_offload(onload_device=torch.device('cuda'),offload_device=torch.device('cpu'),
                             offload_type='block_level',num_blocks_per_group=2,use_stream=False)
                    def release_encoders(module,args):
                        for hook in hooks:hook.offload()
                    pipe.transformer.register_forward_pre_hook(release_encoders)
                    metrics.update(group_blocks=2,group_offload_stream=False)
                else:pipe.enable_model_cpu_offload()
                pipe.vae.enable_tiling()
                return pipe
            pipe,reused=cached_pipeline(('hy',gpu,payload['placement']),build_pipeline)
            metrics['pipeline_reused']=reused
            input_image=ImageOps.fit(input_image,{'16:9':(848,480),'9:16':(480,848),'1:1':(640,640)}[payload['aspect']])
            metrics.update(repo=HY_REPO,revision=HY_REV,meanflow=True,guidance_scale=1,negative_prompt_applied=0)
            kwargs={'image':input_image,'prompt':payload['prompt'],'num_frames':seconds*24+1,
                    'num_inference_steps':steps,'generator':torch.Generator('cuda').manual_seed(int(payload['seed']))}
        else:
            if steps!=4 or payload.get('placement') not in ['offload','merged','merged-blocks','merged-resident']:raise ValueError('LightX2V profile uses four steps and offload.')
            def build_pipeline():
                vae=AutoencoderKLWan.from_pretrained(WAN_REPO,revision=WAN_REV,subfolder='vae',torch_dtype=torch.float32,local_files_only=True)
                if payload['placement'] in ['merged','merged-blocks','merged-resident']:
                    from diffusers import WanTransformer3DModel
                    if not Path(FUSED_FOLDER,'ready.json').exists():raise RuntimeError('Prepare fused experts on CPU first.')
                    high=WanTransformer3DModel.from_pretrained(FUSED_FOLDER,subfolder='transformer',torch_dtype=torch.bfloat16,local_files_only=True)
                    low=WanTransformer3DModel.from_pretrained(FUSED_FOLDER,subfolder='transformer_2',torch_dtype=torch.bfloat16,local_files_only=True)
                    pipe=WanImageToVideoPipeline.from_pretrained(WAN_REPO,revision=WAN_REV,vae=vae,transformer=high,
                                      transformer_2=low,torch_dtype=torch.bfloat16,local_files_only=True)
                else:
                    pipe=WanImageToVideoPipeline.from_pretrained(WAN_REPO,revision=WAN_REV,vae=vae,torch_dtype=torch.bfloat16,local_files_only=True)
                    pipe.load_lora_weights(LORA_REPO,weight_name=LORA_FILES[0],revision=LORA_REV,adapter_name='high',local_files_only=True)
                    pipe.load_lora_weights(LORA_REPO,weight_name=LORA_FILES[1],revision=LORA_REV,adapter_name='low',load_into_transformer_2=True,local_files_only=True)
                    pipe.transformer.set_adapters('high');pipe.transformer_2.set_adapters('low')
                configure_light_scheduler(pipe)
                if payload['placement']=='merged-blocks':
                    # One 14B expert exceeds 24 GB. Keep only two blocks on device;
                    # text encoder and VAE use separate component hooks.
                    from accelerate import cpu_offload_with_hook
                    pipe.text_encoder,text_hook=cpu_offload_with_hook(pipe.text_encoder,torch.device('cuda'))
                    pipe.vae,vae_hook=cpu_offload_with_hook(pipe.vae,torch.device('cuda'),prev_module_hook=text_hook)
                    for transformer in [pipe.transformer,pipe.transformer_2]:
                        transformer.enable_group_offload(onload_device=torch.device('cuda'),offload_device=torch.device('cpu'),
                                          offload_type='block_level',num_blocks_per_group=group_blocks,use_stream=False)
                elif payload['placement']=='merged-resident':
                    if gpu!='RTX-PRO-6000':raise ValueError('Prepared resident profile requires RTX PRO 6000.')
                    pipe.to('cuda')
                else:
                    pipe.enable_model_cpu_offload()
                pipe.vae.enable_tiling()
                return pipe
            pipe,reused=cached_pipeline(('lightx',gpu,payload['placement'],group_blocks),build_pipeline)
            metrics.update(pipeline_reused=reused,adapters_premerged=payload['placement']!='offload')
            if payload['placement']=='merged-blocks':metrics.update(group_blocks=group_blocks,group_offload_stream=False)
            width,height={'16:9':(848,480),'9:16':(480,848),'1:1':(640,640)}[payload['aspect']]
            metrics.update(repo=WAN_REPO,revision=WAN_REV,lora_revision=LORA_REV,adapters=LORA_FILES,
                           engine='diffusers-lightx-lora',guidance_scale=1,negative_prompt_applied=0)
            kwargs={'image':input_image,'prompt':payload['prompt'],'width':width,'height':height,
                    'num_frames':seconds*24+1,'num_inference_steps':4,'guidance_scale':1.,'guidance_scale_2':1.,
                    'generator':torch.Generator('cpu').manual_seed(int(payload['seed']))}
        torch.cuda.synchronize();metrics['load_seconds']=round(time.monotonic()-started,3)
        original_decode=getattr(pipe.vae.decode, '_vg_original', pipe.vae.decode)
        def measured_decode(*args,**kwargs):
            torch.cuda.synchronize();t=time.monotonic();result=original_decode(*args,**kwargs)
            torch.cuda.synchronize();metrics['decode_seconds']=round(time.monotonic()-t,3);return result
        measured_decode._vg_original = original_decode
        pipe.vae.decode=measured_decode
        t=time.monotonic();frames=pipe(**kwargs).frames[0];torch.cuda.synchronize()
        metrics['pipeline_seconds']=round(time.monotonic()-t,3)
        metrics['sampling_and_conditioning_seconds']=round(metrics['pipeline_seconds']-metrics.get('decode_seconds',0),3)
        metrics['timesteps']=pipe.scheduler.timesteps.cpu().float().tolist()
        metrics['peak_allocated_vram_gib']=round(torch.cuda.max_memory_allocated()/1024**3,3)
        metrics['peak_reserved_vram_gib']=round(torch.cuda.max_memory_reserved()/1024**3,3)
        metrics['peak_cpu_ram_gib']=round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss/1024**2,3)
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/'video.mp4';export_to_video(frames,str(path),fps=24);video=path.read_bytes()
        return {'ok':True,'video':video,'elapsed_seconds':time.monotonic()-started,'metrics':metrics}
    except Exception as exc:
        _PIPELINE_CACHE.clear()
        return {'ok':False,'error':f'{type(exc).__name__}: {str(exc)[:1800]}',
                'elapsed_seconds':time.monotonic()-started,'metrics':metrics}

@app.function(image=image,gpu='A100-80GB',cpu=2,memory=65536,timeout=600,min_containers=0,max_containers=1,
              scaledown_window=2,retries=0,volumes={'/cache':cache})
def generate_hunyuan(payload:dict):return run_lab(payload,'hunyuan15-step','A100-80GB',64)

@app.function(image=image,gpu='A100-80GB',cpu=2,memory=65536,timeout=260,min_containers=0,max_containers=1,
              scaledown_window=2,retries=0,volumes={'/cache':cache})
def generate_hunyuan8(payload:dict):
    if int(payload.get('steps',0))!=8:raise ValueError('This bounded worker requires 8 steps.')
    return run_lab(payload,'hunyuan15-step','A100-80GB',64)

@app.function(image=image,gpu='L40S',cpu=2,memory=49152,timeout=360,min_containers=0,max_containers=1,
              scaledown_window=2,retries=0,volumes={'/cache':cache})
def generate_hunyuan_l40s(payload:dict):return run_lab(payload,'hunyuan15-step','L40S',48)

@app.function(image=image,gpu='L40S',cpu=2,memory=98304,timeout=600,min_containers=0,max_containers=1,
              scaledown_window=2,retries=0,volumes={'/cache':cache})
def generate_lightx(payload:dict):return run_lab(payload,'lightx-wan22','L40S')

@app.function(image=image,gpu='L40S',cpu=2,memory=98304,timeout=240,min_containers=0,max_containers=1,
              scaledown_window=2,retries=0,volumes={'/cache':cache})
def generate_lightx_merged(payload:dict):return run_lab(payload,'lightx-wan22','L40S')

@app.function(image=image,gpu='A100-40GB',cpu=2,memory=81920,timeout=260,min_containers=0,max_containers=1,
              scaledown_window=2,retries=0,volumes={'/cache':cache})
def generate_lightx_a10040(payload:dict):
    if payload.get('placement')!='merged':raise ValueError('Use prepared weights on A100 40.')
    return run_lab(payload,'lightx-wan22','A100-40GB',80)

@app.function(image=image,gpu='A10',cpu=2,memory=81920,timeout=480,min_containers=0,max_containers=1,
              scaledown_window=2,retries=0,volumes={'/cache':cache})
def generate_lightx_a10(payload:dict):
    if payload.get('placement')!='merged-blocks':raise ValueError('A10 requires block offload.')
    return run_lab(payload,'lightx-wan22','A10',80,group_blocks=4)


@app.function(image=image,gpu='A10',cpu=2,memory=65536,timeout=600,min_containers=0,max_containers=1,
              scaledown_window=2,retries=0,volumes={'/cache':cache})
def generate_hunyuan_a10(payload:dict):return run_lab(payload,'hunyuan15-step','A10',64)

@app.function(image=image,gpu='RTX-PRO-6000',cpu=2,memory=65536,timeout=300,min_containers=0,max_containers=1,
              scaledown_window=2,retries=0,volumes={'/cache':cache})
def generate_hunyuan_rtx(payload:dict):return run_lab(payload,'hunyuan15-step','RTX-PRO-6000',64)

@app.function(image=image,gpu='RTX-PRO-6000',cpu=2,memory=81920,timeout=300,min_containers=0,max_containers=1,
              scaledown_window=2,retries=0,volumes={'/cache':cache})
def generate_lightx_rtx(payload:dict):
    if payload.get('placement')!='merged-resident':raise ValueError('Use prepared resident weights on RTX.')
    return run_lab(payload,'lightx-wan22','RTX-PRO-6000',80)


@app.function(image=image,gpu='B200',cpu=2,memory=65536,timeout=240,min_containers=0,max_containers=1,
              scaledown_window=2,retries=0,volumes={'/cache':cache})
def generate_hunyuan_b200(payload:dict):
    if int(payload.get('steps',0))!=8:raise ValueError('The bounded B200 comparison uses eight steps.')
    return run_lab(payload,'hunyuan15-step','B200',64)
