"""Observed provider requests, not provider invoices. Never stores content or keys."""
import logging
import time
from contextlib import contextmanager
from datetime import datetime, time as day_time, timedelta
from uuid import UUID
from django.conf import settings
from django.db import transaction
from django.db.models import Count, Sum, Q, Max, CharField
from django.db.models.functions import ExtractHour, TruncDate, Cast, Coalesce
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from .models import ProviderUsage

logger = logging.getLogger(__name__)

@contextmanager
def measure(request, provider, action, operation_key=None, **quantities):
    user = getattr(request, 'user', None)
    user = user if user is not None and user.is_authenticated else None
    try: key = UUID(str(operation_key)) if operation_key else None
    except (ValueError, TypeError): key = None
    data = {'status':'error', 'http_status':None, 'output_bytes':0}
    row = None
    start = time.monotonic()
    try:
        # Savepoints isolate tracking failures from the actual media transaction.
        with transaction.atomic():
            row = ProviderUsage.objects.create(user=user, provider=provider, action=action, operation_key=key,
                is_staff=bool(user and user.is_staff),
                is_test=bool(settings.DEBUG and user and user.username=='test_affiliate'),
                **{k:v for k,v in quantities.items() if k in {'input_chars','input_seconds','input_bytes'}})
    except Exception:
        logger.warning('Provider usage start unavailable')
    try:
        yield data
    except Exception as exc:
        response=getattr(exc,'response',None)
        status=response.get('ResponseMetadata',{}).get('HTTPStatusCode') if isinstance(response,dict) else getattr(response,'status_code',None)
        if isinstance(status,int) and 100<=status<=599:data['http_status']=status
        raise
    finally:
        if row:
            try:
                with transaction.atomic():
                    ProviderUsage.objects.filter(pk=row.pk).update(**data, elapsed_ms=max(0,round((time.monotonic()-start)*1000)))
            except Exception:
                logger.warning('Provider usage completion unavailable')


def provider_call(request, provider, action, callback, operation_key=None, **quantities):
    with measure(request, provider, action, operation_key, **quantities) as result:
        response=callback()
        status=getattr(response,'status_code',None)
        result.update(http_status=status,status='success' if status is None or 200<=status<300 else 'error')
        return response


def totals(query):
    result=query.aggregate(calls=Count('id'),errors=Count('id',filter=Q(status='error')),pending=Count('id',filter=Q(status='pending')),
        inputChars=Sum('input_chars'),inputSeconds=Sum('input_seconds'),inputBytes=Sum('input_bytes'),outputBytes=Sum('output_bytes'))
    return {k:v or 0 for k,v in result.items()}


def report(request, admin):
    try: day=datetime.strptime(request.query_params.get('date',''),'%Y-%m-%d').date()
    except ValueError: day=timezone.localdate()
    start=timezone.make_aware(datetime.combine(day,day_time.min))
    end=timezone.make_aware(datetime.combine(day+timedelta(days=1),day_time.min))
    query=ProviderUsage.objects.all()
    if not admin: query=query.filter(user=request.user)
    elif request.query_params.get('includeInternal')!='1': query=query.filter(is_staff=False,is_test=False)
    if admin and request.query_params.get('user'):
        try: query=query.filter(user_id=int(request.query_params['user']))
        except ValueError: return Response({'error':'Neispravan korisnik.'},status=400)
    provider=request.query_params.get('provider')
    if provider in ['elevenlabs','r2','b2','local']: query=query.filter(provider=provider)
    audience=request.query_params.get('audience','')
    if admin and audience=='affiliates': query=query.filter(user__affiliate__active=True)
    if admin and audience=='referred': query=query.filter(user__referral__isnull=False)
    month_start=start.replace(day=1)
    month_end=(month_start+timedelta(days=32)).replace(day=1)
    calendar=list(query.filter(created_at__gte=month_start,created_at__lt=month_end).annotate(day=TruncDate('created_at')).values('day').annotate(calls=Count('id'),errors=Count('id',filter=Q(status='error')),inputSeconds=Sum('input_seconds'),inputBytes=Sum('input_bytes')).order_by('day'))
    query=query.filter(created_at__gte=start,created_at__lt=end)
    try: hour=int(request.query_params.get('hour',''))
    except ValueError: hour=None
    chart=query.annotate(hour=ExtractHour('created_at')).values('hour').annotate(calls=Count('id'),errors=Count('id',filter=Q(status='error')),inputChars=Sum('input_chars'),inputSeconds=Sum('input_seconds'),inputBytes=Sum('input_bytes'))
    hours={r['hour']:r for r in chart}
    series=[hours.get(i,{'hour':i,'calls':0,'errors':0,'inputChars':0,'inputSeconds':0,'inputBytes':0}) for i in range(24)]
    if hour is not None and 0<=hour<=23: query=query.filter(created_at__hour=hour)
    summary=totals(query)
    groups=list(query.values('provider','action').annotate(calls=Count('id'),errors=Count('id',filter=Q(status='error')),inputChars=Sum('input_chars'),inputSeconds=Sum('input_seconds'),inputBytes=Sum('input_bytes'),outputBytes=Sum('output_bytes')).order_by('-calls'))
    try: page=max(1,min(100000,int(request.query_params.get('page',1))))
    except ValueError: page=1
    fields=['id','provider','action','operation_key','status','http_status','input_chars','input_seconds','input_bytes','output_bytes','elapsed_ms','created_at']
    if admin: fields+=['user_id','user__username','is_staff','is_test']
    rows=list(query.order_by('-created_at','-id').values(*fields)[(page-1)*25:page*25+1])
    # An absent operation ID must never merge unrelated calls into one video.
    operations=list(query.annotate(operation=Coalesce(Cast('operation_key',CharField()),Cast('id',CharField()))).values('operation','user_id').annotate(username=Max('user__username'),lastAt=Max('created_at'),calls=Count('id'),errors=Count('id',filter=Q(status='error')),inputSeconds=Sum('input_seconds',filter=Q(provider='elevenlabs')),inputChars=Sum('input_chars',filter=Q(provider='elevenlabs')),storageBytes=Sum('input_bytes',filter=Q(provider__in=['r2','b2','local'])),storageCalls=Count('id',filter=Q(provider__in=['r2','b2','local'])),elevenCalls=Count('id',filter=Q(provider='elevenlabs'))).order_by('-lastAt','operation')[(page-1)*25:page*25+1])
    for item in operations:
        if not admin: item.pop('user_id');item.pop('username')
    result={'calendar':calendar,'operations':operations[:25],'operationsHasNext':len(operations)>25,'date':str(day),'timezone':str(timezone.get_current_timezone()),'totals':summary,'series':series,'groups':groups,'rows':rows[:25],'hasNext':len(rows)>25,'page':page}
    if admin: result['users']=list(query.values('user_id','user__username').annotate(calls=Count('id'),errors=Count('id',filter=Q(status='error')),inputChars=Sum('input_chars'),inputSeconds=Sum('input_seconds'),inputBytes=Sum('input_bytes')).order_by('-calls')[:100])
    return Response(result,headers={'Cache-Control':'no-store'})

@api_view(['GET'])
def mine(request):return report(request,False)

@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_report(request):return report(request,True)
