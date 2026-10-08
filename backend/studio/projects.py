from .provider_usage import provider_call
from .product_analytics import record_server_event
from uuid import uuid4
from .billing import charge_transfer, CreditError
import json
from pathlib import Path
from django.conf import settings
from django.db import transaction
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from rest_framework import serializers, viewsets
from rest_framework.decorators import api_view
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from .models import MediaAsset, Project, PendingMediaDeletion
from .media_cleanup import process_deletion

class ProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = ['id', 'workspace', 'name', 'kind', 'state', 'brief', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']
    def validate_workspace(self, workspace):
        if not workspace.memberships.filter(user=self.context['request'].user).exists():
            raise ValidationError('Radni prostor nije dostupan.')
        if self.instance and workspace.pk != self.instance.workspace_id:
            raise ValidationError('Premještanje projekta u drugi prostor nije podržano.')
        return workspace
    def validate_state(self, value):
        if not isinstance(value, dict) or len(json.dumps(value)) > 4 * 1024**2:
            raise ValidationError('Projekat mora biti JSON objekt do 4 MB.')
        return value
    def validate_brief(self, value):
        if not isinstance(value,dict) or len(json.dumps(value))>100000:
            raise ValidationError('Opis projekta mora biti objekt do 100 KB.')
        return value

class ProjectViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectSerializer
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']
    def get_queryset(self):
        result = Project.objects.filter(created_by=self.request.user, workspace__memberships__user=self.request.user)
        kind = self.request.query_params.get('kind')
        return result.filter(kind=kind) if kind else result
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
    def perform_update(self, serializer):
        project=serializer.save()
        record_server_event(self.request,"save_confirmed",page="video" if project.kind=="video" else "captions")
    def perform_destroy(self, instance):
        with transaction.atomic():
            instance.delete()

def accessible_project(request, pk):
    return get_object_or_404(Project, pk=pk, created_by=request.user, workspace__memberships__user=request.user)

def asset_payload(asset):
    return {'id': str(asset.pk), 'name': asset.name, 'contentType': asset.content_type,
            'size': asset.size, 'url': f'/api/assets/{asset.pk}/content',
            'previewUrl': None, 'metadata': asset.metadata, 'created_at': asset.created_at}


def asset_metadata(project, value):
    from .models import LocalScript
    if not isinstance(value,dict) or len(json.dumps(value))>50000:
        raise ValidationError('Neispravni podaci datoteke.')
    if value.get('scriptId'):
        identifier=serializers.UUIDField().run_validation(value['scriptId'])
        script = get_object_or_404(LocalScript, pk=identifier, project=project, owner=project.created_by)
        if value.get('segmentId') and not any(segment.get('id')==value['segmentId'] for segment in script.segments):
            raise ValidationError('Interval nije dio odabrane skripte.')
    elif value.get('segmentId'):
        raise ValidationError('Interval mora pripadati skripti.')
    if value.get('purpose','image') not in ['image','reference','narration','audio']:
        raise ValidationError('Neispravna vrsta datoteke.')
    return value

@api_view(['GET', 'POST'])
def assets(request, pk):
    project = accessible_project(request, pk)
    if request.method == 'GET':
        return Response({'assets': [asset_payload(a) for a in project.assets.all()]}, headers={'Cache-Control':'private, no-store'})
    upload = request.FILES.get('file')
    if upload is None:
        return Response({'error': 'Odaberi video, audio ili sliku.'}, status=400)
    if not upload.size or upload.size > settings.MAX_PROJECT_UPLOAD_BYTES:
        return Response({'error': 'Datoteka je prazna ili prelazi dozvoljenu veličinu.'}, status=413)
    allowed = {'.mp4', '.mov', '.webm', '.mkv', '.avi', '.m4v', '.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'}
    suffix = Path(upload.name).suffix.lower()
    image_types = {'.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp'}
    raster_image = suffix in image_types and upload.content_type == image_types[suffix]
    if not raster_image and (suffix not in allowed or not upload.content_type.startswith(('audio/', 'video/'))):
        return Response({'error': 'Podržani su video, audio i PNG, JPG ili WebP slike.'}, status=400)
    try: charge_transfer(request.user,'upload',upload.size,uuid4())
    except CreditError as exc: return Response({'error':str(exc)},status=409)
    asset = MediaAsset(project=project, name=upload.name[:255], content_type=upload.content_type[:100], size=upload.size)
    try:
        asset.metadata = asset_metadata(project, json.loads(request.data.get('metadata','{}')))
    except (ValueError, TypeError):
        return Response({'error':'Neispravni podaci datoteke.'},status=400)
    try:
        provider_call(request, settings.STORAGE_BACKEND, 'asset_upload', lambda: asset.file.save(upload.name, upload, save=False), operation_key=asset.pk, input_bytes=upload.size)
        asset.save()
    except Exception:
        if asset.file.name:
            item, _ = PendingMediaDeletion.objects.get_or_create(name=asset.file.name, backend=settings.STORAGE_BACKEND)
            transaction.on_commit(lambda pk=item.pk: process_deletion(pk), robust=True)
        raise
    record_server_event(request,"upload_confirmed",asset.pk,page="video" if project.kind=="video" else "captions")
    return Response(asset_payload(asset), status=201)

@api_view(['GET'])
def asset_content(request, pk):
    asset = get_object_or_404(MediaAsset, pk=pk, project__created_by=request.user, project__workspace__memberships__user=request.user)
    try:
        response = FileResponse(asset.file.open('rb'), as_attachment=True, filename=asset.name,
                                content_type=asset.content_type)
    except FileNotFoundError as exc:
        raise Http404 from exc
    response['Cache-Control'] = 'private, no-store'
    return response

@api_view(['DELETE'])
def asset_delete(request, pk):
    asset = get_object_or_404(MediaAsset, pk=pk, project__created_by=request.user, project__workspace__memberships__user=request.user)
    with transaction.atomic():
        asset.delete()
    return Response(status=204)
