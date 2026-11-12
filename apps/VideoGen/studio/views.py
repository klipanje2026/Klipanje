import functools
import json
from collections.abc import Mapping
from decimal import Decimal, InvalidOperation
from PIL import Image, UnidentifiedImageError
from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.http import require_http_methods
from .catalog import catalog, get_model, reserve, allowed_gpus, duration_options
from .models import Budget, BudgetReconciliation, Job
from .services import ACTIVE, STYLE_PROMPTS, budget_summary, serialize, start_demo, submit_modal, poll_modal

def api_errors(view):
    @functools.wraps(view)
    def wrapped(*args, **kwargs):
        try:
            return view(*args, **kwargs)
        except (ValueError, TypeError, InvalidOperation) as exc:
            return JsonResponse({'error': str(exc) or 'Neispravan unos.'}, status=400)
    return wrapped

def ensure_budgets():
    for name in ['tests', 'creative']:
        Budget.objects.get_or_create(name=name, defaults={'limit_usd': 15})

def int_field(data, key, default, low, high):
    raw = data.get(key, default)
    if isinstance(raw, bool):
        raise ValueError(f'Neispravan unos: {key}.')
    value = int(str(raw))
    if not low <= value <= high:
        raise ValueError(f'{key}: dozvoljeno {low}–{high}.')
    return value

def validate(data):
    if not isinstance(data, Mapping):
        raise ValueError('Zahtjev mora sadržavati objekt s postavkama scene.')
    model = get_model(data.get('model_id', 'wan21-1.3b'))
    if not model or not model['enabled']:
        raise ValueError('Model još nije povezan za generisanje.')
    gpu = data.get('gpu', model['gpu'])
    if gpu not in allowed_gpus(model):
        raise ValueError('GPU nije dozvoljen za izabrani model.')
    default_placement = 'native' if model['id'] in ['ltx23-22b','ltx25-dev','ltx25-distilled'] else ('merged-blocks' if gpu=='A10' else 'offload' if gpu=='L40S' else 'resident') if model['id']=='hunyuan15-step' else ('merged-blocks' if gpu=='A10' else 'merged-resident' if gpu=='RTX-PRO-6000' else 'merged') if model['id']=='lightx-wan22' else 'offload'
    placement = data.get('placement', default_placement)
    if placement not in ['offload', 'resident', 'merged','merged-blocks','merged-resident','native'] or (placement=='native' and model['id'] not in ['ltx23-22b','ltx25-dev','ltx25-distilled']) or (placement in ['merged','merged-blocks','merged-resident'] and model['id']!='lightx-wan22' and not (model['id']=='hunyuan15-step' and gpu=='A10' and placement=='merged-blocks')) or (placement == 'resident' and not ((model['id'] == 'wan22-5b' and gpu in ['L40S', 'A100-80GB', 'RTX-PRO-6000', 'B200']) or (model['id'] == 'ltx-2b' and gpu == 'L40S') or model['id']=='hunyuan15-step')):
        raise ValueError('Resident profil je dostupan za Wan na L40S/A100 i za LTX na L40S.')
    if model['id'] in ['ltx23-22b','ltx25-dev','ltx25-distilled'] and placement!='native':
        raise ValueError('LTX-2.3 koristi fiksni native profil.')
    if model['id']=='lightx-wan22' and ((gpu=='A10' and placement!='merged-blocks') or
            (gpu=='A100-40GB' and placement!='merged') or (gpu=='RTX-PRO-6000' and placement!='merged-resident') or (placement=='merged-resident' and gpu!='RTX-PRO-6000') or (placement=='merged-blocks' and gpu!='A10')):
        raise ValueError('A10 koristi pripremljen model po blokovima; A100 40 koristi pripremljen model.')
    if model['id']=='hunyuan15-step' and not ((gpu in ['A100-80GB','RTX-PRO-6000'] and placement=='resident') or
            (gpu=='B200' and placement=='resident' and int_field(data,'steps',model['steps'],1,50)==8) or
            (gpu in ['L40S','A10'] and placement==('merged-blocks' if gpu=='A10' else 'offload') and int_field(data,'steps',model['steps'],1,50)==8)):
        raise ValueError('Hunyuan na A10/L40S koristi 8 koraka i CPU/GPU profil; A100/RTX koristi sve u GPU memoriji.')
    if model['id'] in ['hunyuan15-step','lightx-wan22','ltx23-22b','ltx25-dev','ltx25-distilled']:
        if int_field(data,'steps',model['steps'],1,50) not in model['step_options']:
            raise ValueError('Koristi propisani distilled broj koraka.')
        durations=duration_options(model)
        if int_field(data,'duration',5,min(durations),max(durations)) not in durations:
            raise ValueError('Nepodržano trajanje za izabrani profil.')
    if int_field(data,'duration',5,min(duration_options(model)),max(duration_options(model))) not in duration_options(model):
        raise ValueError('Nepodržano trajanje za izabrani model.')
    prompt = str(data.get('prompt', '')).strip()
    if not 10 <= len(prompt) <= 4000:
        raise ValueError('Opis scene treba sadržavati 10–4000 znakova.')
    mode = data.get('mode', 'demo')
    if mode not in ['demo', 'modal']:
        raise ValueError('Nepoznat način rada.')
    aspect = data.get('aspect', '16:9')
    if aspect not in ['16:9', '9:16', '1:1']:
        raise ValueError('Nepodržan format.')
    render_profile=data.get('render_profile','standard')
    if render_profile not in ['standard','detail','ultra'] or (render_profile in ['detail','ultra'] and
            (model['id']!='ltx23-22b' or gpu not in ['RTX-PRO-6000','B200'] or aspect!='9:16' or int_field(data,'duration',5,2,10)!=5)):
        raise ValueError('Detaljniji profil traži LTX-2.3, RTX/B200, 5 sekundi i portretni kadar.')
    runtime_budget=data.get('runtime_budget','')
    if runtime_budget not in ['', 'dollar-v1', 'evening-v1'] or (runtime_budget and
            (model['id'] not in ['ltx23-22b','hunyuan15-step'] or gpu!='RTX-PRO-6000' or
             int_field(data,'duration',5,2,10)!=5 or render_profile!='standard')):
        raise ValueError('Ograničena testna runda traži standardni RTX profil od 5 sekundi.')
    style = data.get('style', '3d')
    if style not in STYLE_PROMPTS:
        raise ValueError('Nepoznat stil.')
    budget_name = data.get('budget', 'tests')
    if budget_name not in ['tests', 'creative']:
        raise ValueError('Nepoznat budžet.')
    negative = str(data.get('negative_prompt', ''))
    if len(negative) > 2000:
        raise ValueError('Negativni opis je predug.')
    return dict(model_id=model['id'], gpu=gpu, placement=placement, prompt=prompt, title=str(data.get('title', '')).strip()[:120] or prompt[:70], mode=mode, aspect=aspect, style=style,
                runtime_budget=runtime_budget,render_profile=render_profile,duration=int_field(data, 'duration', 5, min(duration_options(model)), max(duration_options(model))), seed=int_field(data, 'seed', 42, 0, 2147483647),
                steps=int_field(data, 'steps', model['steps'], model.get('min_steps',8 if model['id']=='ltx-2b' else 10), model.get('max_steps',8 if model['id']=='ltx-2b' else 50)), negative_prompt=negative), model, budget_name

@require_http_methods(['GET'])
def bootstrap(request):
    ensure_budgets()
    return JsonResponse({'csrf_token': get_token(request), 'models': catalog(), 'budgets': [budget_summary(b) for b in Budget.objects.all()], 'paid_enabled': settings.VIDEOGEN_ALLOW_PAID, 'pricing_date': '2026-10-26', 'jobs': [serialize(j) for j in Job.objects.select_related('budget').filter(Q(pk__in=Job.objects.values('pk')[:100]) | Q(in_gallery=True))]})

@require_http_methods(['POST'])
@api_errors
def estimate(request):
    values, model, budget = validate(json.loads(request.body))
    return JsonResponse({'reservation': float(reserve(model, values['gpu'])) if values['mode'] == 'modal' else 0, 'budget': budget, 'note': 'Rezervacija je konzervativni obračun za najviše 15 min rada + rezerva za pokretanje; nije cijena po videu. Pohrana i odstupanja računa nisu uključeni.'})

@require_http_methods(['GET', 'POST'])
@api_errors
def jobs(request):
    if request.method == 'GET':
        return JsonResponse({'jobs': [serialize(j) for j in Job.objects.select_related('budget').filter(Q(pk__in=Job.objects.values('pk')[:100]) | Q(in_gallery=True))]})
    data = request.POST if request.content_type.startswith('multipart/') else json.loads(request.body)
    values, model, budget_name = validate(data)
    if values['mode'] == 'modal' and not settings.VIDEOGEN_ALLOW_PAID:
        return JsonResponse({'error': 'Plaćeni način je isključen. Prvo poveži i provjeri Modal worker.'}, status=403)
    reference = request.FILES.get('reference')
    end_reference = request.FILES.get('end_reference')
    if end_reference and (model['id'] not in ['ltx-2b','ltx23-22b','ltx25-dev','ltx25-distilled'] or not reference):
        raise ValueError('Završna slika traži LTX i početnu sliku.')
    for reference_image in [reference, end_reference]:
        if not reference_image:
            continue
        if not model['image']:
            raise ValueError('Za početnu sliku izaberi Wan 2.2 ili LTX 2B.')
        if reference_image.size > 8 * 1024 * 1024:
            raise ValueError('Slika može imati najviše 8 MB.')
        try:
            with Image.open(reference_image) as image:
                if image.format not in ['PNG', 'JPEG', 'WEBP'] or image.width * image.height > 25_000_000:
                    raise ValueError('Koristi PNG, JPEG ili WebP sliku do 25 megapiksela.')
                image.verify()
        except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
            raise ValueError('Datoteka nije ispravna slika.')
        reference_image.seek(0)
    if model['id'] in ['ltx-2b','hunyuan15-step','lightx-wan22','ltx23-22b','ltx25-dev','ltx25-distilled'] and not reference:
        raise ValueError('Izabrani image-to-video profil traži početnu sliku.')
    ensure_budgets()
    with transaction.atomic():
        budget = Budget.objects.get(name=budget_name)
        if Job.objects.filter(status__in=ACTIVE).exists():
            return JsonResponse({'error': 'Jedan posao već traje. Sačekaj završetak ili provjeri aktivni posao.'}, status=409)
        reservation = reserve(model, values['gpu']) if values['mode'] == 'modal' else Decimal(0)
        if Decimal(str(budget_summary(budget)['remaining'])) < reservation:
            return JsonResponse({'error': 'Nema dovoljno slobodnog budžeta za rezervaciju. Uskladi završene poslove s Modal računom.'}, status=409)
        render_profile=values.pop('render_profile')
        runtime_budget=values.pop('runtime_budget')
        job = Job.objects.create(**values, metrics={'requested_render_profile':render_profile,'runtime_budget':runtime_budget},budget=budget, reserved_usd=reservation, reference=reference or '', end_reference=end_reference or '', status='submitting' if values['mode'] == 'modal' else 'queued')
    if job.mode == 'demo':
        start_demo(job)
    else:
        submit_modal(job)
        job.refresh_from_db()
    return JsonResponse(serialize(job), status=201)

@require_http_methods(['GET', 'PATCH'])
@api_errors
def job_detail(request, job_id):
    job = get_object_or_404(Job.objects.select_related('budget'), pk=job_id)
    if request.method == 'GET':
        if job.mode == 'modal':
            job = poll_modal(job)
        return JsonResponse(serialize(job))
    data = json.loads(request.body)
    if isinstance(data, dict) and set(data) == {'in_gallery'}:
        if type(data['in_gallery']) is not bool:
            raise ValueError('Neispravan izbor galerije.')
        from .video_processing import gallery_file
        if data['in_gallery'] and (job.status != 'completed' or not gallery_file(job)):
            raise ValueError('Sačekaj da video bude obrađen i dostupan prije dodavanja u galeriju.')
        job.in_gallery = data['in_gallery']
        job.save(update_fields=['in_gallery'])
        return JsonResponse(serialize(job))
    if job.status in ACTIVE or job.mode != 'modal':
        raise ValueError('Račun se usklađuje samo za završene Modal poslove.')
    if job.reconciliation_id:
        raise ValueError('Ovaj pokušaj već je obuhvaćen ukupnim usklađivanjem budžeta.')
    data = json.loads(request.body)
    if not isinstance(data, dict):
        raise ValueError('Neispravan unos računa.')
    amount = Decimal(str(data.get('billed_usd', 'NaN')))
    if not amount.is_finite() or not 0 <= amount <= 1000:
        raise ValueError('Unesi ispravan iznos s Modal računa.')
    job.billed_usd = amount.quantize(Decimal('.0001'))
    job.cost_note = 'Trošak ručno unesen s Modal računa; nije automatski potvrđen.'
    job.save(update_fields=['billed_usd', 'cost_note'])
    return JsonResponse(serialize(job))

@require_http_methods(['POST'])
def cancel_job(request, job_id):
    with transaction.atomic():
        job = get_object_or_404(Job, pk=job_id)
        if job.status not in ACTIVE or job.status == 'cancelling':
            return JsonResponse({'error': 'Posao je već završen ili se zaustavlja.'}, status=409)
        if job.mode == 'modal' and (not job.modal_call_id or job.status == 'submitting'):
            return JsonResponse({'error': 'Slanje je u toku ili njegov ishod nije poznat. Provjeri Modal dashboard prije ponovnog pokušaja.'}, status=409)
        previous_status = job.status
        job.status = 'cancelling'
        job.save(update_fields=['status'])
    if job.mode == 'modal':
        try:
            import modal
            from .modal_accounts import job_client
            client=job_client(job)
            modal.FunctionCall.from_id(job.modal_call_id,**({'client':client} if client else {})).cancel(terminate_containers=True)
        except Exception:
            Job.objects.filter(pk=job_id, status='cancelling').update(status=previous_status)
            return JsonResponse({'error': 'Zaustavljanje nije potvrđeno. Provjeri Modal dashboard; rezervacija ostaje.'}, status=502)
    Job.objects.filter(pk=job_id, status='cancelling').update(status='cancelled', finished_at=timezone.now(), cost_note='Zaustavljeno. Već potrošeni resursi se naplaćuju; rezervacija ostaje do usklađivanja.')
    job.refresh_from_db()
    return JsonResponse(serialize(job))

@require_http_methods(['GET'])
def billing(request):
    ensure_budgets()
    return JsonResponse({'budgets': [budget_summary(b) for b in Budget.objects.all()], 'note': 'Lokalni budžet prati samo poslove poslane kroz VideoGen. Za ukupni limit koristi Modal Usage & Billing. Pohrana se naplaćuje i kada GPU ne radi.', 'pricing_source': 'https://modal.com/pricing'})

@require_http_methods(['POST'])
@api_errors
def reconcile_budget(request):
    data = json.loads(request.body)
    if not isinstance(data, dict) or data.get('budget') not in ['tests', 'creative']:
        raise ValueError('Izaberi budžet za usklađivanje.')
    amount = Decimal(str(data.get('amount_usd', 'NaN')))
    if not amount.is_finite() or not 0 <= amount <= 1000:
        raise ValueError('Unesi ispravan ukupni iznos s Modala.')
    note = str(data.get('note', '')).strip()
    if not 5 <= len(note) <= 250:
        raise ValueError('Navedi izvor i period ukupnog iznosa.')
    with transaction.atomic():
        if Job.objects.filter(mode='modal', status__in=ACTIVE).exists():
            raise ValueError('Sačekaj završetak svih poslova prije ukupnog usklađivanja.')
        budget = get_object_or_404(Budget, name=data['budget'])
        # Provider estimates can be corrected downwards. Keep every checkpoint
        # as an audit trail instead of making a mistaken old total irreversible.
        checkpoint = BudgetReconciliation.objects.create(budget=budget, amount_usd=amount.quantize(Decimal('.0001')), note=note)
        budget.job_set.filter(mode='modal').update(reconciliation=checkpoint)
    return JsonResponse(budget_summary(budget))

@require_http_methods(['GET'])
def connection(request):
    # Credential presence only. Never return token values or silently run a GPU.
    import os
    from pathlib import Path
    return JsonResponse({'paid_enabled': settings.VIDEOGEN_ALLOW_PAID, 'app': settings.VIDEOGEN_MODAL_APP, 'credentials_present': bool(os.getenv('MODAL_TOKEN_ID') and os.getenv('MODAL_TOKEN_SECRET')) or (Path.home()/'.modal.toml').exists(), 'gpu_count': 1, 'worker_deployed': None, 'note': 'Prisutna prijava ne potvrđuje da je worker objavljen. Status se provjerava prije slanja.'})
