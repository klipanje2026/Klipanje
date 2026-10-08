import time
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import F, Sum
from django.http import HttpResponseRedirect
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework import serializers
from .models import AffiliateProfile, AffiliateSettings, Referral, AffiliateReward, Subscription, TokenEntry, AffiliateAudit

from .billing import paid_access

def settings_row():
    return AffiliateSettings.objects.get_or_create(pk=1)[0]

def visit(request, code):
    profile=AffiliateProfile.objects.filter(code=code,active=True,user__is_active=True).first()
    if profile:
        from .affiliate_dashboard import record_visit
        record_visit(request, profile, campaign=request.GET.get('campaign',''))
    return HttpResponseRedirect('/')


def attribute_signup(request,user):
    value=request.session.pop('affiliate_referral',None)
    if not value or time.time()-value.get('at',0)>settings_row().attribution_days*86400:return
    profile=AffiliateProfile.objects.filter(pk=value.get('id'),active=True,user__is_active=True).exclude(user=user).first()
    if profile and paid_access(profile.user):Referral.objects.get_or_create(user=user,defaults={'affiliate':profile,'campaign':value.get('campaign',''),'link_slug':value.get('slug','')})

def reward_caption_generation(operation, word_count):
    """Retired: affiliate activity no longer awards tokens. Keep old ledger untouched."""
    return


def reward_purchase(purchase):
    """Record a confirmed referred purchase only; never modify token balances."""
    referral=Referral.objects.select_related('affiliate__user').filter(user=purchase.user,affiliate__active=True,affiliate__user__is_active=True).first()
    if not referral or not paid_access(referral.affiliate.user):return
    AffiliateReward.objects.get_or_create(purchase=purchase,defaults={'referral':referral,'tokens':0})

class ConfigInput(serializers.Serializer):
    attributionDays=serializers.IntegerField(min_value=1,max_value=365)

@api_view(['GET','POST'])
@permission_classes([IsAdminUser])
def statistics(request):
    config=settings_row()
    if request.method=='POST':
        checked=ConfigInput(data=request.data);checked.is_valid(raise_exception=True)
        config.enabled=False;config.bonus_tokens=0;config.attribution_days=checked.validated_data['attributionDays'];config.save()
    from .affiliate_dashboard import link_path, report
    profiles=AffiliateProfile.objects.select_related('user').order_by('-created_at')
    rows=[]
    for profile in profiles:
        totals=report(profile,30)['totals']
        rows.append({'userId':profile.user_id,'name':profile.user.first_name or profile.user.username,'active':profile.active,'demo':profile.is_demo,'link':request.build_absolute_uri(link_path(profile)),'visits':totals['visits'],'registrations':totals['registrations'],'purchases':totals['purchases']})
    return Response({'settings':{'attributionDays':config.attribution_days},'affiliates':rows},headers={'Cache-Control':'no-store'})

class RoleInput(serializers.Serializer):
    affiliate=serializers.BooleanField()

@api_view(['POST'])
@permission_classes([IsAdminUser])
def set_role(request,user_id):
    checked=RoleInput(data=request.data);checked.is_valid(raise_exception=True)
    user=get_user_model().objects.filter(pk=user_id).first()
    if not user:return Response({'error':'Korisnik nije pronađen.'},status=404)
    active=checked.validated_data['affiliate']
    profile,_=AffiliateProfile.objects.get_or_create(user=user,defaults={'active':active})
    previous=profile.active
    profile.active=active;profile.save(update_fields=['active'])
    if previous!=active:AffiliateAudit.objects.create(affiliate=profile,actor=request.user,action='status_changed',detail='Affiliate status',changes={'before':previous,'after':active})
    return Response({'affiliate':active,'link':request.build_absolute_uri(f'/api/referrals/{profile.code}')})

class NewAffiliateInput(serializers.Serializer):
    username=serializers.CharField(max_length=150)
    name=serializers.CharField(max_length=150)
    email=serializers.EmailField()
    password=serializers.CharField(write_only=True,min_length=8,max_length=256)

@api_view(['POST'])
@permission_classes([IsAdminUser])
def create_affiliate(request):
    return _create_account(request, affiliate=True)


@api_view(['POST'])
@permission_classes([IsAdminUser])
def create_user(request):
    return _create_account(request, affiliate=False)


def _create_account(request, *, affiliate):
    from django.contrib.auth.password_validation import validate_password
    from django.core.exceptions import ValidationError
    from django.db import IntegrityError
    from .models import Workspace,Membership,AccessApproval
    checked=NewAffiliateInput(data=request.data);checked.is_valid(raise_exception=True);data=checked.validated_data
    if get_user_model().objects.filter(username__iexact=data['username']).exists():
        return Response({'error':'Korisničko ime već postoji.'},status=409)
    user=get_user_model()(username=data['username'],first_name=data['name'],email=data['email'])
    try:
        user.full_clean(exclude=['password']);validate_password(data['password'],user)
        with transaction.atomic():
            user.set_password(data['password']);user.save()
            workspace=Workspace.objects.create(name=data['name'][:100]+' — projekti');Membership.objects.create(user=user,workspace=workspace,role='owner')
            AccessApproval.objects.create(user=user,approved=True,approved_by=request.user)
            from .billing import account
            account(user)
            profile=AffiliateProfile.objects.create(user=user,active=True) if affiliate else None
    except ValidationError as error:return Response({'error':' '.join(error.messages)},status=400)
    except IntegrityError:return Response({'error':'Korisničko ime već postoji.'},status=409)
    return Response({'userId':user.pk,'link':request.build_absolute_uri(f'/api/referrals/{profile.code}') if profile else None},status=201)
