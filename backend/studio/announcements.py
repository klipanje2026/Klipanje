from django.db import transaction
from django.db.models import Exists, OuterRef, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.cache import never_cache
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from .models import Announcement, AnnouncementDismissal


class AnnouncementInput(serializers.ModelSerializer):
    class Meta:
        model = Announcement
        fields = ['title', 'message', 'tone', 'expires_at']

    def validate_expires_at(self, value):
        if value and value <= timezone.now():
            raise serializers.ValidationError('Odaberi budući datum isteka.')
        return value


def payload(row, admin=False):
    data = {key: getattr(row, key) for key in ['id', 'title', 'message', 'tone', 'version', 'expires_at']}
    if admin:
        data.update(active=row.active, published_at=row.published_at, created_at=row.created_at)
    return data


@never_cache
@api_view(['GET'])
@permission_classes([AllowAny])
def visible(request):
    rows = Announcement.objects.filter(active=True).filter(Q(expires_at__isnull=True) | Q(expires_at__gt=timezone.now()))
    if request.user.is_authenticated:
        dismissed = AnnouncementDismissal.objects.filter(user=request.user, announcement_id=OuterRef('pk'), version=OuterRef('version'))
        rows = rows.annotate(dismissed=Exists(dismissed)).filter(dismissed=False)
    return Response({'items': [payload(row) for row in rows.order_by('-published_at')[:20]]})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def dismiss(request, announcement_id):
    row = get_object_or_404(Announcement, pk=announcement_id)
    if request.data.get('version') != row.version:
        return Response({'error': 'Obavijest je u međuvremenu promijenjena.'}, status=409)
    AnnouncementDismissal.objects.get_or_create(announcement=row, user=request.user, version=row.version)
    return Response({'dismissed': True})


@never_cache
@api_view(['GET', 'POST'])
@permission_classes([IsAdminUser])
def manage(request):
    if request.method == 'GET':
        return Response({'items': [payload(row, True) for row in Announcement.objects.order_by('-created_at')[:100]]})
    serializer = AnnouncementInput(data=request.data)
    serializer.is_valid(raise_exception=True)
    row = serializer.save()
    return Response(payload(row, True), status=201)


@api_view(['POST'])
@permission_classes([IsAdminUser])
def action(request, announcement_id):
    with transaction.atomic():
        row = get_object_or_404(Announcement.objects.select_for_update(), pk=announcement_id)
        action_name = request.data.get('action')
        if action_name == 'publish':
            if row.expires_at and row.expires_at <= timezone.now():
                return Response({'error': 'Ova obavijest je istekla. Pripremi novu poruku.'}, status=400)
            if not row.active:
                row.version += 1
                row.active = True
                row.published_at = timezone.now()
                row.published_by = request.user
        elif action_name == 'hide':
            row.active = False
        else:
            return Response({'error': 'Nepoznata radnja.'}, status=400)
        row.save()
    return Response(payload(row, True))
