from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from studio.models import AccessApproval, AffiliateProfile, AffiliateLink, Workspace, Membership, Subscription, TokenEntry

class Command(BaseCommand):
    help = 'Create a dedicated local affiliate pilot account; never runs against a production database.'
    def handle(self, *args, **options):
        db=settings.DATABASES['default']
        if not settings.DEBUG or db['ENGINE'] != 'django.db.backends.sqlite3':
            raise CommandError('Test account creation requires DEBUG and local SQLite.')
        User=get_user_model()
        with transaction.atomic():
            if User.objects.filter(username__iexact='test_affiliate').exists():
                raise CommandError('test_affiliate already exists; left unchanged.')
            if AffiliateLink.objects.filter(slug='test-affiliate').exists():
                raise CommandError('Test link already exists; left unchanged.')
            user=User.objects.create_user(username='test_affiliate',password='test1234',first_name='Test Affiliate')
            workspace=Workspace.objects.create(name='Test Affiliate · lokalno')
            Membership.objects.create(user=user,workspace=workspace,role='owner')
            AccessApproval.objects.create(user=user,approved=True,approved_at=timezone.now())
            end=timezone.now()+timezone.timedelta(days=30)
            Subscription.objects.create(user=user,plan='partner',allowance=1000,remaining=1000,period_end=end,paid_until=end)
            TokenEntry.objects.create(user=user,kind='grant',amount=1000,balance_after=1000,detail='Lokalni testni affiliate pristup · 30 dana')
            profile=AffiliateProfile.objects.create(user=user)
            AffiliateLink.objects.create(affiliate=profile,slug='test-affiliate',is_primary=True)
        self.stdout.write('Created local test_affiliate with 30-day partner access, workspace and /test-affiliate link. No purchase or visit records generated.')
