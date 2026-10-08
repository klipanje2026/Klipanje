from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
from rest_framework.test import APIClient
from .models import AffiliateRequest, AffiliateProfile, TokenEntry
from .billing import account, paid_access, reserve, settle
import uuid


class AffiliateRequestTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user('applicant')
        self.admin = get_user_model().objects.create_user('reviewer', is_staff=True)
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def submit(self, kind='application', **extra):
        return self.client.post('/api/affiliate/requests', {'kind': kind, 'message': 'Promocija na mom kanalu.', **({'first_name':'Test','last_name':'Partner','email':'partner@example.com','phone':'+387 61 123 456'} if kind=='application' else {}), **extra}, format='json')

    def decide(self, item, **extra):
        self.client.force_authenticate(self.admin)
        return self.client.post('/api/admin/affiliate-requests', {'id': str(item.id), 'approve': True, 'note': 'Interna provjera', **extra}, format='json')

    def test_free_application_and_private_review(self):
        self.assertFalse(paid_access(self.user))
        self.assertEqual(self.submit().status_code, 200)
        self.assertEqual(self.submit().status_code, 409)
        item = AffiliateRequest.objects.get()
        self.assertEqual(self.decide(item).status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(paid_access(self.user))
        self.assertIsNone(account(self.user).paid_until)
        self.client.force_authenticate(self.user)
        row = self.client.get('/api/affiliate/requests').data['requests'][0]
        self.assertNotIn('internal_note', row)
        self.assertEqual(self.client.get('/api/affiliate/dashboard').status_code, 200)

    def test_tokens_only_once_and_spendable(self):
        AffiliateProfile.objects.create(user=self.user)
        self.assertEqual(self.submit('tokens', amount=100).status_code, 200)
        item = AffiliateRequest.objects.get()
        self.assertEqual(self.decide(item, amount=40).status_code, 200)
        self.assertEqual(self.decide(item, amount=40).status_code, 409)
        self.assertEqual(account(self.user).remaining, 45)
        self.assertEqual(TokenEntry.objects.filter(reference=item.id).count(), 1)
        operation = reserve(self.user, 'narration', 6, uuid.uuid4())
        settle(operation, True)
        self.assertEqual(account(self.user).remaining, 39)

    def test_permissions_validation_and_rejection(self):
        self.assertEqual(self.submit('tokens', amount=100).status_code, 400)
        self.assertEqual(self.client.get('/api/admin/affiliate-requests').status_code, 403)
        self.submit()
        self.assertEqual(self.decide(AffiliateRequest.objects.get(), approve=False).status_code, 200)
        self.assertFalse(AffiliateProfile.objects.filter(user=self.user, active=True).exists())
        self.client.force_authenticate(self.user)
        self.assertEqual(self.submit().status_code, 200)
        self.client.force_authenticate(None)
        self.assertIn(self.client.get('/api/affiliate/requests').status_code, [401, 403])

    def test_expired_quota_not_resurrected(self):
        AffiliateProfile.objects.create(user=self.user)
        sub = account(self.user)
        sub.period_end = timezone.now() - timedelta(days=1)
        sub.save()
        self.submit('tokens', amount=20)
        self.decide(AffiliateRequest.objects.get())
        sub.refresh_from_db()
        self.assertEqual(sub.remaining, 20)
        self.assertIsNone(sub.period_end)

    def test_application_requires_contact_and_keeps_it_private(self):
        self.assertEqual(self.client.post('/api/affiliate/requests', {'kind':'application','message':'My channel'}, format='json').status_code,400)
        self.submit()
        own = self.client.get('/api/affiliate/requests').data['requests'][0]
        self.assertNotIn('phone', own)
        self.client.force_authenticate(self.admin)
        review = self.client.get('/api/admin/affiliate-requests').data['requests'][0]
        self.assertEqual(review['phone'], '+387 61 123 456')
