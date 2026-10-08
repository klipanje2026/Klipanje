import json
import math
from rest_framework import serializers, viewsets
from .models import LocalScript


class ScriptSerializer(serializers.ModelSerializer):
    content = serializers.CharField(max_length=100000, allow_blank=True, trim_whitespace=False)

    class Meta:
        model = LocalScript
        fields = ['id', 'project', 'title', 'content', 'segments', 'image_prompt', 'photo_settings', 'storyboard', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_project(self, project):
        if project.created_by_id != self.context['request'].user.pk or project.kind != 'production':
            raise serializers.ValidationError('Odaberi svoj projekat.')
        if self.instance and self.instance.project_id != project.pk:
            raise serializers.ValidationError('Skripta ostaje u svom projektu.')
        return project

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

    def validate_photo_settings(self, value):
        if not isinstance(value,dict) or len(json.dumps(value))>50000:
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
