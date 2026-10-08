from django.contrib.auth import get_user_model
from django.db import transaction, IntegrityError
from django.utils import timezone
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from .models import UserControls, UserControlAudit, AffiliateProfile, AffiliateCoupon, Subscription, TokenEntry, TokenOperation
from .billing import account


class ControlsInput(serializers.Serializer):
    upload_limit = serializers.IntegerField(min_value=0, max_value=10000000000000, allow_null=True)
    download_limit = serializers.IntegerField(min_value=0, max_value=10000000000000, allow_null=True)
    discount_percent = serializers.ChoiceField(choices=[0, 5, 10])
    tokens = serializers.IntegerField(min_value=0, max_value=100000, default=0)
    operation = serializers.UUIDField()
    reason = serializers.CharField(min_length=3, max_length=300)


@api_view(['GET', 'POST'])
@permission_classes([IsAdminUser])
def controls(request, user_id):
    user = get_user_model().objects.filter(pk=user_id).first()
    if not user:
        return Response({'error': 'Korisnik nije pronađen.'}, status=404)
    account(user)
    with transaction.atomic():
        sub = Subscription.objects.select_for_update().get(user=user)
        row, _ = UserControls.objects.get_or_create(user=user)
        profile = AffiliateProfile.objects.filter(user=user).first()
        if request.method == 'POST':
            checked = ControlsInput(data=request.data); checked.is_valid(raise_exception=True)
            data = checked.validated_data
            if TokenEntry.objects.filter(reference=data['operation']).exists():
                return Response({'error': 'Ova promjena je već spremljena.'}, status=409)
            if data['discount_percent'] and (not profile or not profile.active):
                return Response({'error': 'Popust se dodjeljuje aktivnom affiliatoru.'}, status=400)
            if data['tokens'] and sub.period_end and sub.period_end <= timezone.now():
                if TokenOperation.objects.filter(user=user,status='reserved').exists():
                    return Response({'error':'Sačekaj završetak obrade.'},status=409)
                sub.remaining=0; sub.allowance=0; sub.used=0; sub.period_end=None; sub.period_start=timezone.now(); sub.plan='free'
            previous={'upload':row.upload_limit,'download':row.download_limit,'discount':profile.discount_percent if profile else 0}
            row.upload_limit=data['upload_limit']; row.download_limit=data['download_limit']; row.save()
            if profile:
                profile.discount_percent=data['discount_percent']; profile.save(update_fields=['discount_percent'])
            sub.remaining += data['tokens']; sub.allowance += data['tokens']; sub.save()
            TokenEntry.objects.create(user=user,actor=request.user,kind='grant' if data['tokens'] else 'settings',amount=data['tokens'],balance_after=sub.remaining,reference=data['operation'],detail=data['reason'])
            UserControlAudit.objects.create(user=user,actor=request.user,detail=f"{data['reason']} | before={previous} | upload={row.upload_limit}, download={row.download_limit}, discount={data['discount_percent']}, tokens=+{data['tokens']}")
        return Response({'upload_limit':row.upload_limit,'download_limit':row.download_limit,'discount_percent':profile.discount_percent if profile else 0,'affiliate':bool(profile and profile.active),'remaining':sub.remaining,'verified_email':row.verified_email,'history':list(UserControlAudit.objects.filter(user=user).order_by('-created_at').values('detail','created_at','actor__username')[:30])})


class CouponInput(serializers.Serializer):
    code = serializers.RegexField(r'^[A-Za-z0-9][A-Za-z0-9-]{2,31}$')


@api_view(['GET','POST'])
def coupons(request):
    profile=AffiliateProfile.objects.filter(user=request.user,active=True).first()
    if not profile:return Response({'error':'Affiliate pristup nije aktivan.'},status=403)
    if request.method=='POST':
        checked=CouponInput(data=request.data);checked.is_valid(raise_exception=True)
        with transaction.atomic():
            profile=AffiliateProfile.objects.select_for_update().get(pk=profile.pk)
            if not profile.discount_percent:return Response({'error':'Administrator još nije odredio popust.'},status=400)
            if profile.coupons.count()>=10:return Response({'error':'Dozvoljeno je najviše 10 kupona.'},status=400)
            try:
                with transaction.atomic():AffiliateCoupon.objects.create(affiliate=profile,code=checked.validated_data['code'].upper())
            except IntegrityError:return Response({'error':'Naziv kupona je zauzet.'},status=409)
    return Response({'percent':profile.discount_percent,'coupons':list(profile.coupons.order_by('-created_at').values('code','active'))})


def checkout_discount(request):
    """Server-owned percentage. Explicit coupon or retained first-touch link; no stacking."""
    code=request.data.get('coupon','')
    if not isinstance(code,str):raise ValueError('Neispravan kupon.')
    profile=None
    if code.strip():
        coupon=AffiliateCoupon.objects.select_related('affiliate__user').filter(code=code.strip().upper(),active=True).first()
        if not coupon:raise ValueError('Kupon nije pronađen.')
        profile=coupon.affiliate
    else:
        referral=getattr(request.user,'referral',None)
        if referral:profile=referral.affiliate
        else:
            import time
            from .affiliates import settings_row
            attribution=request.session.get('affiliate_referral',{})
            if time.time()-attribution.get('at',0) <= settings_row().attribution_days*86400:
                profile=AffiliateProfile.objects.filter(pk=attribution.get('id')).select_related('user').first()
    if not profile:return 0
    if not profile.active or not profile.user.is_active or profile.user_id==request.user.pk or profile.discount_percent not in (5,10):
        if code.strip():raise ValueError('Kupon trenutno nije dostupan za ovaj račun.')
        return 0
    return profile.discount_percent
