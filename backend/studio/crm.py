from datetime import timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.response import Response
from .models import Booking, Lead, LeadEvent

class LeadInput(serializers.Serializer):
    name = serializers.CharField(max_length=120)
    email = serializers.EmailField(max_length=180)
    company = serializers.CharField(max_length=160)
    service = serializers.CharField(max_length=80)
    phone = serializers.CharField(max_length=80, required=False, allow_blank=True)
    message = serializers.CharField(max_length=3000, required=False, allow_blank=True)
    locale = serializers.ChoiceField(choices=['en', 'de'], default='en')
    consent = serializers.BooleanField()
    landingPage = serializers.CharField(source='landing_page', max_length=500, required=False, allow_blank=True)
    gclid = serializers.CharField(max_length=300, required=False, allow_blank=True)
    utmSource = serializers.CharField(source='utm_source', max_length=160, required=False, allow_blank=True)
    utmMedium = serializers.CharField(source='utm_medium', max_length=160, required=False, allow_blank=True)
    utmCampaign = serializers.CharField(source='utm_campaign', max_length=240, required=False, allow_blank=True)
    def validate_consent(self, value):
        if value is not True:
            raise serializers.ValidationError('Consent required')
        return value

class BookingInput(LeadInput):
    startAt = serializers.DateTimeField(source='start_at')
    timeZone = serializers.CharField(source='time_zone', max_length=100)
    def validate_startAt(self, value):
        if not timezone.now() + timedelta(hours=1) <= value <= timezone.now() + timedelta(days=60):
            raise serializers.ValidationError('Choose a future date within 60 days.')
        return value
    def validate_timeZone(self, value):
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError):
            raise serializers.ValidationError('Unknown time zone')
        return value

def submit(request, booking=False):
    if isinstance(request.data, dict) and request.data.get('website'):
        return Response({'ok': True})
    serializer = (BookingInput if booking else LeadInput)(data=request.data)
    if not serializer.is_valid():
        return Response({'ok': False, 'error': 'validation'}, status=422)
    data = dict(serializer.validated_data)
    if booking:
        start_at, time_zone = data.pop('start_at'), data.pop('time_zone')
    try:
        with transaction.atomic():
            lead = Lead.objects.create(**data, source='booking' if booking else 'website_form', status='meeting' if booking else 'new')
            if booking:
                record = Booking.objects.create(lead=lead, start_at=start_at, time_zone=time_zone, notes=data.get('message', ''))
            LeadEvent.objects.create(lead=lead, event_type='booking_requested' if booking else 'lead_created',
                detail=start_at.isoformat() if booking else 'Website form submitted')
    except IntegrityError:
        if booking:
            return Response({'ok': False, 'error': 'slot_taken'}, status=409)
        raise
    result = {'ok': True, 'leadId': str(lead.pk)}
    if booking:
        result['bookingId'] = str(record.pk)
    return Response(result, status=201)

@api_view(['POST'])
@permission_classes([AllowAny])
def leads(request):
    return submit(request)

@api_view(['POST'])
@permission_classes([AllowAny])
def bookings(request):
    return submit(request, booking=True)

@api_view(['GET', 'PATCH'])
@permission_classes([IsAdminUser])
def studio_leads(request):
    if request.method == 'PATCH':
        serializer = serializers.Serializer(data=request.data)
        serializer.fields['id'] = serializers.UUIDField()
        serializer.fields['status'] = serializers.ChoiceField(choices=['new', 'contacted', 'qualified', 'proposal', 'won', 'lost', 'meeting'])
        serializer.is_valid(raise_exception=True)
        lead = get_object_or_404(Lead, pk=serializer.validated_data['id'])
        with transaction.atomic():
            lead.status = serializer.validated_data['status']
            lead.save(update_fields=['status', 'updated_at'])
            LeadEvent.objects.create(lead=lead, event_type='status_changed', detail=lead.status, actor_email=request.user.email)
        return Response({'ok': True, 'changed': 1})
    rows = []
    for lead in Lead.objects.select_related('booking').order_by('-created_at')[:250]:
        row = {field.name: getattr(lead, field.name) for field in Lead._meta.fields}
        booking = getattr(lead, 'booking', None)
        row.update({'booking_id': booking.pk if booking else None, 'start_at': booking.start_at if booking else None,
                    'time_zone': booking.time_zone if booking else None, 'booking_status': booking.status if booking else None})
        rows.append(row)
    return Response({'leads': rows})
