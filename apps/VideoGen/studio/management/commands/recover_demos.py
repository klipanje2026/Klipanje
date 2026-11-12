from django.core.management.base import BaseCommand
from django.utils import timezone
from studio.models import Job

class Command(BaseCommand):
    help = 'Mark interrupted LOCAL demos as failed before a fresh server startup. Never changes paid jobs.'

    def handle(self, *args, **options):
        count = Job.objects.filter(mode='demo', status__in=['queued','running']).update(status='failed', finished_at=timezone.now(), error='Lokalni server je ponovo pokrenut. Demo možeš ponoviti bez GPU troška.')
        if count:
            self.stdout.write(f'Oporavljeno {count} prekinutih lokalnih demo poslova.')
