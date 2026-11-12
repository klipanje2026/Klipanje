import hashlib,json,shutil
from pathlib import Path
from uuid import UUID,uuid5,NAMESPACE_URL
from django.conf import settings
from django.core.management.base import BaseCommand,CommandError
from studio.models import Job
class Command(BaseCommand):
    help='Recover only referenced media from a user-selected local VideoGen media folder. Never reads env or databases.'
    def add_arguments(self,parser):parser.add_argument('--source',required=True)
    def handle(self,*args,**options):
        source=Path(options['source']).resolve();target=Path(settings.MEDIA_ROOT).resolve();target.mkdir(parents=True,exist_ok=True)
        if not source.is_dir() or source==target:raise CommandError('Choose a separate existing media source folder.')
        rows=json.loads((settings.BASE_DIR/'frontend/public/generation-archive.json').read_text(encoding='utf-8-sig'))['rows'];copied=0;linked=0
        for row in rows:
            try:pk=UUID(row['id'])
            except ValueError:pk=uuid5(NAMESPACE_URL,'videogen-archive:'+row['id'])
            job=Job.objects.filter(pk=pk).first()
            if not job:continue
            changed=[]
            for key,field in [('video_url','video'),('reference_url','reference')]:
                url=row.get(key) or ''
                if not url.startswith('/media/'):continue
                name=url[7:];src=(source/name).resolve();dst=(target/name).resolve()
                if not src.is_relative_to(source) or not dst.is_relative_to(target):raise CommandError('Unsafe path in media manifest.')
                if not src.is_file():continue
                if src.suffix.lower() not in ['.mp4','.png','.jpg','.jpeg','.webp']:continue
                digest=hashlib.sha256(src.read_bytes()).hexdigest()
                expected=row.get('video_sha256') if field=='video' else None
                if expected and digest!=expected:raise CommandError(f'Hash mismatch: {name}')
                if dst.exists() and hashlib.sha256(dst.read_bytes()).hexdigest()!=digest:raise CommandError(f'Existing destination differs: {name}')
                if not dst.exists():
                    dst.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(src,dst)
                    if hashlib.sha256(dst.read_bytes()).hexdigest()!=digest:raise CommandError('Copy integrity check failed.')
                    copied+=1
                setattr(job,field,name);changed.append(field)
                if field=='video':linked+=1
            if changed:
                job.metrics={**job.metrics,'archive_video_missing':False if job.video else job.metrics.get('archive_video_missing',False)};job.save(update_fields=changed+['metrics'])
        self.stdout.write(f'Copied {copied} media files; linked {linked} videos. No env, credentials or databases imported.')
