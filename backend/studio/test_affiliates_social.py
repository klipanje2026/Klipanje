from datetime import timedelta
from django.utils import timezone
from .billing import account
import time,uuid
from unittest.mock import patch
from django.test import TestCase,override_settings
from django.contrib.auth import get_user_model
from django.test import Client
from rest_framework.test import APIClient
from .models import AffiliateProfile,AffiliateSettings,Referral,AffiliateReward,Subscription,TokenEntry,SocialIdentity
from .affiliates import attribute_signup,reward_purchase

@override_settings(ACCESS_APPROVAL_REQUIRED=False)
class AffiliateTests(TestCase):
 def setUp(self):
  self.admin=get_user_model().objects.create_user('admin',is_staff=True)
  self.affiliate=get_user_model().objects.create_user('partner')
  self.buyer=get_user_model().objects.create_user('buyer')
  sub=account(self.affiliate);sub.paid_until=timezone.now()+timedelta(days=30);sub.save()
  self.profile=AffiliateProfile.objects.create(user=self.affiliate)
  self.client=APIClient();self.client.force_authenticate(self.admin)
 def test_admin_affiliate_page_route_and_access(self):
  from django.urls import resolve, Resolver404
  self.assertEqual(resolve('/studio/affiliates', urlconf='config.production_urls').func.__name__, 'frontend')
  self.assertEqual(resolve('/studio/affiliates/', urlconf='config.production_urls').func.__name__, 'frontend')
  with self.assertRaises(Resolver404):
   resolve('/studio/private-file', urlconf='config.production_urls')
  self.assertEqual(self.client.get('/api/admin/affiliates').status_code, 200)
 def test_private_statistics_and_role(self):
  self.client.force_authenticate(self.buyer)
  self.assertEqual(self.client.get('/api/admin/affiliates').status_code,403)
  self.assertEqual(self.client.post(f'/api/admin/users/{self.buyer.pk}/affiliate',{'affiliate':True},format='json').status_code,403)
 def test_role_link_and_config(self):
  result=self.client.post(f'/api/admin/users/{self.buyer.pk}/affiliate',{'affiliate':True},format='json')
  self.assertEqual(result.status_code,200);self.assertIn('/api/referrals/',result.data['link'])
  self.assertFalse(self.buyer.is_staff)
  result=self.client.post('/api/admin/affiliates',{'attributionDays':30},format='json');self.assertEqual(result.status_code,200)
  self.assertEqual(self.client.post('/api/admin/affiliates',{'attributionDays':0},format='json').status_code,400)
 def test_first_touch_registration(self):
  visitor=Client();visitor.get(f'/api/referrals/{self.profile.code}');visitor.get(f'/api/referrals/{self.profile.code}')
  self.profile.refresh_from_db();self.assertEqual(self.profile.visits,1)
  from types import SimpleNamespace
  request=SimpleNamespace(session=visitor.session)
  attribute_signup(request,self.buyer)
  self.assertEqual(Referral.objects.get(user=self.buyer).affiliate,self.profile)
  self.assertNotIn('affiliate_referral',request.session)
 def test_expired_and_self_referrals(self):
  from types import SimpleNamespace
  attribute_signup(SimpleNamespace(session={'affiliate_referral':{'id':self.profile.pk,'at':0}}),self.buyer)
  attribute_signup(SimpleNamespace(session={'affiliate_referral':{'id':self.profile.pk,'at':time.time()}}),self.affiliate)
  self.assertEqual(Referral.objects.count(),0)
 def test_confirmed_purchase_only_and_idempotency(self):
  Referral.objects.create(user=self.buyer,affiliate=self.profile)
  AffiliateSettings.objects.create(pk=1,enabled=True,bonus_tokens=12)
  data={'operationId':str(uuid.uuid4()),'plan':'standard','reason':'Testni pristup'}
  self.assertEqual(self.client.post(f'/api/admin/users/{self.buyer.pk}/plan',data,format='json').status_code,200)
  self.assertEqual(AffiliateReward.objects.count(),0)
  data.update(operationId=str(uuid.uuid4()),paymentConfirmed=True)
  for _ in range(2):self.assertEqual(self.client.post(f'/api/admin/users/{self.buyer.pk}/plan',data,format='json').status_code,200)
  self.assertEqual(AffiliateReward.objects.count(),1)
  self.assertEqual(Subscription.objects.get(user=self.affiliate).remaining,5)
  self.assertEqual(TokenEntry.objects.filter(user=self.affiliate,kind='affiliate').count(),0)
 def test_disabled_rewards_still_record_purchase(self):
  Referral.objects.create(user=self.buyer,affiliate=self.profile)
  entry=TokenEntry.objects.create(user=self.buyer,kind='plan',amount=100,balance_after=100)
  reward_purchase(entry);reward_purchase(entry)
  self.assertEqual(AffiliateReward.objects.get().tokens,0)
 def test_create_affiliate_non_admin(self):
  response=self.client.post('/api/admin/affiliates/create',{'username':'newpartner','name':'Partner','email':'p@example.com','password':'Long-Uncommon-Secret-8714'},format='json')
  self.assertEqual(response.status_code,201)
  user=get_user_model().objects.get(username='newpartner');self.assertFalse(user.is_staff);self.assertTrue(user.affiliate.active)

@override_settings(GOOGLE_CLIENT_ID='client',GOOGLE_CLIENT_SECRET='secret',ACCESS_APPROVAL_REQUIRED=False)
class SocialTests(TestCase):
 def state(self,created=None):
  session=self.client.session;session['social_state']={'value':'test-state','provider':'google','created':time.time() if created is None else created};session.save()
 def test_config_and_csrf(self):
  self.assertTrue(self.client.get('/api/auth/social/providers').json()['providers'][0]['enabled'])
  strict=Client(enforce_csrf_checks=True)
  self.assertEqual(strict.post('/api/auth/social/google/start').status_code,403)
 def test_state_and_replay(self):
  self.state()
  with patch('studio.social_auth.identity') as upstream:
   self.assertIn('expired',self.client.get('/api/auth/social/google/callback?state=wrong&code=x').url)
   self.assertFalse(upstream.called)
  self.assertIn('expired',self.client.get('/api/auth/social/google/callback?state=test-state&code=x').url)
 def test_expiry_and_provider_mixup(self):
  self.state(0);self.assertIn('expired',self.client.get('/api/auth/social/google/callback?state=test-state&code=x').url)
  self.state();self.assertIn('expired',self.client.get('/api/auth/social/facebook/callback?state=test-state&code=x').url)
 def test_new_identity_and_existing_login(self):
  self.state()
  with patch('studio.social_auth.identity',return_value=('subject','Someone','person@example.com')):
   response=self.client.get('/api/auth/social/google/callback?state=test-state&code=x')
  self.assertEqual(response.status_code,302);self.assertEqual(SocialIdentity.objects.count(),1)
  user=SocialIdentity.objects.get().user;self.assertFalse(user.has_usable_password());self.assertEqual(user.memberships.count(),1)
 def test_no_automatic_email_link(self):
  get_user_model().objects.create_user('victim',email='person@example.com')
  self.state()
  with patch('studio.social_auth.identity',return_value=('subject','Someone','person@example.com')):
   response=self.client.get('/api/auth/social/google/callback?state=test-state&code=x')
  self.assertIn('existing',response.url);self.assertEqual(SocialIdentity.objects.count(),0)
 def test_inactive_identity_not_logged_in(self):
  user=get_user_model().objects.create_user('inactive',is_active=False);SocialIdentity.objects.create(user=user,provider='google',subject='subject')
  self.state()
  with patch('studio.social_auth.identity',return_value=('subject','Someone','person@example.com')):
   response=self.client.get('/api/auth/social/google/callback?state=test-state&code=x')
  self.assertIn('inactive',response.url);self.assertNotIn('_auth_user_id',self.client.session)

class CaptionGenerationBonusTests(TestCase):
 def test_threshold_idempotency_and_failed_generation(self):
  from .billing import reserve, settle
  from .affiliates import reward_caption_generation
  user=get_user_model().objects.create_user('caption-partner')
  sub=account(user)
  AffiliateProfile.objects.create(user=user,active=True)
  for count in [8,9]:
   op=reserve(user,'titlovi',1,uuid.uuid4())
   reward_caption_generation(op,count)
   self.assertFalse(TokenEntry.objects.filter(reference=op.pk).exists())
   settle(op,True)
   reward_caption_generation(op,count)
   reward_caption_generation(op,count)
   self.assertFalse(TokenEntry.objects.filter(reference=op.pk).exists())
  sub.refresh_from_db()
  self.assertEqual(sub.remaining,3)
  op=reserve(user,'titlovi',1,uuid.uuid4());settle(op,False)
  reward_caption_generation(op,12)
  self.assertFalse(TokenEntry.objects.filter(reference=op.pk).exists())
 def test_no_reward_for_nonaffiliate_or_empty_result(self):
  from .billing import reserve, settle
  from .affiliates import reward_caption_generation
  user=get_user_model().objects.create_user('regular-generator');account(user)
  op=reserve(user,'titlovi',1,uuid.uuid4());settle(op,True)
  reward_caption_generation(op,12)
  self.assertFalse(TokenEntry.objects.filter(reference=op.pk).exists())
  AffiliateProfile.objects.create(user=user,active=True)
  reward_caption_generation(op,0)
  self.assertFalse(TokenEntry.objects.filter(reference=op.pk).exists())
