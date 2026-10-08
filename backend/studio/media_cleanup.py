"""Durable deletion queue; a storage outage must not lose the object key."""
import logging
from datetime import timedelta
from django.conf import settings
from django.core.files.storage import default_storage
from django.db import transaction
from django.db.models.signals import pre_delete
from django.dispatch import receiver
from django.utils import timezone
from .models import MediaAsset, PendingMediaDeletion

logger = logging.getLogger(__name__)

def process_deletion(pk):
    with transaction.atomic():
        item = PendingMediaDeletion.objects.select_for_update().filter(pk=pk, backend=settings.STORAGE_BACKEND).first()
        if not item:
            return
        if MediaAsset.objects.filter(file=item.name).exists():
            # The last remaining reference will enqueue the same key again.
            item.delete()
            return
        try:
            default_storage.delete(item.name)
        except Exception as exc:
            item.attempts += 1
            item.last_error = type(exc).__name__[:100]
            item.next_attempt_at = timezone.now() + timedelta(minutes=min(60, 2 ** min(item.attempts, 6)))
            item.save(update_fields=['attempts', 'last_error', 'next_attempt_at'])
            logger.warning('Media cleanup deferred: %s', item.last_error)
        else:
            item.delete()

@receiver(pre_delete, sender=MediaAsset)
def enqueue_media_deletion(sender, instance, **kwargs):
    if not instance.file.name:
        return
    item, _ = PendingMediaDeletion.objects.get_or_create(name=instance.file.name, backend=settings.STORAGE_BACKEND)
    transaction.on_commit(lambda pk=item.pk: process_deletion(pk), robust=True)
