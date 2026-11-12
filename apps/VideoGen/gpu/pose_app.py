"""Bounded LTX-2.3 IC-LoRA pose experiment, independent from production worker."""
import time
import modal

cache=modal.Volume.from_name('videogen-model-cache',create_if_missing=True)
FOLDER='/cache/videogen-ltx23-native-v1'
SOURCE_REV='d151147788a9284cca791edc6ce898007e727fe6'
image=(modal.Image.debian_slim(python_version='3.12').apt_install('ffmpeg','git','libgomp1')
       .pip_install('torch==2.8.0','torchvision==0.23.0','torchaudio==2.8.0',
                    'transformers==5.14.1','accelerate==1.10.1','safetensors==0.8.0',
                    'einops==0.8.1','scipy==1.16.2','Pillow==11.3.0','av==16.0.1',
                    'OpenImageIO==3.1.10.0','cloudpickle==3.1.1')
       .pip_install(f'git+https://github.com/Lightricks/LTX-2.git@{SOURCE_REV}#subdirectory=packages/ltx-core',
                    f'git+https://github.com/Lightricks/LTX-2.git@{SOURCE_REV}#subdirectory=packages/ltx-pipelines')
       .env({'HF_HOME':'/cache/huggingface','HF_HUB_DISABLE_TELEMETRY':'1','HF_HUB_DISABLE_XET':'1'}))

app=modal.App('videogen-pose-control')
LORA_REPO='Lightricks/LTX-2.3-22b-IC-LoRA-Union-Control'
LORA_FILE='ltx-2.3-22b-ic-lora-union-control-ref0.5.safetensors'
LORA_REV='20a580c'
MARKER='/cache/videogen-pose-control-ready.json'

@app.function(image=image,cpu=1,memory=8192,timeout=180,min_containers=0,max_containers=1,scaledown_window=2,retries=0,volumes={'/cache':cache})
def prepare_pose():
    import json
    from pathlib import Path
    from huggingface_hub import hf_hub_download
    from safetensors import safe_open
    from ltx_pipelines.ic_lora import ICLoraPipeline
    from ltx_core.loader import LoraPathStrengthAndSDOps
    from ltx_core.loader.sd_ops import LTXV_LORA_COMFY_RENAMING_MAP
    started=time.monotonic();cache.reload()
    if not Path(FOLDER,'ready.json').exists():raise RuntimeError('Existing LTX 2.3 cache not ready; refusing new base-model download.')
    path=hf_hub_download(LORA_REPO,LORA_FILE,revision=LORA_REV)
    with safe_open(path,framework='pt',device='cpu') as f:
        keys=list(f.keys());metadata=f.metadata()
    assert len(keys)>20 and Path(path).stat().st_size>100_000_000
    lora=LoraPathStrengthAndSDOps(path,1.0,LTXV_LORA_COMFY_RENAMING_MAP)
    details={'path':path,'repo':LORA_REPO,'revision':LORA_REV,'keys':len(keys),'metadata':metadata,
             'pipeline_import':ICLoraPipeline.__name__,'lora_path':lora.path,'elapsed_seconds':round(time.monotonic()-started,3)}
    Path(MARKER).write_text(json.dumps(details));cache.commit();return details

@app.function(image=image,gpu='RTX-PRO-6000',cpu=2,memory=131072,timeout=190,min_containers=0,max_containers=1,scaledown_window=2,retries=0,volumes={'/cache':cache})
def generate_pose(payload):
    import json,tempfile,resource
    from pathlib import Path
    import torch
    from PIL import Image
    from ltx_core.loader import LoraPathStrengthAndSDOps
    from ltx_core.loader.sd_ops import LTXV_LORA_COMFY_RENAMING_MAP
    from ltx_core.model.video_vae import AUTO_TILING,get_video_chunks_number
    from ltx_pipelines.ic_lora import ICLoraPipeline
    from ltx_pipelines.utils.model_paths import ModelPaths
    from ltx_pipelines.utils.args import ImageConditioningInput
    from ltx_pipelines.utils.media_io import encode_video
    started=time.monotonic();cache.reload();controlled=payload.get('control',True);metrics={'gpu':'RTX-PRO-6000','control':'LTX 2.3 IC-LoRA Union / pose' if controlled else 'none; same pipeline and input','reference_type':'hand-animated body pose of two people' if controlled else 'none','width':1024,'height':512,'fps':24,'frames':121,'strength':payload['strength'] if controlled else 0}
    try:
        base=json.loads(Path(FOLDER,'ready.json').read_text());info=json.loads(Path(MARKER).read_text())
        assert Path(info['path']).is_file() and 0<=float(payload['strength'])<=1
        assert len(payload['reference'])<8_000_000 and len(payload['pose'])<20_000_000
        metrics.update(gpu_name=torch.cuda.get_device_name(0),gpu_vram_gib=round(torch.cuda.get_device_properties(0).total_memory/1024**3,2))
        torch.cuda.reset_peak_memory_stats()
        with tempfile.TemporaryDirectory() as tmp:
            ref=Path(tmp)/'start.png';ref.write_bytes(payload['reference'])
            with Image.open(ref) as im:im.verify()
            pose=Path(tmp)/'pose.mp4';pose.write_bytes(payload['pose'])
            out=Path(tmp)/'out.mp4'
            lora=LoraPathStrengthAndSDOps(info['path'],1.0,LTXV_LORA_COMFY_RENAMING_MAP)
            pipe=ICLoraPipeline(model_paths=ModelPaths.from_monolith(base['checkpoint'],base['gemma']),spatial_upsampler_path=base['upscaler'],loras=[lora] if controlled else [],device=torch.device('cuda'))
            metrics['initialization_seconds']=round(time.monotonic()-started,2)
            with torch.inference_mode():
                video,audio,tiling=pipe(prompt=payload['prompt'],seed=42,height=512,width=1024,num_frames=121,frame_rate=24.,images=[ImageConditioningInput(str(ref),0,1.,None)],video_conditioning=[(str(pose),float(payload['strength']))] if controlled else [],enhance_prompt=False,tiling_config=AUTO_TILING)
                encode_video(video=video,fps=24.,audio=audio,output_path=str(out),video_chunks_number=get_video_chunks_number(121,tiling))
                torch.cuda.synchronize()
            video_data=out.read_bytes()
        metrics.update(peak_vram_gib=round(torch.cuda.max_memory_allocated()/1024**3,2),peak_cpu_gib=round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss/1024**2,2))
        return {'ok':True,'video':video_data,'elapsed_seconds':round(time.monotonic()-started,3),'metrics':metrics}
    except Exception as e:
        return {'ok':False,'elapsed_seconds':round(time.monotonic()-started,3),'metrics':metrics,'error':f'{type(e).__name__}: {str(e)[:1800]}'}
