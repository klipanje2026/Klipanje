from django.db import transaction, IntegrityError
from django.utils import timezone
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from .models import AffiliateRequest, AffiliateProfile, AffiliateAudit, Subscription, TokenEntry, TokenOperation
from .billing import account, payload


class RequestInput(serializers.Serializer):
    first_name = serializers.CharField(max_length=100, required=False)
    last_name = serializers.CharField(max_length=100, required=False)
    email = serializers.EmailField(required=False)
    phone = serializers.RegexField(r'^\+?[0-9() .-]{6,40}$', required=False)

    def validate(self, data):
        if data.get('kind') == 'application':
            missing = [key for key in ('first_name', 'last_name', 'email', 'phone') if not data.get(key)]
            if missing:
                raise serializers.ValidationError({key: 'Obavezno polje.' for key in missing})
        return data

    kind = serializers.ChoiceField(choices=['application', 'tokens'])
    message = serializers.CharField(min_length=5, max_length=2000)
    amount = serializers.IntegerField(min_value=1, max_value=10000, required=False)


def rows(query, admin=False):
    fields = ['id', 'kind', 'message', 'amount', 'granted', 'status', 'created_at', 'resolved_at']
    if admin:
        fields += ['user_id', 'user__username', 'internal_note', 'reviewed_by_id', 'first_name', 'last_name', 'email', 'phone']
    return list(query.order_by('-created_at').values(*fields)[:100])


@api_view(['GET', 'POST'])
def mine(request):
    active = AffiliateProfile.objects.filter(user=request.user, active=True).exists()
    if request.method == 'POST':
        checked = RequestInput(data=request.data)
        checked.is_valid(raise_exception=True)
        data = checked.validated_data
        if (data['kind'] == 'tokens' and not active) or (data['kind'] == 'application' and active):
            return Response({'error': 'Zahtjev nije dostupan za tvoj trenutni affiliate status.'}, status=400)
        if data['kind'] == 'tokens' and 'amount' not in data:
            return Response({'error': 'Unesi broj tokena.'}, status=400)
        try:
            with transaction.atomic():
                AffiliateRequest.objects.create(user=request.user, **data)
        except IntegrityError:
            return Response({'error': 'Već imaš zahtjev koji čeka odluku.'}, status=409)
    return Response({'active': active, 'requests': rows(AffiliateRequest.objects.filter(user=request.user)), 'subscription': payload(account(request.user))}, headers={'Cache-Control': 'no-store'})


class Decision(serializers.Serializer):
    id = serializers.UUIDField()
    approve = serializers.BooleanField()
    amount = serializers.IntegerField(min_value=1, max_value=10000, required=False)
    note = serializers.CharField(min_length=3, max_length=2000)


@api_view(['GET', 'POST'])
@permission_classes([IsAdminUser])
def review(request):
    if request.method == 'POST':
        checked = Decision(data=request.data)
        checked.is_valid(raise_exception=True)
        data = checked.validated_data
        with transaction.atomic():
            item = AffiliateRequest.objects.select_for_update().filter(pk=data['id']).first()
            if not item:
                return Response({'error': 'Zahtjev nije pronađen.'}, status=404)
            if item.status != 'pending':
                return Response({'error': 'Zahtjev je već obrađen.'}, status=409)
            profile = AffiliateProfile.objects.filter(user=item.user).first()
            if data['approve']:
                if not item.user.is_active:
                    return Response({'error': 'Korisnički račun je isključen.'}, status=400)
                if item.kind == 'application':
                    profile, _ = AffiliateProfile.objects.get_or_create(user=item.user)
                    profile.active = True
                    profile.save(update_fields=['active'])
                else:
                    if not profile or not profile.active:
                        return Response({'error': 'Affiliate više nije aktivan.'}, status=400)
                    account(item.user)
                    sub = Subscription.objects.select_for_update().get(user=item.user)
                    if sub.period_end and sub.period_end <= timezone.now():
                        if TokenOperation.objects.filter(user=item.user, status='reserved').exists():
                            return Response({'error': 'Sačekaj završetak aktivne obrade.'}, status=409)
                        sub.remaining = 0
                        sub.allowance = 0
                        sub.used = 0
                        sub.period_start = timezone.now()
                        sub.period_end = None
                        sub.plan = 'free'
                    item.granted = data.get('amount', item.amount)
                    sub.remaining += item.granted
                    sub.allowance += item.granted
                    sub.save()
                    TokenEntry.objects.create(user=item.user, actor=request.user, kind='grant', amount=item.granted, balance_after=sub.remaining, reference=item.id, detail='Affiliate · odobren zahtjev za tokene')
            item.status = 'approved' if data['approve'] else 'rejected'
            item.internal_note = data['note']
            item.reviewed_by = request.user
            item.resolved_at = timezone.now()
            item.save()
            from .account_email import queue
            queue(item.user, 'affiliate_decision', 'Edita — odluka o affiliate zahtjevu', 'Tvoj zahtjev je '+('odobren.' if data['approve'] else 'odbijen.')+' Detalje pogledaj u svom affiliate dashboardu.')
            if profile:
                AffiliateAudit.objects.create(affiliate=profile, actor=request.user, action='request_reviewed', detail=data['note'], changes={'request': str(item.id), 'kind': item.kind, 'status': item.status, 'tokens': item.granted})
    return Response({'requests': rows(AffiliateRequest.objects.select_related('user'), admin=True)}, headers={'Cache-Control': 'no-store'})
