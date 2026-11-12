import csv
import io
import json
from collections import defaultdict
from decimal import Decimal
from pathlib import Path
from uuid import UUID,uuid5,NAMESPACE_URL
from django.conf import settings
from django.core.files.base import ContentFile
from django.db import transaction
from django.http import JsonResponse, FileResponse, HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.views.decorators.http import require_http_methods
from .models import VideoProject,ScenePlan,Job,Budget
from .services import serialize,ACTIVE,submit_modal,poll_modal,check_modal_worker
from .catalog import catalog,get_model,duration_options
from .views import api_errors,validate,ensure_budgets
from .scene_planner import STYLE_OPTIONS,validate_image,plan_scene,compose_reference,ROOT_ENV
from .provider_billing import billing_state,sync_billing
from .modal_accounts import ensure_accounts,accounts_state,configured_profiles,account_data,start_login,login_state
from .models import ModalAccount,ModalSelection
from .video_processing import gallery_file,ensure_runner as ensure_processing
from .video_names import video_filename


def saved_reference(field):
    with field.open('rb') as file:return ContentFile(file.read(),name=Path(field.name).name)


def plan_data(plan):
    return {
        'id': str(plan.pk), 'title': plan.title, 'description': plan.description,
        'prompt': plan.prompt, 'has_end_frame': bool(plan.end_reference),
        'scene_url': f'/api/creative/plans/{plan.pk}/scene-image/' if plan.scene or plan.reference else None,
        'end_url': f'/api/creative/plans/{plan.pk}/scene-image/?kind=end' if plan.end_reference else None,
        'image_role': 'reference' if plan.reference_mode in ['reference', 'keyframe'] else 'start',
    }


def project_data(p):
    return {'id':str(p.pk),'name':p.name,'description':p.description,'context':p.context,'draft':p.draft,'count':p.job_set.count()}


def job_data(j):
    data=serialize(j);exists=bool(j.video and j.video.storage.exists(j.video.name))
    data.update(project=str(j.project_id) if j.project_id else None,scene_plan=str(j.scene_plan_id) if j.scene_plan_id else None,
        batch=str(j.batch_id) if j.batch_id else None,batch_order=j.batch_order,scene_key=j.metrics.get('scene_key'),
        missing_video=bool(j.status=='completed' and not exists),historical=bool(j.metrics.get('historical')),
        actual_usd=float(j.metrics['provider_billed_usd']) if j.metrics.get('provider_billed_usd') is not None else None,
        resource_cost=j.metrics.get('resource_cost'),
        modal_account=j.modal_account_id,account_label=j.modal_account.label if j.modal_account_id else '',
        manual_usd=float(j.billed_usd) if j.billed_usd is not None else None,
        measured_usd=float(j.metrics.get('archive_cost',j.estimated_usd)) if j.metrics.get('archive_cost') is not None or j.estimated_usd else None)
    return data


def averages():
    groups=defaultdict(list)
    for j in Job.objects.filter(status='completed'):
        value=j.metrics.get('archive_cost') if j.metrics.get('archive_cost_kind')=='measured' else float(j.estimated_usd) if not j.metrics.get('historical') and j.estimated_usd>0 else None
        if value is not None and j.mode=='modal':groups[(j.model_id,j.gpu,j.duration,j.steps,j.metrics.get('requested_render_profile','standard'),j.aspect,j.metrics.get('archive_resolution') or ('%s × %s'%(j.metrics['output_width'],j.metrics['output_height']) if j.metrics.get('output_width') and j.metrics.get('output_height') else get_model(j.model_id)['resolution']))].append(float(value))
    return [{'model_id':k[0],'gpu':k[1],'duration':k[2],'steps':k[3],'render_profile':k[4],'aspect':k[5],'resolution':k[6],'mean_usd':sum(v)/len(v),'min_usd':min(v),'max_usd':max(v),'count':len(v)} for k,v in groups.items()]


@require_http_methods(['GET'])
def bootstrap(request):
    from .batch_queue import ensure_runner,batch_data
    from .models import GenerationBatch
    ensure_runner()
    ensure_processing()
    account=ensure_accounts();state=accounts_state()
    return JsonResponse({'csrf_token':__import__('django.middleware.csrf',fromlist=['get_token']).get_token(request),'projects':[project_data(p) for p in VideoProject.objects.all().order_by('-created_at')],
      'jobs':[job_data(j) for j in Job.objects.select_related('budget').all()], 'models':catalog(),'styles':STYLE_OPTIONS,'averages':averages(),
      'batches':[batch_data(b) for b in GenerationBatch.objects.order_by('-created_at')[:20]],
      'billing':billing_state(account=account),**state,'paid_enabled':settings.VIDEOGEN_ALLOW_PAID,'openai_configured':bool(ROOT_ENV.get('OPENAI_API_KEY'))})


@require_http_methods(['POST'])
@api_errors
def projects(request):
    data=json.loads(request.body);name=str(data.get('name','')).strip()
    if not name or len(name)>160:raise ValueError('Unesi naziv projekta do 160 znakova.')
    project=VideoProject.objects.create(name=name,description=str(data.get('description',''))[:5000])
    return JsonResponse(project_data(project),status=201)


@require_http_methods(['PATCH'])
@api_errors
def project_detail(request,project_id):
    project=get_object_or_404(VideoProject,pk=project_id);data=json.loads(request.body)
    for key in ['draft','context']:
        if key in data:
            if not isinstance(data[key],dict) or len(json.dumps(data[key]))>(8_000_000 if key=='draft' else 120000):raise ValueError('Kontekst projekta je prevelik.')
            setattr(project,key,data[key])
    project.save(update_fields=['draft','context'])
    return JsonResponse(project_data(project))


@require_http_methods(['POST'])
@api_errors
def prepare(request):
    p=get_object_or_404(VideoProject,pk=request.POST.get('project'));direction=request.POST.get('direction','').strip();style=request.POST.get('style','cartoon3d');aspect=request.POST.get('aspect','16:9');mode=request.POST.get('reference_mode','text')
    if not 5<=len(direction)<=12000:raise ValueError('Opiši scenu u 5–12000 znakova.')
    if style not in dict(STYLE_OPTIONS) or aspect not in ['1:1','9:16','16:9'] or mode not in ['text','character','scene','combined','separate']:raise ValueError('Neispravne postavke scene.')
    duration=int(request.POST.get('duration',5))
    selected_model=get_model(request.POST.get('model_id','wan21-1.3b'))
    if not selected_model or duration not in duration_options(selected_model):raise ValueError('Odaberi podržano trajanje.')
    previous=ScenePlan.objects.filter(pk=request.POST.get('previous_plan') or None,project=p).first()
    character=request.FILES.get('character') if mode in ['character','separate'] else None
    scene=request.FILES.get('scene') if mode in ['scene','combined','separate'] else None
    end_enabled=request.POST.get('end_enabled','0')=='1'
    if end_enabled and request.POST.get('model_id') not in ['ltx-2b','ltx23-22b','ltx25-dev','ltx25-distilled']:raise ValueError('Početni i završni kadar podržani su za LTX-Video i LTX-2.3.')
    ending=request.FILES.get('end_reference') if end_enabled else None
    if end_enabled and not ending and previous and previous.end_reference:ending=saved_reference(previous.end_reference)
    if end_enabled and not ending:raise ValueError('Dodaj završni kadar ili isključi opciju završnog kadra.')
    if previous and mode==previous.reference_mode:
        if not character and previous.character:character=saved_reference(previous.character)
        if not scene and previous.scene:scene=saved_reference(previous.scene)
    if mode in ['character','separate'] and not character:raise ValueError('Dodaj referencu lika.')
    if mode in ['scene','combined','separate'] and not scene:raise ValueError('Dodaj referencu scene.')
    for f in [character,scene,ending]:validate_image(f)
    result=plan_scene(direction,p,[('CHARACTER: identity and appearance only',character),('START / COMBINED: entire starting frame' if mode=='combined' else 'SCENE: starting environment and composition',scene),('END FRAME: desired final pose, action state and composition; plan a continuous transition from the starting frame',ending)],style,aspect,duration)
    plan=ScenePlan.objects.create(project=p,direction=direction,description=result['description'],prompt=result['prompt'],title=(request.POST.get('title','').strip() or result['title'])[:120],style=style,aspect=aspect,duration=duration,reference_mode=mode,character=character or '',scene=scene or '',end_reference=ending or '')
    return JsonResponse(plan_data(plan),status=201)


@require_http_methods(['POST'])
@api_errors
def generate(request):
    data=json.loads(request.body);plan=get_object_or_404(ScenePlan,pk=data.get('plan'));project=plan.project
    # Bind generated content to its prepared project/style/references, not arbitrary browser text.
    values,model,_=validate({**data,'prompt':plan.prompt,'title':data.get('title') or plan.title,'style':plan.style,'aspect':plan.aspect,'duration':plan.duration,'mode':'modal','budget':'creative'})
    if plan.reference_mode == 'draft':
        raise ValueError('Dodaj početnu sliku prije generisanja.')
    if not model['image'] and plan.reference_mode!='text':raise ValueError('Ovaj model ne podržava slike. Izaberi image-to-video model ili rad bez slike.')
    if plan.end_reference and model['id'] not in ['ltx-2b','ltx23-22b','ltx25-dev','ltx25-distilled']:raise ValueError('Za ovu pripremljenu scenu izaberi LTX model koji podržava završni kadar.')
    if plan.reference_mode == 'keyframe' and model['id'] not in ['ltx23-22b', 'ltx25-dev', 'ltx25-distilled']:
        raise ValueError('Ponovo odaberi ulogu reference za izabrani model.')
    if not settings.VIDEOGEN_ALLOW_PAID:return JsonResponse({'error':'Modal generisanje nije uključeno u korijenskom .env.'},status=403)
    account=ensure_accounts()
    if not account or account.profile not in configured_profiles():raise ValueError('Poveži i odaberi Modal račun.')
    if data.get('account') is not None and str(data['account'])!=str(account.pk):raise ValueError('Odabrani račun je promijenjen u drugom prozoru. Osvježi stranicu prije generisanja.')
    balance=billing_state(account=account)
    if not balance.get('synced'):raise ValueError('Prvo osvježi Modal sredstva na stranici Troškovi.')
    if balance['remaining'] is None:raise ValueError('Unesi mjesečni kredit za odabrani račun u Promijeni račun.')
    if balance['remaining']<=0:raise ValueError('Modal trenutno ne prikazuje preostali kredit.')
    # One local job at a time; no artificial test/creative split or up-front credit holds.
    with transaction.atomic():
        VideoProject.objects.select_for_update().get(pk=project.pk)
        if Job.objects.filter(status__in=ACTIVE).exists():return JsonResponse({'error':'Jedna generacija već traje.'},status=409)
        ensure_budgets();values.pop('render_profile');values.pop('runtime_budget')
        job=Job.objects.create(**values,project=project,scene_plan=plan,modal_account=account,budget=Budget.objects.get(name='creative'),status='submitting',reserved_usd=0,
          metrics={'requested_render_profile':data.get('render_profile','standard'),'production':True,'phase':'composition',
                   'image_role':'reference' if plan.reference_mode=='keyframe' else 'start'})
    try:
        check_modal_worker(job)
        if model['image']:
            compose_reference(plan)
            with plan.reference.open('rb') as f:job.reference.save('scene.png',ContentFile(f.read()),save=True)
            if plan.end_reference:
                with plan.end_reference.open('rb') as f:job.end_reference.save('end.png',ContentFile(f.read()),save=True)
        job.metrics={**job.metrics,'phase':'modal'};job.save(update_fields=['metrics'])
        submit_modal(job)
    except Exception as exc:
        job.status='failed';job.error=str(exc) if isinstance(exc,ValueError) else 'Priprema scene nije završena. Provjeri rezultat prije ponovnog pokušaja.';job.finished_at=timezone.now();job.save(update_fields=['status','error','finished_at'])
    job.refresh_from_db()
    return JsonResponse(job_data(job),status=201)


@require_http_methods(['POST'])
@api_errors
def refresh_billing(request):
    try:
        account=ensure_accounts()
        if not account:raise ValueError('Nema povezanog Modal računa.')
        return JsonResponse(sync_billing(account=account))
    except ValueError as exc:return JsonResponse({'error':str(exc)},status=502)
    except Exception:return JsonResponse({'error':'Modal obračun trenutno nije dostupan. Posljednji uspješan prikaz ostaje sačuvan.'},status=502)


@require_http_methods(['GET'])
def costs(request):
    jobs=[job_data(j) for j in Job.objects.select_related('budget').all()]
    return JsonResponse({'billing':billing_state(account=ensure_accounts()),'averages':averages(),'jobs':jobs,'attribution_note':'Modal izvještaj grupiše naplatu po aplikaciji i satu. Bez jedinstvene oznake generacije nije moguće tačno pripisati zajedničko pokretanje/idle troškove pojedinom videu. Nepoznato nije nula; procjene se ne pretvaraju u stvarne račune.'})


@require_http_methods(['GET'])
def cost_csv(request):
    stream=io.StringIO();w=csv.writer(stream);w.writerow(['ID','Projekat','Naziv','Model','GPU','Sekunde','Koraci','Status','Trosak iz zabiljezenog trajanja USD','Potvrdjena naplata USD'])
    for j in Job.objects.select_related('project','budget').all():
        d=job_data(j);w.writerow([str(j.pk),j.project.name if j.project else '',j.title,j.model_id,j.gpu,j.duration,j.steps,j.status,d['measured_usd'] if d['measured_usd'] is not None else '',d['actual_usd'] if d['actual_usd'] is not None else ''])
    result=HttpResponse('\ufeff'+stream.getvalue(),content_type='text/csv; charset=utf-8');result['Content-Disposition']='attachment; filename="videogen-troskovi.csv"';return result


def gallery_cors(request,response):
    if request.headers.get('Origin')=='http://127.0.0.1:5175':response['Access-Control-Allow-Origin']='http://127.0.0.1:5175';response['Vary']='Origin'
    return response


@require_http_methods(['GET'])
def gallery(request):
    if request.headers.get('Origin') not in [None,'http://127.0.0.1:5175','http://127.0.0.1:5176']:
        return JsonResponse({'error':'Origin nije dozvoljen.'},status=403)
    return gallery_cors(request,JsonResponse({'jobs':[job_data(j) for j in Job.objects.filter(in_gallery=True,status='completed').select_related('budget') if gallery_file(j)]}))


@require_http_methods(['GET'])
def gallery_video(request,job_id):
    if request.headers.get('Origin') not in [None,'http://127.0.0.1:5175','http://127.0.0.1:5176']:
        return JsonResponse({'error':'Origin nije dozvoljen.'},status=403)
    j=get_object_or_404(Job,pk=job_id,in_gallery=True,status='completed')
    video=gallery_file(j)
    if not video:return gallery_cors(request,JsonResponse({'error':'Video nije dostupan.'},status=404))
    return gallery_cors(request,FileResponse(video.open('rb'),content_type='video/mp4',as_attachment=True,filename=video_filename(j.title,j.model_id)))

@require_http_methods(['GET'])
def plan_detail(request,plan_id):
    plan=get_object_or_404(ScenePlan,pk=plan_id)
    return JsonResponse({'plan':plan_data(plan),'form':{'title':plan.title,'direction':plan.prompt,'style':plan.style,'duration':plan.duration,'aspect':plan.aspect,'referenceMode':plan.reference_mode,'useEndFrame':bool(plan.end_reference)}})


@require_http_methods(['GET', 'HEAD'])
def scene_image(request, plan_id):
    plan = get_object_or_404(ScenePlan, pk=plan_id)
    primary = plan.scene if plan.reference_mode in ['combined', 'scene', 'reference', 'keyframe'] else plan.reference
    field = plan.end_reference if request.GET.get('kind') == 'end' else primary
    if not field or not field.storage.exists(field.name):
        return HttpResponse(status=404)
    return FileResponse(field.open('rb'), filename=Path(field.name).name)


@require_http_methods(['POST'])
@api_errors
def save_scene(request):
    project = get_object_or_404(VideoProject, pk=request.POST.get('project'))
    model = get_model(request.POST.get('model_id'))
    if not model or not model['enabled']:
        raise ValueError('Odaberi dostupan model.')
    title = request.POST.get('title', '').strip()
    prompt = request.POST.get('direction', '').strip()
    draft_only = request.POST.get('draft_only', '0') == '1'
    if (not title and not draft_only) or len(title) > 120:
        raise ValueError('Unesi naziv videa do 120 znakova.')
    if not draft_only and not 10 <= len(prompt) <= 4000:
        raise ValueError('Opis scene treba sadržavati 10–4000 znakova.')
    if len(prompt) > 12000:
        raise ValueError('Opis scene je predug.')
    style = request.POST.get('style', 'comic')
    aspect = request.POST.get('aspect', '16:9')
    duration = int(request.POST.get('duration', 5))
    if style not in dict(STYLE_OPTIONS) or aspect not in ['16:9', '9:16', '1:1'] or duration not in duration_options(model):
        raise ValueError('Provjeri stil, format i trajanje scene.')
    role = request.POST.get('image_role', 'start')
    if role not in ['start', 'reference']:
        raise ValueError('Odaberi ulogu slike.')
    previous = None
    if request.POST.get('previous_plan'):
        previous = get_object_or_404(ScenePlan, pk=request.POST['previous_plan'], project=project)
    image = request.FILES.get('image')
    if not image and previous:
        saved = previous.scene if previous.reference_mode in ['combined', 'scene', 'reference', 'keyframe'] else previous.reference
        if saved:
            image = saved_reference(saved)
    if model['image'] and not image and not draft_only:
        raise ValueError('Dodaj sliku za ovu scenu.')
    if not model['image'] and image:
        raise ValueError('Ovaj model radi iz teksta. Za sliku odaberi image-to-video model.')
    use_end = request.POST.get('end_enabled', '0') == '1'
    if use_end and model['id'] not in ['ltx-2b', 'ltx23-22b', 'ltx25-dev', 'ltx25-distilled']:
        raise ValueError('Izabrani model ne podržava završni kadar.')
    ending = request.FILES.get('end_reference') if use_end else None
    if use_end and not ending and previous and previous.end_reference:
        ending = saved_reference(previous.end_reference)
    if use_end and not ending and not draft_only:
        raise ValueError('Dodaj završni kadar ili isključi tu opciju.')
    for file in [image, ending]:
        validate_image(file)
    mode = 'text' if not image else 'combined'
    if not image and model['image'] and draft_only:
        mode = 'draft'
    if image and role == 'reference':
        mode = 'keyframe' if model['id'] in ['ltx23-22b', 'ltx25-dev', 'ltx25-distilled'] else 'reference'
    plan = ScenePlan.objects.create(project=project, title=title, direction=prompt,
        description=prompt, prompt=prompt, style=style, aspect=aspect, duration=duration,
        reference_mode=mode, scene=image or '', end_reference=ending or '')
    return JsonResponse(plan_data(plan), status=201)

@require_http_methods(['GET'])
def accounts(request):
    return JsonResponse(accounts_state())

@require_http_methods(['POST'])
@api_errors
def select_account(request):
    data=json.loads(request.body);account=get_object_or_404(ModalAccount,pk=data.get('account'))
    if account.profile not in configured_profiles():raise ValueError('Profil još nije prijavljen.')
    selection,_=ModalSelection.objects.get_or_create(pk=1);selection.account=account;selection.save(update_fields=['account'])
    return JsonResponse(accounts_state())

@require_http_methods(['PATCH'])
@api_errors
def update_account(request,account_id):
    account=get_object_or_404(ModalAccount,pk=account_id);data=json.loads(request.body)
    if 'monthly_credit' in data:
        value=Decimal(str(data['monthly_credit']))
        if not value.is_finite() or not 0<=value<=100000:raise ValueError('Unesi ispravan mjesečni kredit.')
        account.monthly_credit=value;account.save(update_fields=['monthly_credit'])
        from .models import BillingSnapshot
        from .provider_billing import current_cycle
        for snapshot in BillingSnapshot.objects.filter(account=account,cycle=current_cycle()):
            snapshot.payload={**snapshot.payload,'monthly_credit_usd':str(value)};snapshot.save(update_fields=['payload'])
    return JsonResponse(account_data(account))

@require_http_methods(['POST'])
@api_errors
def connect_account(request):
    data=json.loads(request.body);credit=Decimal(str(data.get('monthly_credit',30)))
    if not credit.is_finite() or not 0<=credit<=100000:raise ValueError('Unesi ispravan mjesečni kredit.')
    return JsonResponse(start_login(str(data.get('profile','')),str(data.get('label','')),credit))


@require_http_methods(['POST'])
@api_errors
def renew_account(request,account_id):
    account=get_object_or_404(ModalAccount,pk=account_id)
    return JsonResponse(start_login(account.profile,account.label,account.monthly_credit,renew=True))

@require_http_methods(['GET'])
@api_errors
def account_login_status(request):
    return JsonResponse(login_state(request.GET.get('profile','')))

@require_http_methods(['GET','HEAD'])
def play_video(request,job_id):
    from .video_streaming import video_response
    j=get_object_or_404(Job,pk=job_id)
    video=j.video if request.GET.get('original')=='1' else gallery_file(j)
    if not video or not video.storage.exists(video.name):return JsonResponse({'error':'Video nije dostupan.'},status=404)
    response=video_response(request,video)
    if request.GET.get('download')=='1':
        from django.utils.http import content_disposition_header
        response['Content-Disposition']=content_disposition_header(True,video_filename(j.title,j.model_id,original=request.GET.get('original')=='1'))
    return gallery_cors(request,response) if j.in_gallery else response


@require_http_methods(['POST'])
@api_errors
def process_video(request,job_id):
    payload=json.loads(request.body) if request.body else {}
    if not isinstance(payload,dict) or set(payload)-{'speed'}:raise ValueError('Neispravne postavke obrade.')
    speed=payload.get('speed',1)
    if isinstance(speed,bool) or speed not in [.5,.75,1,1.25,1.5,2]:raise ValueError('Odaberi ponuđenu brzinu videa.')
    with transaction.atomic():
        j=get_object_or_404(Job.objects.select_for_update(),pk=job_id)
        if j.status!='completed' or not j.video or not j.video.storage.exists(j.video.name):
            raise ValueError('Obrada traži završen i dostupan video.')
        if j.processing_status in ['pending','processing'] and j.processing_speed!=speed:
            return JsonResponse({'error':'Sačekaj završetak trenutne obrade prije promjene brzine.'},status=409)
        if j.processing_status not in ['pending','processing','ready'] or (j.processing_status=='ready' and (not gallery_file(j) or j.processing_info.get('speed',1)!=speed)):
            j.processing_status='pending';j.processing_error='';j.processing_speed=speed
            j.save(update_fields=['processing_status','processing_error','processing_speed'])
        transaction.on_commit(ensure_processing)
    return JsonResponse(job_data(j),status=202)
