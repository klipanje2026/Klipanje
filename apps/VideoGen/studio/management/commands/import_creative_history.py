import json
import re
from pathlib import Path
from decimal import Decimal
from uuid import UUID,uuid5,NAMESPACE_URL
from django.core.management.base import BaseCommand
from django.conf import settings
from django.utils.dateparse import parse_datetime
from studio.models import VideoProject,Job,Budget
class Command(BaseCommand):
    def handle(self,*args,**kwargs):
        p,_=VideoProject.objects.get_or_create(name='Test',defaults={'description':'Prethodne generacije i prenesena historija. Nedostajuće datoteke nisu generisani novi rezultati.'})
        Job.objects.filter(project__isnull=True).update(project=p)
        budget,_=Budget.objects.get_or_create(name='creative',defaults={'limit_usd':30})
        data=json.loads((settings.BASE_DIR/'frontend/public/generation-archive.json').read_text(encoding='utf-8-sig'))
        count=0
        for row in data['rows']:
            try:pk=UUID(row['id'])
            except ValueError:pk=uuid5(NAMESPACE_URL,'videogen-archive:'+row['id'])
            dimensions=[int(x) for x in re.findall(r'\d+',row.get('resolution',''))[:2]]
            aspect=('9:16' if dimensions[1]>dimensions[0] else '1:1' if dimensions[1]==dimensions[0] else '16:9') if len(dimensions)==2 else '16:9'
            profile='detail' if dimensions==[864,1536] else 'ultra' if dimensions==[1152,2048] else 'custom' if dimensions==[1024,512] else 'standard'
            existing=Job.objects.filter(pk=pk).first()
            if existing:
                if existing.metrics.get('historical'):
                    existing.metrics={**existing.metrics,'archive_resolution':row.get('resolution',''),'requested_render_profile':profile};existing.aspect=aspect;existing.save(update_fields=['metrics','aspect'])
                continue
            video=row.get('video_url') or ''; ref=row.get('reference_url') or ''
            def media_file(url):
                if not url.startswith('/media/'):return ''
                name=url[len('/media/'):]; target=(Path(settings.MEDIA_ROOT)/name).resolve()
                return name if target.is_relative_to(Path(settings.MEDIA_ROOT).resolve()) and target.is_file() else ''
            job=Job.objects.create(id=pk,project=p,budget=budget,title=row['title'][:120],prompt=row.get('prompt',''),negative_prompt=row.get('negative_prompt',''),model_id=row['model_id'],gpu=row.get('gpu') or 'Nepoznato',placement=row.get('placement') or 'offload',mode=row['mode'],status=row['status'] if row['status'] in ['completed','failed','cancelled'] else 'failed',duration=max(2,int(row.get('duration') or 5)),seed=row.get('seed') or 42,steps=int(str(row.get('steps_label') or '8').split('+')[0]) if str(row.get('steps_label') or '').isdigit() else 8,elapsed_seconds=row.get('elapsed_seconds') or 0,preparation_seconds=row.get('preparation_seconds') or 0,video=media_file(video),reference=media_file(ref),aspect=aspect,metrics={'archive_resolution':row.get('resolution',''),'requested_render_profile':profile,'historical':True,'archive_cost':row.get('cost'),'archive_cost_kind':row.get('cost_kind'),'review':row.get('review') or '','archive_video_missing':bool(video and not media_file(video))})
            created=parse_datetime(row.get('created_at',''))
            if created:Job.objects.filter(pk=pk).update(created_at=created)
            count+=1
        self.stdout.write(f'Imported {count} historical records into Test; no media copied.')
