import io
import logging
import math
import threading
import time
from decimal import Decimal
from pathlib import Path
from django.conf import settings
from django.core.files.base import ContentFile
from django.db import close_old_connections, transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from .catalog import get_model
from .resource_costs import set_resource_cost
from .models import Job

logger = logging.getLogger(__name__)
ACTIVE = ['queued', 'batch_waiting', 'preparing', 'running', 'submitting', 'submission_unknown', 'cancelling']
GPU_QUEUE_WAIT_SECONDS = 600
STYLE_PROMPTS = {
    '3d': 'Stylized 3D animated film, expressive cartoon character, soft cinematic lighting, rounded shapes, cohesive character design. ',
    'anime': 'Hand-drawn anime animation, clean linework, cel shading, expressive character acting, consistent character design. ',
    'storybook': 'Animated storybook illustration, painterly textures, whimsical character, warm soft colors, consistent design. ',
    'realistic': 'Photorealistic live-action footage, natural adult proportions, realistic skin and fabric texture, physically plausible lighting, consistent identity. ',
    'clay': 'Claymation animation, handmade clay character, tactile miniature set, soft studio lighting. ',
}

def budget_summary(budget):
    checkpoint = budget.budgetreconciliation_set.order_by('-created_at', '-id').first()
    confirmed = checkpoint.amount_usd if checkpoint else Decimal('0')
    held = Decimal('0')
    estimated = Decimal('0')
    for job in budget.job_set.filter(mode='modal', reconciliation__isnull=True):
        if job.billed_usd is not None:
            confirmed += job.billed_usd
        elif job.status == 'completed' and job.elapsed_seconds > 0 and job.estimated_usd > 0:
            estimated += job.estimated_usd
        else:
            held += max(job.reserved_usd, job.estimated_usd)
    return {'id': budget.name, 'limit': float(budget.limit_usd), 'confirmed': float(confirmed), 'held': float(held),
            'estimated': float(estimated), 'remaining': float(budget.limit_usd - confirmed - held - estimated),
            'reconciled_at': checkpoint.created_at.isoformat() if checkpoint else None,
            'reconciliation_note': checkpoint.note if checkpoint else ''}

def serialize(job):
    from .video_processing import media_data
    return {
        **media_data(job),
        'id': str(job.id), 'title': job.title, 'prompt': job.prompt, 'negative_prompt': job.negative_prompt,
        'model_id': job.model_id, 'mode': job.mode, 'style': job.style, 'budget': job.budget.name,
        'gpu': job.gpu or get_model(job.model_id)['gpu'], 'placement': job.placement, 'metrics': job.metrics,
        'duration': job.duration, 'aspect': job.aspect, 'seed': job.seed, 'steps': job.steps,
        'render_profile': job.metrics.get('requested_render_profile','standard'),
        'status': job.status, 'in_gallery': job.in_gallery,
        'reference_url': job.reference.url if job.reference else None,
        'end_reference_url': job.end_reference.url if job.end_reference else None,
        'reserved_usd': float(job.reserved_usd), 'estimated_usd': float(job.estimated_usd),
        'billed_usd': float(job.billed_usd) if job.billed_usd is not None else None,
        'reconciliation_id': job.reconciliation_id,
        'cost_note': job.cost_note, 'error': job.error, 'elapsed_seconds': round(job.elapsed_seconds, 1),
        'preparation_seconds': round(job.preparation_seconds, 1),
        'created_at': job.created_at.isoformat(), 'finished_at': job.finished_at.isoformat() if job.finished_at else None,
    }

def render_demo(job_id):
    """A deliberately labelled local animation; never presented as model output."""
    close_old_connections()
    started = time.monotonic()
    try:
        import imageio.v2 as imageio
        import numpy as np
        from PIL import Image, ImageDraw, ImageOps
        job = Job.objects.get(pk=job_id)
        if job.status == 'cancelled':
            return
        if not Job.objects.filter(pk=job_id, status='queued').update(status='running'):
            return
        width, height = (480, 832) if job.aspect == '9:16' else (640, 640) if job.aspect == '1:1' else (832, 480)
        output = Path(settings.MEDIA_ROOT) / 'videos' / f'{job.id}.mp4'
        output.parent.mkdir(parents=True, exist_ok=True)
        reference = Image.open(job.reference.path).convert('RGB') if job.reference else None
        with imageio.get_writer(str(output), fps=16, codec='libx264', quality=7, macro_block_size=1, ffmpeg_log_level='error') as writer:
            for frame in range(job.duration * 16):
                t = frame / 16
                canvas = Image.new('RGB', (width, height), '#102f38')
                draw = ImageDraw.Draw(canvas)
                if reference:
                    image = ImageOps.fit(reference, (width + 40, height + 40))
                    canvas.paste(image, (-int(20 + math.sin(t) * 15), -20))
                else:
                    for y in range(height):
                        k = y / height
                        draw.line((0, y, width, y), fill=(int(13 + 25*k), int(35 + 55*k), int(47 + 38*k)))
                    draw.ellipse((width*.68, height*.1, width*.68+65, height*.1+65), fill='#f2d8a5')
                    for i in range(24):
                        x = (i*137 + job.seed*3) % width
                        y = (i*41) % int(height*.48)
                        r = 1 + .7*math.sin(t*2+i)
                        draw.ellipse((x-r,y-r,x+r,y+r), fill='#badba9')
                    draw.polygon([(0,height*.7),(width*.25,height*.3),(width*.52,height*.68),(width*.8,height*.33),(width,height*.7),(width,height),(0,height)], fill='#204f53')
                    draw.polygon([(0,height*.83),(width*.3,height*.65),(width*.7,height*.8),(width,height*.6),(width,height),(0,height)], fill='#173f3b')
                    x, y = width*.48 + math.sin(t*.7)*25, height*.62 + math.sin(t*2)*7
                    draw.ellipse((x-47,y+67,x+48,y+82), fill='#112d2a')
                    draw.rounded_rectangle((x-29,y+20,x-9,y+70), radius=8, fill='#e07f4d')
                    draw.rounded_rectangle((x+9,y+20,x+29,y+70), radius=8, fill='#e07f4d')
                    draw.rounded_rectangle((x-42,y-12,x+42,y+43), radius=22, fill='#f7a26a')
                    draw.rounded_rectangle((x-50,y-75,x+50,y-3), radius=27, fill='#f5bd87')
                    draw.rounded_rectangle((x-39,y-62,x+39,y-20), radius=18, fill='#183936')
                    blink = frame % 65 > 61
                    for eye in [-16,16]:
                        draw.ellipse((x+eye-4,y-48,x+eye+4,y-46 if blink else y-35), fill='#c6f66b')
                    draw.line((x,y-75,x,y-92), fill='#f5bd87', width=4)
                    draw.ellipse((x-6,y-100,x+6,y-88), fill='#c6f66b')
                    for i in range(11):
                        fx = (i*91+math.sin(t+i)*9) % width
                        fy = height*.55+(i*37)%int(height*.35)
                        draw.ellipse((fx,fy,fx+3,fy+3),fill='#d0ed8e')
                draw = ImageDraw.Draw(canvas)
                draw.rectangle((0,height-30,width,height), fill='#111818')
                draw.text((12,height-22), 'VIDEOGEN / LOCAL DEMO - NOT AI GENERATED / $0.00', fill='#c6f66b')
                writer.append_data(np.asarray(canvas))
        # A cancellation must win over completion; the file is harmless local output.
        Job.objects.filter(pk=job_id).exclude(status='cancelled').update(status='completed', video=f'videos/{job.id}.mp4', elapsed_seconds=time.monotonic()-started, finished_at=timezone.now(), cost_note='Lokalna tehnička animacija. Nije AI rezultat. Modal trošak: 0 $.')
    except Exception:
        logger.exception('Local demo failed')
        Job.objects.filter(pk=job_id).exclude(status='cancelled').update(status='failed', error='Lokalni demo nije uspio. Detalji su u server logu.', finished_at=timezone.now())
    finally:
        close_old_connections()

def start_demo(job):
    threading.Thread(target=render_demo, args=(job.id,), daemon=True).start()

def modal_target(job,prepared=False):
    gpu = job.gpu or get_model(job.model_id)['gpu']
    gpu_functions = {'L4': 'generate_economy', 'A10': 'generate_balanced_a10', 'L40S': 'generate_balanced', 'A100-80GB': 'generate_balanced_a100', 'RTX-PRO-6000':'generate_balanced_rtx', 'B200':'generate_balanced_b200'}
    function_name = ({'L40S':'generate_ltx_l40s','L4':'generate_ltx_l4','A10':'generate_ltx_a10'}[gpu] if prepared else 'prepare_ltx') if job.model_id=='ltx-2b' else gpu_functions.get(gpu,'') if prepared else 'prepare_model'
    worker_app=settings.VIDEOGEN_MODAL_APP
    if job.model_id in ['ltx25-dev','ltx25-distilled']:
        if gpu != 'RTX-PRO-6000':raise ValueError('LTX-2.5 koristi samo RTX PRO 6000.')
        worker_app='videogen-ltx25'
        function_name='generate_ltx25_rtx' if prepared else 'prepare_ltx25'
    if job.model_id=='ltx23-22b':
        worker_app='videogen-realism'
        function_name=({'H100-SXM5':'generate_ltx23_h100','RTX-PRO-6000':'generate_ltx23_rtx','B200':'generate_ltx23_b200'}[gpu] if prepared else 'prepare_ltx23')
    if job.model_id in ['hunyuan15-step','lightx-wan22']:
        worker_app='videogen-lab'
        function_name=({'hunyuan15-step':'generate_hunyuan','lightx-wan22':'generate_lightx'}[job.model_id] if prepared else 'prepare_lab')
        if job.model_id=='lightx-wan22' and job.placement in ['merged','merged-blocks','merged-resident']:
            function_name=({'L40S':'generate_lightx_merged','A10':'generate_lightx_a10','A100-40GB':'generate_lightx_a10040','RTX-PRO-6000':'generate_lightx_rtx'}[gpu] if prepared else 'prepare_light_merged')
        if job.model_id=='hunyuan15-step' and prepared:
            function_name={'L40S':'generate_hunyuan_l40s','A10':'generate_hunyuan_a10','RTX-PRO-6000':'generate_hunyuan_rtx','B200':'generate_hunyuan_b200'}.get(gpu,'generate_hunyuan8' if job.steps==8 else 'generate_hunyuan')
    return worker_app,function_name


def check_modal_worker(job):
    import modal
    from .modal_accounts import job_client
    try:
        client=job_client(job)
        for prepared in [False,True]:
            app,name=modal_target(job,prepared)
            modal.Function.from_name(app,name,**({'client':client} if client else {})).hydrate()
    except ValueError:raise
    except modal.exception.AuthError:
        from .modal_accounts import AUTH_MESSAGE
        raise ValueError(AUTH_MESSAGE) from None
    except Exception:
        raise ValueError('Odabrani Modal račun nema dostupan worker za ovaj model. Postavi postojeći VideoGen worker na tom računu prije generisanja.') from None


def submit_modal(job, prepared=False):
    """Only called after a reservation was committed. Never auto-retry a spawn."""
    import modal
    worker_app,function_name=modal_target(job,prepared)
    gpu=job.gpu or get_model(job.model_id)['gpu']
    reference = None
    if job.reference:
        with job.reference.open('rb') as file:
            reference = file.read()
    end_reference = None
    if job.end_reference:
        with job.end_reference.open('rb') as file:
            end_reference = file.read()
    payload = {'model_id': job.model_id, 'prompt': STYLE_PROMPTS[job.style] + job.prompt,
               'negative_prompt': job.negative_prompt, 'seconds': job.duration, 'aspect': job.aspect,
               'seed': job.seed, 'steps': job.steps, 'reference': reference, 'end_reference': end_reference, 'gpu': gpu, 'placement': job.placement,
               'render_profile':job.metrics.get('requested_render_profile','standard'),
               'image_role':job.metrics.get('image_role','start')}
    if not prepared:
        payload = {'model_id': job.model_id, 'endpoints': bool(end_reference)}
        if job.metrics.get('runtime_budget') in ['dollar-v1','evening-v1']:payload['cached_only']=True
    try:
        from .modal_accounts import job_client
        client=job_client(job)
        function = modal.Function.from_name(worker_app, function_name,**({'client':client} if client else {}))
        function.hydrate()  # A missing deployment fails before a paid invocation exists.
        if job.metrics.get('runtime_budget') in ['dollar-v1','evening-v1']:
            gpu_limit = (480 if job.model_id=='hunyuan15-step' else 180) if job.metrics['runtime_budget']=='evening-v1' else (210 if job.model_id=='hunyuan15-step' else 140)
            limit=gpu_limit if prepared else 25
            function=function.with_options(timeout=limit,retries=0,scaledown_window=2,max_containers=1)
    except Exception as exc:
        Job.objects.filter(pk=job.id).update(status='failed', reserved_usd=job.reserved_usd if prepared else 0, error='Modal worker nije dostupan. Provjeri prijavu i deployment.', finished_at=timezone.now())
        logger.warning('Modal lookup failed: %s', type(exc).__name__)
        return
    try:
        call = function.spawn(payload)
        fields = {'modal_call_id':call.object_id, 'status':'running' if prepared else 'preparing'}
        if prepared:
            fields['metrics'] = {**job.metrics, 'gpu_submitted_at':timezone.now().isoformat(), 'gpu_task_assigned':False}
        Job.objects.filter(pk=job.id).update(**fields)
    except Exception:
        # Network failure can occur AFTER acceptance: retain reservation and never retry.
        logger.exception('Modal submission outcome unknown')
        Job.objects.filter(pk=job.id).update(status='submission_unknown', error='Ishod slanja nije potvrđen. Provjeri Modal dashboard prije novog pokušaja; rezervacija ostaje.')

def stop_expired_gpu_queue(job, call):
    """Only cancel a proven unassigned input, never a long-running GPU task."""
    if job.batch_id or job.status != 'running' or job.metrics.get('gpu_task_assigned'):
        return job
    submitted = job.metrics.get('gpu_submitted_at')
    if not submitted:
        return job
    try:
        submitted = parse_datetime(submitted)
        waited = (timezone.now() - submitted).total_seconds()
    except (TypeError, ValueError):
        return job
    if waited < GPU_QUEUE_WAIT_SECONDS:
        return job
    try:
        graph = call.get_call_graph()
    except Exception:
        logger.warning('Unable to verify GPU assignment; keeping the reservation.')
        return job
    if not graph:
        return job  # Missing telemetry is not proof that a task is unassigned.
    if any(item.task_id for item in graph):
        metrics={**job.metrics,'gpu_task_assigned':True}
        Job.objects.filter(pk=job.pk,status='running',modal_call_id=job.modal_call_id).update(metrics=metrics)
        job.refresh_from_db()
        return job
    with transaction.atomic():
        current=Job.objects.select_for_update().get(pk=job.pk)
        if current.status!='running' or current.modal_call_id!=job.modal_call_id:
            return current
        current.status='cancelling'
        current.metrics={**current.metrics,'gpu_queue_seconds':round(waited,1),'gpu_queue_timeout':True,
                         'gpu_task_assigned':False}
        current.save(update_fields=['status','metrics'])
    try:
        call.cancel(terminate_containers=True)
    except Exception:
        Job.objects.filter(pk=job.pk,status='cancelling').update(error='Prekid čekanja nije potvrđen. Rezervacija ostaje; provjeri Modal prije drugog zahtjeva.')
        current.refresh_from_db()
        return current
    Job.objects.filter(pk=job.pk,status='cancelling',modal_call_id=job.modal_call_id).update(
        status='cancelled',finished_at=timezone.now(),error='Pri provjeri nakon 10 minuta kartica još nije bila dodijeljena. Zahtjev je prekinut; izaberi drugu karticu.',
        cost_note='Prekid čekanja potvrđen. CPU priprema može biti naplaćena; rezervacija ostaje do usklađivanja ukupnog računa.')
    current.refresh_from_db()
    return current


def poll_modal(job):
    if not job.modal_call_id or job.status not in ACTIVE or job.status == 'cancelling':
        return job
    import modal
    try:
        from .modal_accounts import job_client
        client=job_client(job)
        call = modal.FunctionCall.from_id(job.modal_call_id,**({'client':client} if client else {}))
        result = call.get(timeout=0)
    except (modal.exception.FunctionTimeoutError, modal.exception.RemoteError, modal.exception.ExecutionError) as exc:
        Job.objects.filter(pk=job.pk, status__in=ACTIVE).update(status='failed', error=f'GPU posao je završen greškom ({type(exc).__name__}). Provjeri Modal logove i račun.', finished_at=timezone.now())
        job.refresh_from_db()
        return job
    except (TimeoutError, modal.exception.TimeoutError):
        return stop_expired_gpu_queue(job, call)
    except Exception:
        logger.exception('Modal job failed or polling unavailable')
        # A transport failure is not proof the GPU job has ended.
        return job
    if job.status == 'preparing' and result.get('ok'):
        with transaction.atomic():
            current = Job.objects.get(pk=job.pk)
            if current.status != 'preparing' or current.modal_call_id != job.modal_call_id:
                return current
            current.status = 'submitting'
            current.modal_call_id = ''
            current.preparation_seconds = float(result.get('elapsed_seconds', 0))
            if current.batch_id:
                current.metrics = {**current.metrics, 'batch_prepared': True}
            current.save(update_fields=['status', 'modal_call_id', 'preparation_seconds', 'metrics'])
        submit_modal(current, prepared=True)
        current.refresh_from_db()
        return current
    with transaction.atomic():
        current = Job.objects.get(pk=job.pk)
        if current.status not in ACTIVE or current.status == 'cancelling' or current.modal_call_id != job.modal_call_id:
            return current
        if not result.get('ok'):
            current.status = 'failed'
            current.error = result.get('error', 'GPU generisanje nije uspjelo.')[:2000]
        else:
            content = result.get('video', b'')
            if not isinstance(content, bytes) or not content or len(content) > 80 * 1024 * 1024:
                current.status = 'failed'
                current.error = 'Worker nije vratio ispravan video.'
            else:
                current.video.save(f'{current.id}.mp4', ContentFile(content), save=False)
                current.status = 'completed'
                current.processing_status = 'pending'
        current.elapsed_seconds = float(result.get('elapsed_seconds', 0))
        current.metrics = {**current.metrics, **result.get('metrics', {})}
        if job.status=='running':current.metrics['gpu_task_assigned']=True
        if job.status == 'preparing':
            current.preparation_seconds = current.elapsed_seconds
            current.elapsed_seconds = 0
        set_resource_cost(current)
        current.finished_at = timezone.now()
        current.save()
        if current.status == 'completed':
            from .video_processing import ensure_runner
            transaction.on_commit(ensure_runner)
        return current
