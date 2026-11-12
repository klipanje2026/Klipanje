"""Durable local scene queue. Each accepted input is submitted at most once.

All images in a compatible group are composed before GPU work starts. One CPU
preparation is followed by queued GPU inputs on the same single-container pool.
No timers keep idle GPUs alive; no automatic retry of ambiguous submissions.
"""
import hashlib
import json
import logging
import threading
from uuid import UUID
from django.conf import settings
from django.core.files.base import ContentFile
from django.db import close_old_connections, transaction
from django.db.models import Q
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.http import require_http_methods
from .models import GenerationBatch, Job, ScenePlan, Budget
from .services import ACTIVE, check_modal_worker, modal_target, submit_modal, poll_modal
from .views import api_errors, validate, ensure_budgets
from .modal_accounts import ensure_accounts, configured_profiles
from .provider_billing import billing_state
from .scene_planner import compose_reference

logger = logging.getLogger(__name__)
_lock = threading.Lock()
_thread = None
TERMINAL = ['completed', 'failed', 'cancelled']


def batch_data(batch):
    jobs = batch.job_set.all()
    return {'id':str(batch.pk), 'project':str(batch.project_id), 'status':batch.status,
            'error':batch.error, 'cancel_requested':batch.cancel_requested,
            'total':jobs.count(), 'completed':jobs.filter(status='completed').count(),
            'failed':jobs.filter(status='failed').count(), 'cancelled':jobs.filter(status='cancelled').count()}


def response(batch, status=200):
    from .creative_workspace import job_data
    return JsonResponse({'batch':batch_data(batch), 'jobs':[job_data(j) for j in batch.job_set.order_by('batch_order')]}, status=status)


@require_http_methods(['POST'])
@api_errors
def create_batch(request):
    data = json.loads(request.body)
    if not isinstance(data, dict) or not isinstance(data.get('scenes'), list) or not data['scenes']:
        raise ValueError('Dodaj i pripremi barem jednu scenu.')
    request_key = UUID(str(data.get('request_key', '')))
    fingerprint = hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()
    existing = GenerationBatch.objects.filter(request_key=request_key).first()
    if existing:
        if existing.fingerprint != fingerprint:raise ValueError('Ovaj zahtjev već pripada drugom popisu scena.')
        ensure_runner()
        return response(existing)
    if not settings.VIDEOGEN_ALLOW_PAID:return JsonResponse({'error':'Modal generisanje je isključeno.'}, status=403)
    account = ensure_accounts()
    if not account or account.profile not in configured_profiles():raise ValueError('Poveži i odaberi Modal račun.')
    if str(data.get('account')) != str(account.pk):raise ValueError('Odabrani račun je promijenjen. Osvježi sredstva prije slanja.')
    balance = billing_state(account=account)
    if not balance.get('synced') or balance.get('remaining') is None or balance['remaining'] <= 0:
        raise ValueError('Prvo provjeri raspoloživi kredit odabranog računa.')
    validated = []
    for index, item in enumerate(data['scenes']):
        if not isinstance(item, dict):raise ValueError(f'Scena {index+1}: neispravne postavke.')
        plan = get_object_or_404(ScenePlan, pk=item.get('plan'), project_id=data.get('project'))
        values, model, _ = validate({**item, 'prompt':plan.prompt, 'title':item.get('title') or plan.title,
                                    'style':plan.style, 'aspect':plan.aspect, 'duration':plan.duration,
                                    'mode':'modal', 'budget':'creative'})
        if not model['image'] and plan.reference_mode != 'text':raise ValueError(f'Scena {index+1}: model ne podržava slike.')
        if plan.reference_mode == 'draft':raise ValueError(f'Scena {index+1}: dodaj početnu sliku.')
        if plan.end_reference and model['id'] not in ['ltx-2b','ltx23-22b','ltx25-dev','ltx25-distilled']:raise ValueError(f'Scena {index+1}: završni kadar traži LTX model.')
        if plan.reference_mode == 'keyframe' and model['id'] not in ['ltx23-22b', 'ltx25-dev', 'ltx25-distilled']:
            raise ValueError(f'Scena {index+1}: ponovo odaberi ulogu reference za izabrani model.')
        values.pop('render_profile');values.pop('runtime_budget')
        validated.append((plan, values, {'scene_key':str(item.get('scene_key',''))[:80],
            'requested_render_profile':item.get('render_profile','standard'), 'production':True, 'batch_phase':'waiting',
            'image_role':'reference' if plan.reference_mode=='keyframe' else 'start'}))
    with transaction.atomic():
        # SQLite IMMEDIATE transaction also serializes competing scene/batch requests.
        existing = GenerationBatch.objects.filter(request_key=request_key).first()
        if existing:
            if existing.fingerprint != fingerprint:raise ValueError('Zahtjev već postoji s drugim scenama.')
            return response(existing)
        if Job.objects.filter(status__in=ACTIVE).exists():return JsonResponse({'error':'Generisanje već traje. Sačekaj završetak reda.'},status=409)
        ensure_budgets()
        batch = GenerationBatch.objects.create(request_key=request_key, fingerprint=fingerprint,
            project=validated[0][0].project, account=account)
        for index, (plan, values, metrics) in enumerate(validated):
            Job.objects.create(**values, project=plan.project, scene_plan=plan, modal_account=account,
                batch=batch, batch_order=index, status='batch_waiting', reserved_usd=0,
                budget=Budget.objects.get(name='creative'), metrics=metrics)
        transaction.on_commit(ensure_runner)
    return response(batch, 201)


@require_http_methods(['POST'])
def cancel_batch(request, batch_id):
    batch = get_object_or_404(GenerationBatch, pk=batch_id)
    if batch.status not in TERMINAL:
        batch.cancel_requested = True;batch.save(update_fields=['cancel_requested'])
        ensure_runner()
    return response(batch)


def fail(job, message):
    Job.objects.filter(pk=job.pk, status__in=['batch_waiting','submitting']).update(
        status='failed', error=message, finished_at=timezone.now())


def group_key(job):
    return (*modal_target(job, prepared=True), job.placement, bool(job.scene_plan.end_reference), job.model_id)


def step(batch):
    jobs = list(batch.job_set.select_related('scene_plan','modal_account').order_by('batch_order'))
    if batch.cancel_requested:
        # Cancel unstarted inputs before terminating the shared running container.
        for job in reversed(jobs):
            if job.status in TERMINAL:continue
            if job.status == 'batch_waiting':
                Job.objects.filter(pk=job.pk,status='batch_waiting').update(status='cancelled',finished_at=timezone.now())
            elif job.modal_call_id:
                from .views import cancel_job
                result = cancel_job(None, job.pk)
                if result.status_code >= 400:
                    batch.status='attention';batch.error='Zaustavljanje nije potvrđeno. Provjeri Modal račun.'
                    batch.save(update_fields=['status','error']);return
            else:
                batch.status='attention';batch.error='Ishod slanja nije potvrđen. Provjeri Modal prije ponavljanja.'
                batch.save(update_fields=['status','error']);return
        batch.status='cancelled';batch.finished_at=timezone.now();batch.save(update_fields=['status','finished_at']);return
    for job in jobs:
        if job.status == 'running' or (job.status == 'preparing' and batch.status != 'attention'):poll_modal(job)
    if batch.status == 'attention':return
    jobs = list(batch.job_set.select_related('scene_plan','modal_account').order_by('batch_order'))
    if any(j.status == 'submission_unknown' for j in jobs):
        batch.status='attention';batch.error='Jedno slanje nije potvrđeno. Preostale scene nisu ponovo poslane.'
        batch.save(update_fields=['status','error']);return
    if all(j.status in TERMINAL for j in jobs):
        batch.status='completed';batch.finished_at=timezone.now();batch.save(update_fields=['status','finished_at']);return
    groups = {}
    for job in jobs:groups.setdefault(group_key(job), []).append(job)
    group = next(g for g in groups.values() if any(j.status not in TERMINAL for j in g))
    if any(j.status == 'preparing' for j in group):return
    ready = any(j.metrics.get('batch_prepared') for j in group)
    if not ready and any(j.status in ['submitting','running'] for j in group):return
    if not ready and any(j.status == 'failed' for j in group):
        for job in group:
            if job.status == 'batch_waiting':fail(job, 'Priprema ove grupe nije završena. Ostale grupe se nastavljaju.')
        return
    if ready:
        # Queue all compatible inputs before the first finishes: no browser latency
        # or image composition between inputs, max_containers remains one.
        for job in group:
            if job.status != 'batch_waiting':continue
            if GenerationBatch.objects.get(pk=batch.pk).cancel_requested:return
            Job.objects.filter(pk=job.pk,status='batch_waiting').update(status='submitting')
            job.status='submitting';submit_modal(job, prepared=True);job.refresh_from_db()
            if job.status == 'submission_unknown':return
        batch.status='running';batch.save(update_fields=['status']);return
    waiting = [j for j in group if j.status == 'batch_waiting']
    if not waiting:return
    check_modal_worker(waiting[0])
    batch.status='preparing';batch.save(update_fields=['status'])
    for job in waiting:
        if GenerationBatch.objects.get(pk=batch.pk).cancel_requested:return
        job.status='submitting';job.metrics={**job.metrics,'batch_phase':'composition'}
        job.save(update_fields=['status','metrics'])
        try:
            from .catalog import get_model
            if get_model(job.model_id)['image']:
                compose_reference(job.scene_plan)
                with job.scene_plan.reference.open('rb') as file:job.reference.save('scene.png',ContentFile(file.read()),save=True)
                if job.scene_plan.end_reference:
                    with job.scene_plan.end_reference.open('rb') as file:job.end_reference.save('end.png',ContentFile(file.read()),save=True)
            job.status='batch_waiting';job.metrics={**job.metrics,'batch_phase':'ready'}
            job.save(update_fields=['status','metrics'])
        except Exception as exc:
            fail(job, str(exc) if isinstance(exc,ValueError) else 'Priprema slike nije završena; video nije pokrenut.')
    leader = batch.job_set.filter(pk__in=[j.pk for j in waiting],status='batch_waiting').order_by('batch_order').first()
    if leader and not GenerationBatch.objects.get(pk=batch.pk).cancel_requested:
        leader.status='submitting';leader.metrics={**leader.metrics,'batch_phase':'preparation'}
        leader.save(update_fields=['status','metrics']);submit_modal(leader)


def _run():
    close_old_connections()
    try:
        # A process restart must not retry any interrupted submission/composition.
        for job in Job.objects.filter(batch__isnull=False,status='submitting'):
            if job.metrics.get('batch_phase') == 'composition':
                fail(job,'Priprema slike prekinuta je restartom. Nije automatski ponovljena.')
            else:
                job.status='submission_unknown';job.error='Slanje prekinuto restartom; provjeri Modal prije ponavljanja.'
                job.save(update_fields=['status','error'])
        while True:
            batch = GenerationBatch.objects.exclude(status__in=TERMINAL+['attention']).order_by('created_at').first()
            if not batch:
                batch=GenerationBatch.objects.filter(status='attention').filter(Q(cancel_requested=True)|Q(job__status='running')).distinct().first()
                if not batch:return
            try:step(batch)
            except Exception:
                logger.exception('Scene queue needs attention')
                batch.status='attention';batch.error='Red je pauziran zbog greške. Već poslane scene nisu ponovljene.'
                batch.save(update_fields=['status','error'])
            close_old_connections()
            threading.Event().wait(1)
    finally:close_old_connections()


def ensure_runner():
    global _thread
    with _lock:
        if _thread and _thread.is_alive():return
        if not GenerationBatch.objects.exclude(status__in=TERMINAL+['attention']).exists() and not GenerationBatch.objects.filter(status='attention').filter(Q(cancel_requested=True)|Q(job__status='running')).exists():return
        _thread=threading.Thread(target=_run,daemon=True,name='videogen-scenes');_thread.start()
