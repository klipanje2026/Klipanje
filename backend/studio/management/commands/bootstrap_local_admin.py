import os
from getpass import getpass
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.management.base import BaseCommand, CommandError
from django.core.exceptions import ValidationError
from django.db import transaction
from studio.models import Membership, Workspace


class Command(BaseCommand):
    help = 'Create a local administrator and private project workspace without storing its password in source.'

    def add_arguments(self, parser):
        parser.add_argument('--username', default='Naghun')
        parser.add_argument('--noinput', action='store_true')

    @transaction.atomic
    def handle(self, *args, **options):
        username = options['username']
        password = os.getenv('DJANGO_SUPERUSER_PASSWORD')
        if not password and not options['noinput']:
            password = getpass('Lozinka lokalnog administratora: ')
        if not password:
            raise CommandError('Postavi DJANGO_SUPERUSER_PASSWORD ili pokreni bez --noinput.')
        user, created = get_user_model().objects.get_or_create(username=username)
        try:
            validate_password(password, user)
        except ValidationError as error:
            raise CommandError(' '.join(error.messages)) from error
        user.set_password(password)
        user.is_staff = True
        user.is_superuser = True
        user.is_active = True
        user.first_name = username
        user.save()
        if not user.memberships.exists():
            workspace = Workspace.objects.create(name=f'{username} — projekti')
            Membership.objects.create(user=user, workspace=workspace, role='owner')
        self.stdout.write(self.style.SUCCESS(f'Lokalni administrator {username} i prostor za projekte su spremni.'))
