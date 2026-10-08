from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone
from studio.models import PendingMediaDeletion
from studio.media_cleanup import process_deletion

class Command(BaseCommand):
    help = 'Retry queued storage deletions. Never scan or delete untracked objects.'

    def handle(self, *args, **options):
        from studio.multipart_upload import cleanup_expired
        cleanup_expired()
        ids = list(PendingMediaDeletion.objects.filter(backend=settings.STORAGE_BACKEND, next_attempt_at__lte=timezone.now()).order_by('next_attempt_at').values_list('pk', flat=True)[:100])
        for pk in ids:
            process_deletion(pk)
