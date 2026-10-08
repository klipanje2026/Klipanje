"""Opt-in product signals only. These events must never award affiliate rewards."""
import json
from uuid import UUID, uuid4
from datetime import timedelta
from django.core.cache import cache
from django.db.models import Count
from django.db.models.functions import TruncDate
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_POST
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from .models import ProductEvent, Referral

NAMES = {'page_view','section_view','style_impression','style_select','style_replace','palette_select','style_export','media_selected','recognition_start','recognition_success','recognition_error','recognition_cancel','save_start','save_success','save_error','export_start','export_success','export_error'}
PAGES = {'home','captions','video','plans','checkout','account','other'}
SECTIONS = {'','styles','captions','settings','voice','media','audio','text','effects','export','elements','filters','transitions'}

@require_POST
def collect(request):
    if request.user.is_authenticated and request.user.is_staff:
        return JsonResponse({'accepted':0})
    if len(request.body)>24000:return JsonResponse({'error':'Batch too large'},status=413)
    try:body=json.loads(request.body)
    except (ValueError,UnicodeDecodeError):return JsonResponse({'error':'Invalid JSON'},status=400)
    if not isinstance(body,dict) or body.get('consent') is not True or set(body)-{'consent','events'}:
        return JsonResponse({'error':'Consent required'},status=400)
    events=body.get('events')
    if not isinstance(events,list) or not 1<=len(events)<=40:return JsonResponse({'error':'Invalid batch'},status=400)
    visitor=request.session.get('product_visitor')
    if not visitor:
        visitor=str(uuid4());request.session['product_visitor']=visitor
    rows=[]
    # Attribution is read on the server, never trusted from browser payloads.
    referral=Referral.objects.filter(user=request.user).first() if request.user.is_authenticated else None
    attribution=request.session.get('affiliate_referral',{})
    if not referral:
        import time
        from .affiliates import settings_row
        if time.time()-attribution.get('at',0)>settings_row().attribution_days*86400:attribution={}
    campaign=referral.campaign if referral else attribution.get('campaign','')
    affiliate=referral.affiliate_id if referral else attribution.get('id')
    for event in events:
        if not isinstance(event,dict) or set(event)-{'id','name','page','section','style'}:
            return JsonResponse({'error':'Unsupported fields'},status=400)
        name,page,section,style=(event.get('name'),event.get('page'),event.get('section',''),event.get('style',''))
        if not isinstance(name,str) or name not in NAMES or not isinstance(page,str) or page not in PAGES or not isinstance(section,str) or section not in SECTIONS:
            return JsonResponse({'error':'Invalid event'},status=400)
        import re
        if not isinstance(style,str) or (style and not re.fullmatch(r'[A-Za-z][A-Za-z0-9_-]{0,79}',style)):
            return JsonResponse({'error':'Invalid style'},status=400)
        if name.startswith('style_') or name=='palette_select':
            if not style:return JsonResponse({'error':'Style required'},status=400)
        elif style:return JsonResponse({'error':'Unexpected style'},status=400)
        try:event_id=UUID(str(event.get('id')))
        except ValueError:return JsonResponse({'error':'Invalid event ID'},status=400)
        if name in {'style_impression','style_select','style_replace','palette_select'}:continue
        rows.append(ProductEvent(id=event_id,visitor=visitor,user=request.user if request.user.is_authenticated else None,name=name,page=page,section=section,style=style,campaign=campaign,affiliate_id_value=affiliate))
    key='product-rate:'+visitor+':'+str(int(timezone.now().timestamp())//60)
    cache.add(key,0,timeout=120)
    try:total=cache.incr(key,len(rows))
    except ValueError:total=len(rows);cache.set(key,total,120)
    if total>240:return JsonResponse({'error':'Too many events'},status=429)
    ProductEvent.objects.bulk_create(rows,ignore_conflicts=True)
    if cache.add("product-retention-cleanup",True,timeout=3600):
        purge_old_events()
    return JsonResponse({'accepted':len(rows)})

@api_view(['GET'])
@permission_classes([IsAdminUser])
def overview(request):
    try:days=int(request.query_params.get('days','30'))
    except ValueError:days=30
    if days not in (7,30,90):days=30
    start=timezone.localdate()-timedelta(days=days-1)
    base=ProductEvent.objects.filter(created_at__date__gte=start).exclude(name__in=['style_impression','style_select','style_replace','palette_select'])
    campaigns=list(base.exclude(campaign='').values_list('campaign',flat=True).distinct().order_by('campaign')[:200])
    campaign=request.query_params.get('campaign','')
    if campaign:base=base.filter(campaign=campaign)
    totals={r['name']:r['total'] for r in base.values('name').annotate(total=Count('pk'))}
    styles={}
    for row in base.filter(name='style_export').exclude(style='').values('style','name').annotate(total=Count('pk'),visitors=Count('visitor',distinct=True)):
        entry=styles.setdefault(row['style'],{'style':row['style']})
        entry[row['name']]=row['total'];entry[row['name']+'_visitors']=row['visitors']
    daily={str(r['date']):r for r in base.annotate(date=TruncDate('created_at')).values('date').annotate(events=Count('pk'),visitors=Count('visitor',distinct=True))}
    return Response({'days':days,'visitors':base.values('visitor').distinct().count(),'totals':totals,'campaigns':campaigns,
        'styles':sorted(styles.values(),key=lambda x:(-x.get('style_export',0),x['style'])),
        'sections':list(base.filter(name='section_view').values('page','section').annotate(total=Count('pk')).order_by('-total')),
        'pages':list(base.filter(name='page_view').values('page').annotate(total=Count('pk')).order_by('-total')),
        'series':[{'date':str(start+timedelta(days=i)),'events':daily.get(str(start+timedelta(days=i)),{}).get('events',0),'visitors':daily.get(str(start+timedelta(days=i)),{}).get('visitors',0)} for i in range(days)]},headers={'Cache-Control':'no-store'})


def record_server_event(request, name, operation_key=None, page='captions'):
    """Best effort; analytics must never break saving or media processing."""
    if request.headers.get('X-Product-Analytics')!='1' or (request.user.is_authenticated and request.user.is_staff):return
    if name not in {'upload_confirmed','save_confirmed','recognition_confirmed'}:return
    try:
        from uuid import uuid5, NAMESPACE_URL
        from django.db import transaction
        visitor=request.session.get('product_visitor')
        if not visitor:visitor=str(uuid4());request.session['product_visitor']=visitor
        referral=Referral.objects.filter(user=request.user).first() if request.user.is_authenticated else None
        event_id=uuid5(NAMESPACE_URL,name+':'+str(operation_key)) if operation_key else uuid4()
        values=dict(id=event_id,visitor=visitor,user=request.user if request.user.is_authenticated else None,name=name,page=page,campaign=referral.campaign if referral else '',affiliate_id_value=referral.affiliate_id if referral else None)
        def store():
            try:ProductEvent.objects.get_or_create(id=event_id,defaults={k:v for k,v in values.items() if k!='id'})
            except Exception:pass
        transaction.on_commit(store,robust=True)
    except Exception:pass


def purge_old_events():
    # Bounded hourly cleanup; public dashboards only query the last 90 days.
    try:
        ids=list(ProductEvent.objects.filter(created_at__lt=timezone.now()-timedelta(days=90)).values_list('pk',flat=True)[:5000])
        if ids:ProductEvent.objects.filter(pk__in=ids).delete()
        return len(ids)
    except Exception:return 0
