from django.db import transaction
from django.db.models import Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from .models import AffiliateProfile, AffiliateCorrection, AffiliateAudit, AffiliateReward

class NewCorrection(serializers.Serializer):
    id=serializers.UUIDField()
    day=serializers.DateField()
    campaign=serializers.RegexField(r'^[a-zA-Z0-9_-]{1,48}$',required=False,allow_blank=True,default='')
    metric=serializers.ChoiceField(choices=['visits','registrations','purchases'])
    delta=serializers.IntegerField(min_value=-100000,max_value=100000)
    reason=serializers.CharField(min_length=3,max_length=500)
    def validate_day(self,value):
        if value>timezone.localdate():raise serializers.ValidationError('Datum ne može biti u budućnosti.')
        return value
    def validate_delta(self,value):
        if not value:raise serializers.ValidationError('Unesi promjenu različitu od nule.')
        return value

class Decision(serializers.Serializer):
    status=serializers.ChoiceField(choices=['approved','rejected'])
    expectedStatus=serializers.ChoiceField(choices=['pending','approved','rejected'])
    reason=serializers.CharField(min_length=3,max_length=500)

def value_for(profile,row):
    if row.metric=='visits':raw=profile.visit_events.filter(day=row.day,campaign=row.campaign).count()
    elif row.metric=='registrations':raw=profile.referrals.filter(created_at__date=row.day,campaign=row.campaign).count()
    else:raw=AffiliateReward.objects.filter(referral__affiliate=profile,created_at__date=row.day,referral__campaign=row.campaign).count()
    return raw+(profile.corrections.filter(day=row.day,campaign=row.campaign,metric=row.metric,status='approved').aggregate(total=Sum('delta'))['total'] or 0)

def serialize(row):
    return {'id':str(row.pk),'day':row.day,'campaign':row.campaign,'metric':row.metric,'delta':row.delta,'reason':row.reason,'status':row.status,'actor':row.created_by.username,'at':row.created_at}

@api_view(['GET','POST'])
@permission_classes([IsAdminUser])
def corrections(request,user_id):
    with transaction.atomic():
        profile=get_object_or_404(AffiliateProfile.objects.select_for_update(),user_id=user_id)
        if request.method=='POST':
            checked=NewCorrection(data=request.data);checked.is_valid(raise_exception=True);data=checked.validated_data
            row=AffiliateCorrection.objects.filter(pk=data['id']).first()
            if row:
                if row.affiliate_id!=profile.pk or any(getattr(row,k)!=v for k,v in data.items() if k!='id'):
                    return Response({'error':'Ovaj zahtjev je već upotrijebljen za drugu korekciju.'},status=409)
            else:
                row=AffiliateCorrection.objects.create(affiliate=profile,created_by=request.user,**data)
                AffiliateAudit.objects.create(affiliate=profile,actor=request.user,action='correction_created',detail=str(row.pk),changes={'reason':row.reason,'metric':row.metric,'delta':row.delta,'day':str(row.day),'campaign':row.campaign,'status':'pending'})
        rows=profile.corrections.select_related('created_by').order_by('-created_at')[:200]
        return Response({'items':[serialize(row) for row in rows]},headers={'Cache-Control':'no-store'})

@api_view(['POST'])
@permission_classes([IsAdminUser])
def decide(request,user_id,pk):
    checked=Decision(data=request.data);checked.is_valid(raise_exception=True);data=checked.validated_data
    with transaction.atomic():
        profile=get_object_or_404(AffiliateProfile.objects.select_for_update(),user_id=user_id)
        row=get_object_or_404(AffiliateCorrection.objects.select_for_update(),pk=pk,affiliate=profile)
        if row.status==data['status']:return Response({'item':serialize(row)})
        if row.status!=data['expectedStatus']:return Response({'error':'Drugi administrator je promijenio ovu korekciju. Osvježi pregled.'},status=409)
        before=value_for(profile,row)
        after=before+(-row.delta if row.status=='approved' else 0)+(row.delta if data['status']=='approved' else 0)
        if after<0:return Response({'error':'Rezultat bi bio negativan. Provjeri datum, kampanju i ranije korekcije.'},status=400)
        old=row.status;row.status=data['status'];row.save(update_fields=['status'])
        AffiliateAudit.objects.create(affiliate=profile,actor=request.user,action='correction_decided',detail=str(row.pk),changes={'reason':data['reason'],'from':old,'to':row.status,'before':before,'after':after,'metric':row.metric,'day':str(row.day),'campaign':row.campaign})
    return Response({'item':serialize(row)})
