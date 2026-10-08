import time
from datetime import timedelta
from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from .models import AffiliateProfile, AffiliateLink, AffiliateVisit, AffiliateAudit, Referral, Subscription
from .affiliates import attribute_signup
from .affiliate_dashboard import record_visit
from django.test import RequestFactory
from django.contrib.auth.models import AnonymousUser

@override_settings(ACCESS_APPROVAL_REQUIRED=False)
class AffiliateDashboardTests(TestCase):
    def setUp(self):
        self.owner=get_user_model().objects.create_user(username='owner')
        self.other=get_user_model().objects.create_user(username='other')
        self.admin=get_user_model().objects.create_user(username='admin',is_staff=True)
        self.profile=AffiliateProfile.objects.create(user=self.owner)
        Subscription.objects.create(user=self.owner,paid_until=timezone.now()+timedelta(days=10))
        self.client=APIClient();self.client.force_authenticate(self.owner)

    def save(self,slug):
        return self.client.post('/api/affiliate/dashboard',{'slug':slug},format='json')

    def test_aliases_and_collision(self):
        self.assertEqual(self.save('Gogi').status_code,200)
        self.assertEqual(self.save('gogi-new').status_code,200)
        self.assertEqual(AffiliateLink.objects.filter(affiliate=self.profile).count(),2)
        self.assertFalse(AffiliateLink.objects.get(slug='gogi').is_primary)
        self.assertEqual(AffiliateAudit.objects.count(),2)
        self.assertEqual(self.save('gogi').status_code,200)
        p=AffiliateProfile.objects.create(user=self.other)
        AffiliateLink.objects.create(affiliate=p,slug='occupied')
        self.assertEqual(self.save('occupied').status_code,409)
        self.assertEqual(self.save('titlovi').status_code,400)
        self.assertEqual(self.save('../admin').status_code,400)
        self.assertEqual(self.save('gogi').data['path'],'/gogi')

    def test_dashboard_permissions(self):
        self.assertEqual(self.client.get(f'/api/admin/affiliates/{self.owner.pk}/dashboard').status_code,403)
        self.client.force_authenticate(self.admin)
        response=self.client.get(f'/api/admin/affiliates/{self.owner.pk}/dashboard?days=7')
        self.assertEqual(response.status_code,200)
        self.assertEqual(len(response.data['series']),7)
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get('/api/affiliate/dashboard').status_code,403)

    def request(self):
        req=RequestFactory().get('/')
        req.user=AnonymousUser();req.session={}
        return req

    def test_first_touch_dedup_and_campaign_registration(self):
        req=self.request()
        record_visit(req,self.profile,'gogi','instagram')
        record_visit(req,self.profile,'gogi','instagram')
        self.assertEqual(AffiliateVisit.objects.count(),1)
        record_visit(req,self.profile,'gogi','tiktok')
        self.assertEqual(AffiliateVisit.objects.count(),2)
        self.assertEqual(req.session['affiliate_referral']['campaign'],'instagram')
        attribute_signup(req,self.other)
        referral=Referral.objects.get(user=self.other)
        self.assertEqual(referral.campaign,'instagram')
        self.assertEqual(referral.link_slug,'gogi')
        report=self.client.get('/api/affiliate/dashboard').data
        self.assertEqual(report['totals']['visitors'],1)
        self.assertEqual(report['totals']['registrations'],1)

    def test_inactive_and_self_visits_ignored(self):
        req=self.request();req.user=self.owner
        record_visit(req,self.profile)
        self.assertFalse(AffiliateVisit.objects.exists())
        req.user=AnonymousUser();self.profile.active=False
        record_visit(req,self.profile)
        self.assertFalse(AffiliateVisit.objects.exists())

    def test_expired_attribution_not_registered(self):
        req=self.request();req.session['affiliate_referral']={'id':self.profile.pk,'at':time.time()-400*86400}
        attribute_signup(req,self.other)
        self.assertFalse(Referral.objects.exists())

    def test_follow_and_legacy_link(self):
        self.save('gogi');self.save('gogi-new')
        from django.test import Client
        guest=Client()
        self.assertEqual(guest.post('/api/affiliate/links/gogi/follow?campaign=insta').status_code,200)
        self.assertEqual(guest.post('/api/affiliate/links/gogi/follow?campaign=insta').status_code,200)
        self.assertEqual(AffiliateVisit.objects.count(),1)
        self.assertEqual(guest.get('/api/referrals/'+str(self.profile.code)).url,'/')
        self.assertEqual(guest.post('/api/affiliate/links/nonexistent/follow').status_code,404)

    def test_follow_requires_csrf(self):
        self.save('gogi')
        from django.test import Client
        guest=Client(enforce_csrf_checks=True)
        self.assertEqual(guest.post('/api/affiliate/links/gogi/follow').status_code,403)
