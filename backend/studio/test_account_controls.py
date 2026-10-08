from uuid import uuid4
from django.test import TestCase, override_settings
from django.contrib.auth import get_user_model
from django.core import mail, signing
from rest_framework.test import APIClient
from .models import AffiliateProfile, AffiliateCoupon, UserControls, TokenEntry, AccountEmail
from .billing import account, charge_transfer, CreditError
from .account_email import verification
from .user_controls import checkout_discount
from types import SimpleNamespace


@override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
class AccountControlsTests(TestCase):
    def setUp(self):
        self.user=get_user_model().objects.create_user('member',email='member@example.com')
        self.admin=get_user_model().objects.create_user('admin',is_staff=True)
        self.partner=get_user_model().objects.create_user('partner')
        self.profile=AffiliateProfile.objects.create(user=self.partner,discount_percent=10)
        self.client=APIClient();self.client.force_authenticate(self.admin)

    def test_admin_grant_once_and_upload_download_limits(self):
        body={'upload_limit':1000,'download_limit':2000,'discount_percent':0,'tokens':20,'operation':str(uuid4()),'reason':'Test grant'}
        url=f'/api/admin/users/{self.user.pk}/controls'
        self.assertEqual(self.client.post(url,body,format='json').status_code,200)
        self.assertEqual(self.client.post(url,body,format='json').status_code,409)
        self.assertEqual(account(self.user).remaining,25)
        charge_transfer(self.user,'upload',900,uuid4())
        with self.assertRaises(CreditError):charge_transfer(self.user,'upload',101,uuid4())
        charge_transfer(self.user,'export',1900,uuid4())
        with self.assertRaises(CreditError):charge_transfer(self.user,'export',101,uuid4())
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.post(url,body,format='json').status_code,403)

    def test_coupon_uses_admin_percentage_not_browser(self):
        self.client.force_authenticate(self.partner)
        self.assertEqual(self.client.post('/api/affiliate/coupons',{'code':'MYCODE','percent':99},format='json').status_code,200)
        request=SimpleNamespace(data={'coupon':'mycode','discount':99},user=self.user,session={})
        self.assertEqual(checkout_discount(request),10)
        request.user=self.partner
        with self.assertRaises(ValueError):checkout_discount(request)
        self.profile.active=False;self.profile.save()
        request.user=self.user
        with self.assertRaises(ValueError):checkout_discount(request)

    def test_email_confirmation_bound_to_current_address(self):
        with self.captureOnCommitCallbacks(execute=True):verification(self.user)
        self.assertEqual(len(mail.outbox),1)
        self.assertEqual(AccountEmail.objects.get().status,'sent')
        token=signing.dumps({'user':self.user.pk,'email':self.user.email},salt='edita-email')
        self.client.force_authenticate(None)
        self.assertEqual(self.client.post('/api/account/verify-email',{'token':token},format='json').status_code,200)
        self.assertEqual(UserControls.objects.get(user=self.user).verified_email,self.user.email)
        self.user.email='changed@example.com';self.user.save()
        self.assertEqual(self.client.post('/api/account/verify-email',{'token':token},format='json').status_code,400)
        self.assertEqual(self.client.post('/api/account/verify-email',{'token':'forged'},format='json').status_code,400)
