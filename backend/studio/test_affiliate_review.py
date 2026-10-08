from uuid import uuid4
from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from .models import AffiliateProfile, AffiliateVisit, AffiliateCorrection, AffiliateAudit, AffiliateLink

@override_settings(ACCESS_APPROVAL_REQUIRED=False)
class AffiliateReviewTests(TestCase):
    def setUp(self):
        self.admin=get_user_model().objects.create_user('reviewer',is_staff=True)
        self.partner=get_user_model().objects.create_user('partner')
        self.other=get_user_model().objects.create_user('other')
        self.profile=AffiliateProfile.objects.create(user=self.partner)
        self.client=APIClient();self.client.force_authenticate(self.admin)
        self.url=f'/api/admin/affiliates/{self.partner.pk}/corrections'
        self.day=str(timezone.localdate())
        AffiliateVisit.objects.create(affiliate=self.profile,visitor=uuid4(),day=self.day,campaign='ig')

    def propose(self,delta=-1):
        data={'id':str(uuid4()),'day':self.day,'campaign':'ig','metric':'visits','delta':delta,'reason':'Duplicate visit'}
        response=self.client.post(self.url,data,format='json')
        self.assertEqual(response.status_code,200)
        return data

    def decide(self,data,status='approved',expected='pending'):
        return self.client.post(self.url+'/'+data['id'],{'status':status,'expectedStatus':expected,'reason':'Verified by administrator'},format='json')

    def dashboard(self):
        return self.client.get(f'/api/admin/affiliates/{self.partner.pk}/dashboard').data

    def test_pending_approve_reverse_and_original_preserved(self):
        data=self.propose()
        self.assertEqual(self.dashboard()['totals']['visits'],1)
        self.assertEqual(self.decide(data).status_code,200)
        report=self.dashboard()
        self.assertEqual(report['totals']['visits'],0)
        self.assertEqual(report['rawTotals']['visits'],1)
        self.assertEqual(report['series'][-1]['visits'],0)
        self.assertEqual(report['campaigns'][0]['visits'],0)
        self.assertEqual(AffiliateVisit.objects.count(),1)
        self.assertEqual(self.decide(data,'rejected','approved').status_code,200)
        self.assertEqual(self.dashboard()['totals']['visits'],1)
        self.assertEqual(AffiliateAudit.objects.count(),3)
        self.assertEqual(self.dashboard()['audit'][0]['actor'],'reviewer')

    def test_negative_prevention_and_retry(self):
        data=self.propose(-2)
        self.assertEqual(self.decide(data).status_code,400)
        data=self.propose()
        self.client.post(self.url,data,format='json')
        self.assertEqual(AffiliateCorrection.objects.count(),2)
        self.decide(data);self.decide(data)
        self.assertEqual(self.dashboard()['totals']['visits'],0)
        self.assertEqual(AffiliateAudit.objects.filter(action='correction_decided').count(),1)

    def test_audit_never_leaks_and_mutations_private(self):
        data=self.propose();self.decide(data)
        AffiliateLink.objects.create(affiliate=self.profile,slug='previous-link',is_primary=False)
        AffiliateLink.objects.create(affiliate=self.profile,slug='current-link',is_primary=True)
        self.client.force_authenticate(self.partner)
        own=self.client.get('/api/affiliate/dashboard').data
        self.assertEqual([link['slug'] for link in own['links']],['current-link'])
        self.assertNotIn('audit',own);self.assertNotIn('rawTotals',own)
        self.assertNotIn('Duplicate visit',str(own))
        self.assertEqual(own['totals']['visits'],0)
        self.assertEqual(self.client.get(self.url).status_code,403)
        self.assertEqual(self.client.post(self.url,data,format='json').status_code,403)
        self.assertEqual(self.decide(data).status_code,403)

    def test_stale_review_and_cross_profile(self):
        data=self.propose();self.decide(data,'rejected')
        self.assertEqual(self.decide(data).status_code,409)
        AffiliateProfile.objects.create(user=self.other)
        self.assertEqual(self.client.post(f'/api/admin/affiliates/{self.other.pk}/corrections/'+data['id'],{'status':'approved','expectedStatus':'rejected','reason':'test'},format='json').status_code,404)
