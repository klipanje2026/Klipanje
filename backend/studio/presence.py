"""Short-lived, opt-in presence. Activity is a browser signal, not proof of work."""
import json
import time
from collections import Counter
from datetime import timedelta
from uuid import UUID, uuid4
from django.conf import settings
from django.core.cache import cache
from django.db import transaction
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_POST
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from .models import VisitorPresence, Referral, AffiliateProfile
from .product_analytics import PAGES, SECTIONS

SOURCES={'direct','google','bing','instagram','facebook','tiktok','youtube','linkedin','other'}

@require_POST
def heartbeat(request):
    if request.user.is_authenticated and request.user.is_staff:
        visitor=request.session.get('product_visitor')
        if visitor:VisitorPresence.objects.filter(visitor=visitor).update(visible=False,active=False)
        return JsonResponse({'accepted':False})
    if len(request.body)>1500:return JsonResponse({'error':'Too large'},status=413)
    try:
        data=json.loads(request.body)
        if not isinstance(data,dict) or set(data)-{'consent','tab','sequence','page','section','source','visible','active'}:raise ValueError()
        tab=UUID(str(data['tab']));seq=data['sequence']
        if type(seq) is not int or not 1<=seq<=9007199254740991 or type(data.get('consent')) is not bool:raise ValueError()
        consent=data['consent']
        if consent:
            if data.get('page') not in PAGES or data.get('section','') not in SECTIONS or data.get('source') not in SOURCES:raise ValueError()
            if type(data.get('visible')) is not bool or type(data.get('active')) is not bool:raise ValueError()
    except (ValueError,TypeError,KeyError,UnicodeDecodeError):return JsonResponse({'error':'Invalid heartbeat'},status=400)
    visitor=request.session.get('product_visitor')
    if not visitor:
        if not consent:return JsonResponse({'accepted':False})
        visitor=str(uuid4());request.session['product_visitor']=visitor
    now=timezone.now()
    if consent:
        key=f'presence-rate:{visitor}:{int(now.timestamp())//60}'
        cache.add(key,0,120)
        try:count=cache.incr(key)
        except ValueError:count=1;cache.set(key,1,120)
        if count>60:return JsonResponse({'error':'Too many heartbeats'},status=429)
    referral=Referral.objects.filter(user=request.user).first() if consent and request.user.is_authenticated else None
    attribution=request.session.get('affiliate_referral',{})
    from .affiliates import settings_row
    if time.time()-attribution.get('at',0)>settings_row().attribution_days*86400:attribution={}
    affiliate_id=referral.affiliate_id if referral else attribution.get('id')
    campaign=referral.campaign if referral else attribution.get('campaign','')
    if affiliate_id and not AffiliateProfile.objects.filter(pk=affiliate_id).exists():affiliate_id=None;campaign=''
    # The entry source is a coarse browser-reported bucket, never a raw referrer URL.
    source=request.session.get('presence_source')
    if not source and consent:
        source=data['source'];request.session['presence_source']=source
    if not VisitorPresence.objects.filter(visitor=visitor,tab=tab).exists() and VisitorPresence.objects.filter(visitor=visitor).count()>=128:
        return JsonResponse({'error':'Too many tabs'},status=429)
    with transaction.atomic():
        row,_=VisitorPresence.objects.select_for_update().get_or_create(visitor=visitor,tab=tab,defaults={'seen_at':now})
        if seq<=row.sequence:return JsonResponse({'accepted':False})
        row.sequence=seq;row.seen_at=now
        row.visible=bool(consent and data.get('visible'));row.active=bool(row.visible and data.get('active'))
        if consent:
            row.user=request.user if request.user.is_authenticated else None
            row.page=data['page'];row.section=data.get('section','');row.source=source or 'direct'
            row.affiliate_id=affiliate_id;row.campaign=campaign
            row.is_test=bool(settings.DEBUG and request.user.is_authenticated and request.user.username=='test_affiliate')
        row.save()
    if cache.add('presence-cleanup',True,300):purge_presence()
    return JsonResponse({'accepted':True})


def purge_presence():
    ids=list(VisitorPresence.objects.filter(seen_at__lt=timezone.now()-timedelta(hours=24)).values_list('pk',flat=True)[:5000])
    if ids:VisitorPresence.objects.filter(pk__in=ids).delete()


def snapshot(request, affiliate_id=None, admin=False):
    now=timezone.now()
    query=VisitorPresence.objects.filter(visible=True,seen_at__gte=now-timedelta(seconds=90)).exclude(user__is_staff=True)
    if request.query_params.get('includeTest')!='1' or not admin:query=query.filter(is_test=False)
    if affiliate_id is not None:query=query.filter(affiliate_id=affiliate_id)
    # One representative visible tab per browser session; active tab takes precedence.
    rows=query.select_related('user','affiliate__user').order_by('-active','-seen_at')
    unique={}
    for row in rows:
        if row.visitor not in unique:unique[row.visitor]=row
    visitors=list(unique.values())
    pages=Counter(r.page for r in visitors);sources=Counter(r.source for r in visitors)
    sections=Counter((r.page,r.section) for r in visitors)
    campaigns=Counter(r.campaign for r in visitors if r.affiliate_id)
    result={'at':now,'expiresAfterSeconds':90,'total':len(visitors),'active':sum(r.active for r in visitors),
        'editorActive':sum(r.active and r.page in {'captions','video'} for r in visitors),
        'editorOpen':sum(r.page in {'captions','video'} for r in visitors),
        'pages':[{'name':k,'count':v} for k,v in pages.most_common()],
        'sources':[{'name':k,'count':v} for k,v in sources.most_common()],
        'sections':[{'page':p,'section':s,'count':v} for (p,s),v in sections.most_common()],
        'campaigns':[{'name':k,'count':v} for k,v in campaigns.most_common()]}
    if admin:
        result['rows']=[{'user':r.user.username if r.user else 'Gost / obrisan račun','page':r.page,'section':r.section,'source':r.source,'active':r.active,'seenAt':r.seen_at,'affiliate':r.affiliate.user.username if r.affiliate else '', 'campaign':r.campaign,'isTest':r.is_test} for r in visitors[:100]]
        result['affiliateCounts']=[{'name':k,'count':v} for k,v in Counter(r.affiliate.user.username for r in visitors if r.affiliate).most_common()]
    return Response(result,headers={'Cache-Control':'no-store'})

@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_snapshot(request):
    affiliate_id=None
    if request.query_params.get('affiliateUser'):
        profile=AffiliateProfile.objects.filter(user_id=request.query_params['affiliateUser']).first() if request.query_params['affiliateUser'].isdigit() else None
        if not profile:return Response({'error':'Affiliate nije pronađen.'},status=404)
        affiliate_id=profile.pk
    return snapshot(request,affiliate_id,True)

@api_view(['GET'])
@permission_classes([IsAdminUser])
def affiliate_snapshot(request):
    from .affiliate_dashboard import eligible
    profile=AffiliateProfile.objects.filter(user=request.user).select_related('user').first()
    if not profile or not eligible(profile):return Response({'error':'Affiliate pristup nije dostupan.'},status=403)
    return snapshot(request,profile.pk)
