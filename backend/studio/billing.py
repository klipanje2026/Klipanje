import calendar
from django.conf import settings
from uuid import UUID
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.db.models import F, Q, Sum
from django.utils import timezone
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.response import Response
from .models import Subscription, TokenEntry, TokenOperation, PlanRequest, TransferUsage, AccessApproval

PLANS = {
    'free': {'name': 'Free', 'tokens': 5, 'price': 0},
    'standard': {'name': 'Standard', 'tokens': 100, 'price': 20},
    'advanced': {'name': 'Advanced', 'tokens': 200, 'price': 30},
    'annual': {'name': 'Basic Annual', 'tokens': 30, 'price': 12, 'annualTotal': 144},
    'loyalty': {'name': 'Basic Loyalty · test', 'tokens': 30, 'price': 20, 'minimumPrice': 10},
    'partner': {'name': 'Partner', 'tokens': 1000, 'price': 0},
}

def paid_access(user):
    if not user.is_active: return False
    if settings.LOCAL_APP: return True
    if user.is_staff or getattr(getattr(user, "affiliate", None), "active", False): return True
    sub=account(user)
    return bool(sub.paid_until and sub.paid_until>timezone.now())

def refresh_annual(sub):
    now=timezone.now()
    if sub.plan!='annual' or not sub.paid_until or sub.paid_until<=now: return sub
    with transaction.atomic():
        sub=Subscription.objects.select_for_update().get(pk=sub.pk)
        if sub.period_end and sub.period_end<=now and not TokenOperation.objects.filter(user=sub.user,status='reserved').exists():
            while sub.period_end<=now:
                sub.period_start=sub.period_end
                sub.period_end=min(next_month(sub.period_start),sub.paid_until)
            sub.remaining=30; sub.allowance=30; sub.used=0; sub.save()
            TokenEntry.objects.create(user=sub.user,kind='grant',amount=30,balance_after=30,detail='Godišnji paket · mjesečnih 30 tokena')
    return sub

def account(user):
    with transaction.atomic():
        sub, created = Subscription.objects.get_or_create(user=user)
        if created:
            TokenEntry.objects.create(user=user, kind='grant', amount=5, balance_after=5, detail='Free · početnih 5 tokena')
        return refresh_annual(sub)

def payload(sub):
    if sub.user.is_staff or settings.LOCAL_APP:
        return {'plan':'admin', 'allowance':None, 'remaining':None, 'used':sub.used,
                'periodStart':sub.period_start, 'periodEnd':None, 'status':'active', 'unlimited':True,
                'uploadUsed':0, 'exportUsed':0, 'transferLimit':None}

    from .models import UserControls
    controls=UserControls.objects.filter(user=sub.user).first()
    upload_limit=controls.upload_limit if controls else None
    download_limit=controls.download_limit if controls else None
    if sub.plan=='partner':
        if upload_limit is None:upload_limit=1000000000
        if download_limit is None:download_limit=1000000000
    expired = bool(sub.period_end and sub.period_end <= timezone.now())
    return {'plan': sub.plan, 'allowance': sub.allowance, 'remaining': 0 if expired else sub.remaining,
            'paidUntil':sub.paid_until, 'loyaltyMonths':sub.loyalty_months, 'cancelled':sub.cancelled, 'lastPrice':sub.last_price, 'nextPrice':max(10,20-sub.loyalty_months) if sub.plan=='loyalty' and not sub.cancelled and sub.paid_until and sub.paid_until>timezone.now() else 20, 'paidAccess':paid_access(sub.user),
            'used': sub.used, 'periodStart': sub.period_start, 'periodEnd': sub.period_end,
            'status': 'expired' if expired else 'active', 'unlimited':False,
            'transferLimit':download_limit,'uploadLimit':upload_limit,'downloadLimit':download_limit,
            **{kind+'Used':TransferUsage.objects.filter(user=sub.user,period_start=sub.period_start,kind=kind).aggregate(total=Sum('size'))['total'] or 0 for kind in ['upload','export']}}

def plan_list():
    # Legacy annual/loyalty accounts remain intact; only the agreed pilot is sold.
    return [{'id': key, **plan, 'currency': 'USD', 'interval': 'once' if key == 'free' else 'month'} for key, plan in PLANS.items() if key in ('free', 'standard', 'advanced')]

@api_view(['GET'])
@permission_classes([AllowAny])
def plans(request):
    from .stripe_payments import enabled
    return Response({'plans': plan_list(), 'checkoutEnabled': enabled(), 'testMode': True})

@api_view(['GET'])
def mine(request):
    sub = account(request.user)
    entries = list(request.user.token_entries.order_by('-created_at').values('id', 'kind', 'amount', 'balance_after', 'detail', 'created_at')[:50])
    pending = request.user.plan_requests.filter(status='pending').values('id','plan','created_at').first()
    return Response({'subscription': payload(sub), 'entries': entries, 'pending': pending, 'usage':list(TokenOperation.objects.filter(user=request.user,status='completed',created_at__gte=sub.period_start).values('capability').annotate(tokens=Sum('tokens')))}, headers={'Cache-Control':'no-store'})

class RequestInput(serializers.Serializer):
    plan = serializers.ChoiceField(choices=['standard','advanced','annual','loyalty'])

@api_view(['POST'])
def request_plan(request):
    checked=RequestInput(data=request.data); checked.is_valid(raise_exception=True)
    try:
        with transaction.atomic():
            row=PlanRequest.objects.create(user=request.user,plan=checked.validated_data['plan'])
    except IntegrityError:
        return Response({'error':'Zahtjev je već poslan. Administrator će ga pregledati.'}, status=409)
    return Response({'id':row.pk,'status':'pending'},status=201)

@api_view(['GET'])
@permission_classes([IsAdminUser])
def dashboard(request):
    users=get_user_model().objects.select_related('subscription').order_by('-date_joined')
    search=request.query_params.get('search','').strip()[:100]
    if search: users=users.filter(Q(username__icontains=search)|Q(first_name__icontains=search)|Q(email__icontains=search))
    plan=request.query_params.get('plan')
    if plan=='affiliate': users=users.filter(affiliate__active=True)
    elif plan in PLANS: users=users.filter(subscription__plan=plan).exclude(affiliate__active=True)
    try: page=max(1,int(request.query_params.get('page',1)))
    except ValueError: page=1
    total=users.count()
    rows=[]
    for user in users[(page-1)*30:page*30]:
        sub=getattr(user,'subscription',None) or account(user)
        rows.append({'id':user.pk,'username':user.username,'name':user.first_name,'email':user.email,
          'accessApproved':user.is_staff or AccessApproval.objects.filter(user=user,approved=True).exists(), 'isAffiliate':getattr(getattr(user,'affiliate',None),'active',False), 'isAdmin':user.is_staff,'isActive':user.is_active,'joined':user.date_joined,'subscription':payload(sub)})
    return Response({'users':rows,'total':total,'page':page,'stats':{
        'users':get_user_model().objects.count(), 'active':get_user_model().objects.filter(is_active=True).count(),
        'used':TokenEntry.objects.filter(kind='spend').aggregate(value=Sum('amount'))['value'] or 0,
        'pending':PlanRequest.objects.filter(status='pending').count(),
        'plans':{**{key:Subscription.objects.filter(plan=key,user__is_staff=False).exclude(user__affiliate__active=True).count() for key in ('free','standard','advanced')},'affiliate':get_user_model().objects.filter(affiliate__active=True,is_staff=False).count()}},
        'requests':list(PlanRequest.objects.filter(status='pending').select_related('user').values('id','user_id','user__username','plan','created_at')[:100])},headers={'Cache-Control':'no-store'})

class ActivationInput(serializers.Serializer):
    operationId = serializers.UUIDField()
    plan = serializers.ChoiceField(choices=list(PLANS))
    reason = serializers.CharField(min_length=3,max_length=200)
    requestId = serializers.IntegerField(required=False,min_value=1)
    paymentConfirmed = serializers.BooleanField(default=False)

def next_month(now):
    year=now.year+(now.month==12); month=now.month%12+1
    return now.replace(year=year,month=month,day=min(now.day,calendar.monthrange(year,month)[1]))

@api_view(['POST'])
@permission_classes([IsAdminUser])
def activate(request,user_id):
    checked=ActivationInput(data=request.data); checked.is_valid(raise_exception=True)
    user=get_user_model().objects.filter(pk=user_id).first()
    if not user: return Response({'error':'Korisnik nije pronađen.'},status=404)
    account(user)
    with transaction.atomic():
        sub=Subscription.objects.select_for_update().get(user=user)
        previous=TokenEntry.objects.filter(reference=checked.validated_data['operationId']).first()
        if previous:
            if previous.user_id!=user.pk or previous.actor_id!=request.user.pk:
                return Response({'error':'Identifikator radnje je već iskorišten.'},status=409)
            return Response({'subscription':payload(sub)})
        if TokenOperation.objects.filter(user=user,status='reserved').exists():
            return Response({'error':'Korisnik ima obradu u toku. Sačekaj završetak.'},status=409)
        pending=None
        if checked.validated_data.get('requestId'):
            pending=PlanRequest.objects.select_for_update().filter(pk=checked.validated_data['requestId'],user=user,status='pending',plan=checked.validated_data['plan']).first()
            if not pending: return Response({'error':'Zahtjev je već obrađen ili ne odgovara paketu.'},status=409)
        key=checked.validated_data['plan']; now=timezone.now()
        # Free is a one-time welcome grant, never refilled by plan switching.
        amount=0 if key=='free' else PLANS[key]['tokens']
        paid=checked.validated_data['paymentConfirmed'] and PLANS[key]['price']>0
        if paid and sub.paid_until and sub.paid_until>now:
            return Response({'error':'Plaćeni period još traje. Obnovi paket nakon završetka perioda.'},status=409)
        # A continuous renewal may arrive shortly after the paid period ends.
        continuous=key=='loyalty' and sub.plan==key and not sub.cancelled and sub.paid_until and 0<=(now-sub.paid_until).total_seconds()<=86400
        sub.last_price=(max(10,20-sub.loyalty_months) if continuous else 20) if key=='loyalty' else PLANS[key].get('annualTotal',PLANS[key]['price'])
        sub.loyalty_months=(sub.loyalty_months+1 if continuous else 1) if paid and key=='loyalty' else 0
        sub.cancelled=False
        sub.paid_until=next_month(now) if paid else None
        if paid and key=='annual':
            sub.paid_until=now.replace(year=now.year+1,day=min(now.day,calendar.monthrange(now.year+1,now.month)[1]))
        sub.plan=key; sub.allowance=PLANS[key]['tokens']; sub.remaining=amount; sub.used=0
        sub.period_start=now; sub.period_end=None if key=='free' else next_month(now); sub.save()
        purchase=TokenEntry.objects.create(user=user,actor=request.user,kind='plan',amount=amount,balance_after=amount,
            detail=f'{PLANS[key]["name"]} · ${sub.last_price} · {"plaćeno" if paid else "ručno"}: {checked.validated_data["reason"]}',reference=checked.validated_data['operationId'])
        if checked.validated_data['paymentConfirmed'] and PLANS[key]['price']>0:
            from .affiliates import reward_purchase
            reward_purchase(purchase)
        if pending: pending.status='approved'; pending.resolved_at=now; pending.save()
    return Response({'subscription':payload(sub)})

@api_view(['GET'])
@permission_classes([IsAdminUser])
def user_history(request,user_id):
    return Response({'entries':list(TokenEntry.objects.filter(user_id=user_id).order_by('-created_at').values('id','kind','amount','balance_after','detail','created_at','actor__username')[:100])})

class CreditError(Exception):
    pass

def reserve(user, capability, tokens, key):
    if not isinstance(tokens,int) or isinstance(tokens,bool) or tokens<=0: raise CreditError('Neispravan obračun tokena.')
    try: key=UUID(str(key))
    except (ValueError,TypeError,AttributeError): raise CreditError('Zahtjev nema ispravan identifikator. Pokušaj ponovo.')
    account(user)
    with transaction.atomic():
        sub=Subscription.objects.select_for_update().get(user=user)
        if TokenOperation.objects.filter(user=user,key=key).exists(): raise CreditError('Ova obrada je već poslana. Ne šalji je ponovo.')
        if sub.period_end and sub.period_end<=timezone.now(): raise CreditError('Paket je istekao. Otvori Pretplate za obnovu.')
        changed=Subscription.objects.filter(pk=sub.pk,remaining__gte=tokens).update(remaining=F('remaining')-tokens)
        if not changed: raise CreditError('Nema dovoljno Edita tokena. Otvori Pretplate za novi paket.')
        operation=TokenOperation.objects.create(user=user,key=key,capability=capability,tokens=tokens,period_start=sub.period_start)
        sub.refresh_from_db()
        TokenEntry.objects.create(user=user,kind='reserve',amount=-tokens,balance_after=sub.remaining,detail=capability)
        return operation

def settle(operation, success, actual_tokens=None):
    with transaction.atomic():
        op=TokenOperation.objects.select_for_update().get(pk=operation.pk)
        if op.status!='reserved': return
        sub=Subscription.objects.select_for_update().get(user=op.user)
        if success and actual_tokens is not None:
            if actual_tokens<1 or actual_tokens>op.tokens: raise CreditError('Nema dovoljno tokena za generisani glas.')
            unused=op.tokens-actual_tokens
            sub.remaining=F('remaining')+unused
            op.tokens=actual_tokens
            if unused: TokenEntry.objects.create(user=op.user,kind='refund',amount=unused,balance_after=Subscription.objects.get(pk=sub.pk).remaining+unused,detail='Neiskorištena rezervacija za glas')
        if success: sub.used=F('used')+op.tokens
        else: sub.remaining=F('remaining')+op.tokens
        sub.save(); sub.refresh_from_db()
        op.status='completed' if success else 'refunded'; op.save(update_fields=['status','tokens'])
        TokenEntry.objects.create(user=op.user,kind='spend' if success else 'refund',amount=op.tokens,balance_after=sub.remaining,detail=op.capability)


def charge_transfer(user, kind, size, key):
    if user.is_staff or settings.LOCAL_APP: return
    sub=account(user)
    if kind not in ('upload','export') or not isinstance(size,int) or size<=0:
        raise CreditError('Neispravna velicina datoteke.')
    with transaction.atomic():
        sub=Subscription.objects.select_for_update().get(pk=sub.pk)
        # Force a write lock on SQLite before reading cumulative usage.
        Subscription.objects.filter(pk=sub.pk).update(updated_at=timezone.now())
        prior=TransferUsage.objects.filter(user=user,key=key,kind=kind).first()
        if prior:
            if prior.size!=size: raise CreditError('Identifikator datoteke je vec iskoristen.')
            return
        if sub.plan=='partner' and sub.period_end and sub.period_end<=timezone.now(): raise CreditError('Partnerski paket je istekao.')
        used=TransferUsage.objects.filter(user=user,period_start=sub.period_start,kind=kind).aggregate(total=Sum('size'))['total'] or 0
        from .models import UserControls
        controls=UserControls.objects.filter(user=user).first()
        limit=(controls.upload_limit if kind=='upload' else controls.download_limit) if controls else None
        if limit is None and sub.plan=='partner':limit=1000000000
        if limit is not None and used+size>limit: raise CreditError('Dostignut je limit prenosa za '+kind+'.')
        TransferUsage.objects.create(user=user,key=key,kind=kind,size=size,period_start=sub.period_start)

@api_view(['POST'])
def export_usage(request):
    upload=request.FILES.get('file')
    if not upload: return Response({'error':'Posalji izvoz za provjeru velicine.'},status=400)
    try:
        key=UUID(str(request.data.get('operationId','')))
        charge_transfer(request.user,'export',upload.size,key)
    except (ValueError,CreditError) as exc:
        return Response({'error':str(exc)},status=409)
    return Response({'ok':True},headers={'Cache-Control':'no-store'})

@api_view(['POST'])
def cancel(request):
    from .stripe_payments import cancel_subscription, PaymentError
    try:
        cancel_subscription(request.user)
    except PaymentError as exc:
        return Response({'error': str(exc)}, status=503)
    account(request.user)
    with transaction.atomic():
        sub=Subscription.objects.select_for_update().get(user=request.user)
        sub.cancelled=True;sub.loyalty_months=0;sub.save(update_fields=['cancelled','loyalty_months'])
    return Response({'subscription':payload(sub)})
