from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from .models import UserFeedback, TokenOperation, TransferUsage


def page_rows(query, request, fields):
    try: page = max(1, min(100000, int(request.query_params.get('page', 1))))
    except (ValueError, TypeError): page = 1
    rows = list(query.order_by('-created_at', '-pk').values(*fields)[(page-1)*25:page*25+1])
    return {'rows': rows[:25], 'page': page, 'hasNext': len(rows)>25}


class FeedbackInput(serializers.Serializer):
    id = serializers.UUIDField()
    category = serializers.ChoiceField(choices=['captions', 'video', 'audio', 'export', 'affiliate', 'other'])
    message = serializers.CharField(min_length=5, max_length=2000)


@api_view(['GET', 'POST'])
def feedback(request):
    if request.method == 'POST':
        checked = FeedbackInput(data=request.data); checked.is_valid(raise_exception=True)
        data = checked.validated_data
        with transaction.atomic():
            # Serialize submissions per account; UUID makes retries safe.
            get_user_model().objects.select_for_update().get(pk=request.user.pk)
            existing = UserFeedback.objects.filter(pk=data['id']).first()
            if existing:
                if existing.user_id != request.user.pk or existing.message != data['message'] or existing.category != data['category']:
                    return Response({'error': 'Zahtjev se razlikuje od prethodnog.'}, status=409)
                return Response({'id': existing.pk, 'status': existing.status})
            if UserFeedback.objects.filter(user=request.user, created_at__gte=timezone.now()-timezone.timedelta(hours=1)).count() >= 10:
                return Response({'error': 'Poslano je previše poruka. Pokušaj kasnije.'}, status=429)
            row = UserFeedback.objects.create(user=request.user, **data)
        return Response({'id': row.pk, 'status': row.status}, status=201)
    return Response(page_rows(UserFeedback.objects.filter(user=request.user), request, ['id','category','message','status','created_at']), headers={'Cache-Control':'no-store'})


@api_view(['GET'])
def usage_history(request):
    kind = request.query_params.get('kind', 'operations')
    if kind == 'transfers':
        result = page_rows(TransferUsage.objects.filter(user=request.user), request, ['id','kind','size','created_at'])
    else:
        result = page_rows(TokenOperation.objects.filter(user=request.user), request, ['id','capability','tokens','status','created_at'])
    return Response(result, headers={'Cache-Control':'no-store'})


@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_feedback(request):
    query = UserFeedback.objects.all()
    if request.query_params.get('status') in ['new','reviewing','resolved']:
        query = query.filter(status=request.query_params['status'])
    return Response(page_rows(query, request, ['id','user_id','user__username','category','message','status','created_at','reviewed_at','reviewed_by__username']), headers={'Cache-Control':'no-store'})


class ReviewInput(serializers.Serializer):
    status = serializers.ChoiceField(choices=['new','reviewing','resolved'])


@api_view(['POST'])
@permission_classes([IsAdminUser])
def review_feedback(request, pk):
    checked = ReviewInput(data=request.data); checked.is_valid(raise_exception=True)
    updated = UserFeedback.objects.filter(pk=pk).update(status=checked.validated_data['status'], reviewed_by=request.user, reviewed_at=timezone.now())
    return Response({'ok':True} if updated else {'error':'Poruka nije pronađena.'}, status=200 if updated else 404)
