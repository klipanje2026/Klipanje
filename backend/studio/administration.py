from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Count, Sum
from django.shortcuts import get_object_or_404, redirect
from django.views.decorators.cache import never_cache
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response

from .models import LocalAccount, Project, ImageSpend, NarrationSpend


def entry(request, **kwargs):
    return redirect(settings.ACCOUNT_EMAIL_ORIGIN.rstrip('/') + '/administracija')


def project_payload(project):
    brief = project.brief if isinstance(project.brief, dict) else {}
    return {
        'id': str(project.pk), 'name': project.name, 'ownerId': project.created_by_id,
        'description': brief.get('description', ''), 'style': brief.get('style', ''),
        'scriptCount': project.script_count, 'assetCount': project.asset_count,
        'updatedAt': project.updated_at.isoformat(),
        'usage': project_usage(project),
    }


def project_list():
    return Project.objects.filter(kind='production').annotate(
        script_count=Count('scripts', distinct=True), asset_count=Count('assets', distinct=True))


@never_cache
@api_view(['GET'])
@permission_classes([IsAdminUser])
def overview(request):
    pending = set(LocalAccount.objects.filter(must_change_password=True).values_list('user_id', flat=True))
    return Response({
        'users': [{'id': user.pk, 'name': user.first_name or user.username,
                   'username': user.username, 'isAdmin': user.is_staff, 'isActive': user.is_active,
                   'passwordPending': user.pk in pending,
                   'lastLogin': user.last_login.isoformat() if user.last_login else None}
                  for user in get_user_model().objects.order_by('id')],
        'projects': [project_payload(project) for project in project_list()],
        'usage': image_totals(ImageSpend.objects.all()),
    })


class ProjectDetails(serializers.Serializer):
    name = serializers.CharField(max_length=160)
    description = serializers.CharField(max_length=10000, allow_blank=True)
    style = serializers.ChoiceField(choices=['', 'realistic', 'cinematic', 'cartoon3d', 'chibi',
                                             'cartoon2d', 'anime', 'watercolor', 'comic', 'clay'])


@never_cache
@api_view(['PATCH'])
@permission_classes([IsAdminUser])
def update_project(request, pk):
    data = ProjectDetails(data=request.data)
    data.is_valid(raise_exception=True)
    with transaction.atomic():
        project = get_object_or_404(Project.objects.select_for_update(), pk=pk, kind='production')
        brief = dict(project.brief) if isinstance(project.brief, dict) else {}
        brief.update(description=data.validated_data['description'], style=data.validated_data['style'])
        project.name = data.validated_data['name']
        project.brief = brief
        project.save(update_fields=['name', 'brief', 'updated_at'])
    return Response(project_payload(project_list().get(pk=pk)))


def image_totals(rows):
    return {'images': rows.count(), 'estimatedUsd': float(rows.aggregate(total=Sum('estimated_usd'))['total'] or 0),
            'unpriced': rows.filter(estimated_usd__isnull=True).count()}


def project_usage(project):
    images = image_totals(ImageSpend.objects.filter(project=project))
    # Historical assets have no ledger link. Keep this partial history separate,
    # rather than assigning old account-wide costs to projects by guesswork.
    historical = [a.metadata for a in project.assets.all() if a.content_type.startswith('image/')
                  and a.metadata.get('fullPrompt') and not a.metadata.get('spendId') and not a.metadata.get('localCrop')]
    images['historicalImages'] = len(historical)
    images['historicalUsd'] = sum(float(m.get('estimatedUsd') or 0) for m in historical)
    images['historicalUnpriced'] = sum(m.get('estimatedUsd') is None for m in historical)
    voices = NarrationSpend.objects.filter(project=project)
    totals = voices.aggregate(characters=Sum('characters'), credits=Sum('credits'))
    return {**images, 'narrations': voices.count(), 'characters': totals['characters'] or 0,
            'credits': float(totals['credits'] or 0), 'unknownCredits': voices.filter(credits__isnull=True).count()}
