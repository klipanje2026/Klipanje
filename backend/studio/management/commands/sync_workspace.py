from pathlib import Path
from django.conf import settings
from django.core.management.base import BaseCommand
from studio.local_workspace import sync_project
from studio.models import Project


class Command(BaseCommand):
    help = 'Refresh private local project copies without changing source data.'

    def handle(self, **options):
        if not settings.LOCAL_WORKSPACE_ROOT:
            return
        root = Path(settings.LOCAL_WORKSPACE_ROOT)
        for name in ('Abdullah', 'Rijad', 'Nihad'):
            (root / name).mkdir(parents=True, exist_ok=True)
        for pk in Project.objects.values_list('pk', flat=True):
            sync_project(pk)
        self.stdout.write('Lokalni workspace je osvježen.')
