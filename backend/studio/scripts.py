import hashlib
import json
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import APIException
import math
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from copy import deepcopy
from .models import LocalScript, ProjectChapter, VideoVersion, PreeditorVersion


def storyboard_revision(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


class MontageConflict(APIException):
    status_code = 409
    default_detail = 'Novija montaža je već spremljena. Ovaj stariji tab je ne smije prepisati. Ponovo otvori video za nastavak iz spremljene verzije.'


class ScriptSerializer(serializers.ModelSerializer):
    storyboardRevision = serializers.SerializerMethodField()
    preeditorPlan = serializers.JSONField(write_only=True, required=False)
    backupStoryboard = serializers.BooleanField(write_only=True, required=False, default=False)
    expectedStoryboardRevision = serializers.CharField(write_only=True, required=False)
    expectedScriptUpdatedAt = serializers.DateTimeField(write_only=True, required=False)

    def get_storyboardRevision(self, instance):
        return storyboard_revision(instance.storyboard)

    def update(self, instance, validated_data):
        plan = validated_data.pop('preeditorPlan', None)
        backup = validated_data.pop('backupStoryboard', False)
        expected = validated_data.pop('expectedStoryboardRevision', None)
        expected_script = validated_data.pop('expectedScriptUpdatedAt', None)
        with transaction.atomic():
            current = LocalScript.objects.select_for_update().get(pk=instance.pk)
            if expected_script is not None and current.updated_at != expected_script:
                raise MontageConflict('Skripta je u međuvremenu promijenjena. Osvježi sadržaj prije spremanja.')
            if plan is not None and expected_script is None:
                raise MontageConflict('Preeditor zahtijeva provjeru posljednje spremljene verzije.')
            if 'photo_settings' in validated_data:
                # Cached settings from other pages never own the preeditor.
                incoming = {**validated_data['photo_settings']}
                incoming.pop('preeditor', None)
                if 'preeditor' in current.photo_settings:
                    incoming['preeditor'] = deepcopy(current.photo_settings['preeditor'])
                validated_data['photo_settings'] = incoming
            if plan is not None:
                previous = current.photo_settings.get('preeditor')
                if previous != plan:
                    latest = current.preeditor_versions.first()
                    if previous and (not latest or latest.plan != previous):
                        PreeditorVersion.objects.create(script=current, plan=previous)
                    PreeditorVersion.objects.create(script=current, plan=plan)
                validated_data['photo_settings'] = {**validated_data.get('photo_settings', current.photo_settings), 'preeditor':plan}
            if 'storyboard' in validated_data and current.storyboard.get('editor') == 'edita':
                if expected != storyboard_revision(current.storyboard):
                    raise MontageConflict()
            if backup and 'storyboard' in validated_data and current.storyboard.get('editor') == 'edita':
                VideoVersion.objects.create(script=current, title='Prije preeditora · '+timezone.localtime().strftime('%d.%m.%Y %H:%M'), snapshot=video_snapshot(current))
            if validated_data.get('storyboard', {}).get('editor') == 'edita':
                validated_data['storyboard'] = {**validated_data['storyboard'], 'savedAt': timezone.now().isoformat()}
            return super().update(current, validated_data)

    def create(self, validated_data):
        plan = validated_data.pop('preeditorPlan', None)
        if plan is not None:
            validated_data['photo_settings'] = {**validated_data.get('photo_settings', {}), 'preeditor':plan}
        validated_data.pop('backupStoryboard', None)
        validated_data.pop('expectedStoryboardRevision', None)
        validated_data.pop('expectedScriptUpdatedAt', None)
        return super().create(validated_data)

    content = serializers.CharField(max_length=100000, allow_blank=True, trim_whitespace=False)

    class Meta:
        model = LocalScript
        fields = ['id', 'project', 'chapter', 'title', 'content', 'segments', 'image_prompt', 'photo_settings', 'storyboard', 'created_at', 'updated_at', 'storyboardRevision', 'expectedStoryboardRevision', 'expectedScriptUpdatedAt', 'backupStoryboard', 'preeditorPlan']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_project(self, project):
        if project.created_by_id != self.context['request'].user.pk or project.kind != 'production':
            raise serializers.ValidationError('Odaberi svoj projekat.')
        if self.instance and self.instance.project_id != project.pk:
            raise serializers.ValidationError('Skripta ostaje u svom projektu.')
        return project

    def validate(self, attrs):
        chapter = attrs.get('chapter', self.instance.chapter if self.instance else None)
        project = attrs.get('project', self.instance.project if self.instance else None)
        if chapter and (not project or chapter.project_id != project.pk or chapter.project.created_by_id != self.context['request'].user.pk):
            raise serializers.ValidationError({'chapter':'Chapter mora pripadati odabranom projektu.'})
        return attrs

    def validate_segments(self, segments):
        if not isinstance(segments, list) or len(segments) > 1000:
            raise serializers.ValidationError('Najviše 1000 intervala po skripti.')
        seen, previous_end = set(), 0
        for item in segments:
            if not isinstance(item, dict):
                raise serializers.ValidationError('Neispravan interval.')
            identifier, start, end = item.get('id'), item.get('start'), item.get('end')
            if not isinstance(identifier, str) or not identifier or len(identifier)>64 or identifier in seen:
                raise serializers.ValidationError('Svaki interval treba jedinstveni identifikator.')
            if any(isinstance(value,bool) or not isinstance(value,(int,float)) or not math.isfinite(value) for value in [start,end]):
                raise serializers.ValidationError('Vrijeme mora biti broj sekundi.')
            if start<previous_end or end<=start or end>21600:
                raise serializers.ValidationError('Intervali moraju ići redom, bez preklapanja, do 6 sati.')
            if not isinstance(item.get('text',''),str) or len(item.get('text',''))>10000 or not isinstance(item.get('prompt',''),str) or len(item.get('prompt',''))>10000:
                raise serializers.ValidationError('Tekst intervala je predugačak.')
            seen.add(identifier); previous_end=end
        return segments

    def validate_storyboard(self, value):
        if not isinstance(value,dict) or len(json.dumps(value))>2*1024**2:
            raise serializers.ValidationError('Timeline je prevelik ili neispravan.')
        return value

    def validate_image_prompt(self, value):
        if len(value)>15000:
            raise serializers.ValidationError('Zajednički prompt je predugačak.')
        return value

    def validate_preeditorPlan(self, value):
        if not isinstance(value, dict) or value.get('version') != 1 or not isinstance(value.get('blocks'), list) or len(json.dumps(value)) > 500000:
            raise serializers.ValidationError('Neispravan raspored preeditora.')
        return value

    def validate_photo_settings(self, value):
        if not isinstance(value,dict) or len(json.dumps(value))>500000:
            raise serializers.ValidationError('Postavke fotografija su prevelike ili neispravne.')
        return value


class ScriptViewSet(viewsets.ModelViewSet):
    serializer_class = ScriptSerializer
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        queryset = LocalScript.objects.filter(owner=self.request.user, project__created_by=self.request.user)
        project = self.request.query_params.get('project')
        if project:
            project=serializers.UUIDField().run_validation(project)
            queryset=queryset.filter(project_id=project)
        return queryset

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    @action(detail=True, methods=['get'], url_path='preeditor-versions')
    def preeditor_versions(self, request, pk=None):
        script = self.get_object()
        return Response([{'id':str(v.pk), 'created_at':v.created_at, 'plan':v.plan} for v in script.preeditor_versions.all()[:50]])

    @action(detail=True, methods=['get', 'post'])
    def versions(self, request, pk=None):
        script = self.get_object()
        if request.method == 'GET':
            return Response([{'id':str(v.pk), 'title':v.title, 'created_at':v.created_at} for v in script.video_versions.all()])
        with transaction.atomic():
            script = LocalScript.objects.select_for_update().get(pk=script.pk)
            if request.data.get('expectedStoryboardRevision') != storyboard_revision(script.storyboard):
                raise MontageConflict()
            if script.storyboard.get('editor') != 'edita':
                raise serializers.ValidationError('Prvo spremi video.')
            title = request.data.get('title') or f"Verzija {script.video_versions.count()+1}"
            if not isinstance(title, str) or len(title)>160:
                raise serializers.ValidationError('Naziv verzije je predugačak.')
            version = VideoVersion.objects.create(script=script, title=title, snapshot=video_snapshot(script))
        return Response({'id':str(version.pk), 'title':version.title, 'created_at':version.created_at}, status=201)

    @action(detail=True, methods=['post'], url_path=r'versions/(?P<version_id>[^/.]+)/restore')
    def restore_version(self, request, pk=None, version_id=None):
        script = self.get_object()
        with transaction.atomic():
            script = LocalScript.objects.select_for_update().get(pk=script.pk)
            if request.data.get('expectedStoryboardRevision') != storyboard_revision(script.storyboard):
                raise MontageConflict()
            version = get_object_or_404(VideoVersion, pk=version_id, script=script)
            # Keep the current edit as a recoverable checkpoint before explicit restore.
            if script.storyboard.get('editor') == 'edita':
                VideoVersion.objects.create(script=script, title='Prije otvaranja verzije · '+timezone.localtime().strftime('%d.%m.%Y %H:%M'), snapshot=video_snapshot(script))
            for field in VIDEO_SNAPSHOT_FIELDS:
                if field in version.snapshot:
                    setattr(script, field, deepcopy(version.snapshot[field]))
            script.storyboard = {**script.storyboard, 'savedAt':timezone.now().isoformat()}
            script.save()
        return Response(self.get_serializer(script).data)


VIDEO_SNAPSHOT_FIELDS = ('content', 'segments', 'image_prompt', 'photo_settings', 'storyboard')

def video_snapshot(script):
    return {field:deepcopy(getattr(script, field)) for field in VIDEO_SNAPSHOT_FIELDS}


class ChapterSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectChapter
        fields = ['id', 'project', 'title']
        read_only_fields = ['id']
    def validate_project(self, project):
        if project.created_by_id != self.context['request'].user.pk or project.kind != 'production':
            raise serializers.ValidationError('Odaberi svoj projekat.')
        if self.instance and project.pk != self.instance.project_id:
            raise serializers.ValidationError('Chapter ostaje u svom projektu.')
        return project

class ChapterViewSet(viewsets.ModelViewSet):
    serializer_class = ChapterSerializer
    http_method_names = ['get','post','patch','head','options']
    def get_queryset(self):
        return ProjectChapter.objects.filter(project__created_by=self.request.user)
