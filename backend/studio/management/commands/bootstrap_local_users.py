import secrets
from pathlib import Path
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from studio.models import LocalAccount, Membership, Workspace


class Command(BaseCommand):
    help = 'Create Abdullah and Rijad on this computer with unique temporary passwords; existing accounts stay intact.'

    def add_arguments(self, parser):
        parser.add_argument('--users', nargs='+', default=['Abdullah', 'Rijad'])
        parser.add_argument('--credentials-file', type=Path,
                            default=settings.BASE_DIR.parent / '.local' / 'pocetne-prijave.txt')

    @transaction.atomic
    def handle(self, *args, **options):
        entries = []
        for username in options['users']:
            if get_user_model().objects.filter(username__iexact=username).exists():
                continue
            password = secrets.token_urlsafe(12)
            user = get_user_model().objects.create_user(username=username, first_name=username, password=password)
            LocalAccount.objects.create(user=user, must_change_password=True)
            workspace = Workspace.objects.create(name=f'{username} — projekti')
            Membership.objects.create(user=user, workspace=workspace, role='owner')
            entries.append(f'Korisničko ime: {username}\nPrivremena lozinka: {password}\n')
        if entries:
            destination = options['credentials_file'].resolve()
            destination.parent.mkdir(parents=True, exist_ok=True)
            with destination.open('a', encoding='utf-8') as output:
                output.write('Klipanje — prijave na ovom računaru\nObavezna promjena lozinke pri prvom ulasku.\n\n' + '\n'.join(entries) + '\n')
            self.stdout.write(self.style.SUCCESS(f'Novi racuni su spremni. Privremene prijave: {destination}'))
        else:
            self.stdout.write('Racuni vec postoje. Njihove lozinke nisu promijenjene.')
