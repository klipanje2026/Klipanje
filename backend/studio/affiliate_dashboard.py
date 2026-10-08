"""Affiliate links and dated metrics. Browser events never create purchase rewards."""
import re
import time
from uuid import uuid4
from datetime import timedelta
from django.db import IntegrityError, transaction
from django.db.models import Count, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from .models import AffiliateProfile, AffiliateLink, AffiliateVisit, AffiliateAudit, Referral, AffiliateReward, AffiliateCorrection
from .billing import paid_access

RESERVED = set('api admin studio titlovi video-editor login logout register signup pretplate book privacy privatnost faq services work krediti opcije affiliate affiliates assets static media robots sitemap favicon www support help settings account pricing checkout dashboard contact about terms health'.split())

def link_path(profile):
    primary = profile.links.filter(is_primary=True).first()
    return '/' + primary.slug if primary else '/api/referrals/' + str(profile.code)

def eligible(profile):
    return profile.active and profile.user.is_active and paid_access(profile.user)

def record_visit(request, profile, slug='', campaign=''):
    # Preserve first-touch attribution until its configured expiry; never reassign accounts.
    if not eligible(profile) or request.user.is_authenticated:
        return
    from .affiliates import settings_row
    visitor = request.session.get('affiliate_visitor')
    if not visitor:
        visitor = str(uuid4())
        request.session['affiliate_visitor'] = visitor
    campaign = campaign if re.fullmatch(r'[a-zA-Z0-9_-]{1,48}', campaign) else ''
    AffiliateVisit.objects.get_or_create(affiliate=profile, visitor=visitor, campaign=campaign, day=timezone.localdate(), defaults={'link_slug':slug})
    current = request.session.get('affiliate_referral')
    if not current or time.time()-current.get('at', 0)>settings_row().attribution_days*86400:
        request.session['affiliate_referral'] = {'id':profile.pk, 'at':time.time(), 'campaign':campaign, 'slug':slug}
        from django.db.models import F
        AffiliateProfile.objects.filter(pk=profile.pk).update(visits=F('visits')+1)

@require_POST
def follow(request, slug):
    link = AffiliateLink.objects.select_related('affiliate__user').filter(slug=slug.lower()).first()
    if not link or not eligible(link.affiliate):
        return JsonResponse({'error':'Link nije dostupan.'}, status=404)
    record_visit(request, link.affiliate, link.slug, request.GET.get('campaign', ''))
    return JsonResponse({'destination':'/'}, headers={'Cache-Control':'no-store'})

def report(profile, days, admin=False):
    today = timezone.localdate()
    start = today-timedelta(days=days-1)
    visits = profile.visit_events.filter(day__gte=start)
    referrals = profile.referrals.filter(created_at__date__gte=start)
    rewards = AffiliateReward.objects.filter(referral__affiliate=profile, created_at__date__gte=start)
    def daily(qs, field):
        if field == 'day':
            return {str(row['day']):row['count'] for row in qs.values('day').annotate(count=Count('pk'))}
        return {str(row['date']):row['count'] for row in qs.annotate(date=TruncDate(field)).values('date').annotate(count=Count('pk'))}
    v, r, p = daily(visits, 'day'), daily(referrals, 'created_at'), daily(rewards, 'created_at')
    dates = [str(start+timedelta(days=i)) for i in range(days)]
    campaigns = {row['campaign']:{'campaign':row['campaign'], 'visits':row['visits'], 'registrations':0} for row in visits.values('campaign').annotate(visits=Count('pk'))}
    for row in referrals.values('campaign').annotate(registrations=Count('pk')):
        campaigns.setdefault(row['campaign'], {'campaign':row['campaign'],'visits':0,'registrations':0})['registrations']=row['registrations']
    raw={'visits':visits.count(),'visitors':visits.values('visitor').distinct().count(),'registrations':referrals.count(),'purchases':rewards.count()}
    totals=dict(raw)
    corrections=profile.corrections.filter(status='approved',day__gte=start,day__lte=today)
    series={'visits':v,'registrations':r,'purchases':p}
    for correction in corrections:
        totals[correction.metric]+=correction.delta
        key=str(correction.day);series[correction.metric][key]=series[correction.metric].get(key,0)+correction.delta
        if correction.metric in ('visits','registrations'):
            campaigns.setdefault(correction.campaign,{'campaign':correction.campaign,'visits':0,'registrations':0})[correction.metric]+=correction.delta
    result={'userId':profile.user_id,'name':profile.user.first_name or profile.user.username,'active':profile.active,'eligible':eligible(profile),'path':link_path(profile),
        'days':days, 'historicalVisits':profile.visits, 'totals':totals,
        'series':[{'date':d,'visits':v.get(d,0),'registrations':r.get(d,0),'purchases':p.get(d,0)} for d in dates],
        'links':list((profile.links.all() if admin else profile.links.filter(is_primary=True)).order_by('-is_primary','-created_at').values('slug','is_primary')),
        'campaigns':sorted(campaigns.values(),key=lambda row:row['visits'],reverse=True),
        }
    result['demo']=profile.is_demo
    if profile.is_demo:
        from .models import AffiliateDemoDay
        demo={str(row.day):row for row in AffiliateDemoDay.objects.filter(affiliate=profile,day__gte=start,day__lte=today)}
        result['series']=[{'date':d,**{key:getattr(demo[d],key) if d in demo else 0 for key in ('visits','registrations','purchases')}} for d in dates]
        result['totals']={key:sum(row[key] for row in result['series']) for key in ('visits','registrations','purchases')}
        result['totals']['visitors']=0
    if admin:
        result['rawTotals']=raw
        result['audit']=[{'at':row.created_at,'actor':row.actor.username if row.actor else 'Obrisani račun','action':row.action,'detail':row.detail,'changes':row.changes} for row in profile.audit.select_related('actor').order_by('-created_at','-pk')[:100]]
    return result


@api_view(['GET','POST'])
def dashboard(request, user_id=None):
    if user_id is not None and not request.user.is_staff:
        return Response({'error':'Pristup nije dozvoljen.'},status=403)
    profile = AffiliateProfile.objects.select_related('user').filter(user_id=user_id or request.user.pk).first()
    if not profile or (not request.user.is_staff and not profile.active):
        return Response({'error':'Affiliate profil nije aktivan.'},status=403)
    if request.method=='POST':
        slug=request.data.get('slug', '')
        if not isinstance(slug,str):return Response({'error':'Unesi naziv linka.'},status=400)
        slug=slug.strip().lower()
        if not re.fullmatch(r'[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])',slug) or slug in RESERVED:
            return Response({'error':'Koristi 3–40 malih slova, brojeva ili crticu. Naziv je možda rezervisan.'},status=400)
        try:
            with transaction.atomic():
                profile=AffiliateProfile.objects.select_for_update().get(pk=profile.pk)
                existing=AffiliateLink.objects.filter(slug=slug).first()
                if existing and existing.affiliate_id!=profile.pk:
                    return Response({'error':'Naziv linka je zauzet.'},status=409)
                if not existing and profile.links.count()>=20:
                    return Response({'error':'Dosegnuto je 20 naziva; možeš ponovo odabrati raniji naziv.'},status=400)
                if not existing or not existing.is_primary:
                    profile.links.filter(is_primary=True).update(is_primary=False)
                    if existing:
                        existing.is_primary=True;existing.save(update_fields=['is_primary'])
                    else:AffiliateLink.objects.create(affiliate=profile,slug=slug)
                    AffiliateAudit.objects.create(affiliate=profile,actor=request.user,action='link_changed',detail=slug)
        except IntegrityError:
            return Response({'error':'Naziv linka je zauzet.'},status=409)
    try:days=int(request.query_params.get('days','30'))
    except (ValueError,TypeError):days=30
    if days not in (7,30,90):days=30
    return Response(report(profile,days,admin=request.user.is_staff),headers={'Cache-Control':'no-store'})
