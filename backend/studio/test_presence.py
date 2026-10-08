import json,time
from uuid import uuid4
from datetime import timedelta
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase, Client, override_settings
from django.utils import timezone
from .models import VisitorPresence, AffiliateProfile, Referral, Subscription
from .presence import purge_presence

@override_settings(ACCESS_APPROVAL_REQUIRED=False)
class PresenceTests(TestCase):
    def setUp(self):
        cache.clear()
        self.admin=get_user_model().objects.create_user('admin',is_staff=True)
        self.user=get_user_model().objects.create_user('partner')
        self.other=get_user_model().objects.create_user('other')
        self.profile=AffiliateProfile.objects.create(user=self.user)
        Subscription.objects.create(user=self.user,paid_until=timezone.now()+timedelta(days=30))
        self.browser=Client();self.staff=Client();self.staff.force_login(self.admin)
        self.tab=str(uuid4())
    def beat(self,client=None,**changes):
        body=dict(consent=True,tab=self.tab,sequence=1,page='captions',section='styles',source='instagram',visible=True,active=True)
        body.update(changes)
        return (client or self.browser).post('/api/analytics/presence',json.dumps(body),content_type='application/json')
    def report(self):return self.staff.get('/api/admin/analytics/presence').json()
    def test_visible_dedup_hidden_expiry_and_stale_sequence(self):
        self.assertEqual(self.beat().status_code,200)
        self.beat(tab=str(uuid4()),active=False)
        self.assertEqual(self.report()['total'],1);self.assertEqual(self.report()['editorActive'],1)
        self.beat(sequence=3,visible=False)
        self.beat(sequence=2,visible=True)
        report=self.report();self.assertEqual(report['total'],1);self.assertEqual(report['active'],0)
        VisitorPresence.objects.update(seen_at=timezone.now()-timedelta(seconds=91))
        self.assertEqual(self.report()['total'],0)
    def test_consent_and_untrusted_input(self):
        self.assertEqual(self.beat(consent=False).status_code,200)
        self.assertEqual(VisitorPresence.objects.count(),0)
        for fields in [{'page':['captions']},{'section':{}},{'source':'https://private/link'},{'text':'private content'},{'sequence':True},{'consent':'yes'}]:
            self.assertEqual(self.beat(**fields).status_code,400)
        self.beat();self.beat(sequence=3,consent=False);self.beat(sequence=2)
        self.assertEqual(self.report()['total'],0)
    def test_affiliate_attribution_and_private_snapshot(self):
        session=self.browser.session
        session['affiliate_referral']={'id':self.profile.pk,'campaign':'october','at':time.time()};session.save()
        self.beat()
        partner=Client();partner.force_login(self.user)
        self.assertEqual(partner.get('/api/affiliate/presence').status_code,403)
        self.assertEqual(partner.get('/api/affiliate/presence?affiliateUser='+str(self.other.pk)).status_code,403)
        self.assertEqual(partner.get('/api/admin/analytics/presence').status_code,403)
        report=self.staff.get('/api/admin/analytics/presence?affiliateUser='+str(self.user.pk)).json()
        self.assertEqual(report['total'],1)
        self.assertEqual(report['campaigns'][0]['name'],'october')
        unrelated=Client();unrelated.force_login(self.other)
        self.assertEqual(unrelated.get('/api/affiliate/presence').status_code,403)
    def test_expired_attribution_and_registered_referral(self):
        session=self.browser.session;session['affiliate_referral']={'id':self.profile.pk,'at':0};session.save()
        self.beat();self.assertIsNone(VisitorPresence.objects.get().affiliate_id)
        Referral.objects.create(user=self.other,affiliate=self.profile,campaign='registered')
        self.browser.force_login(self.other);self.beat(sequence=2)
        self.assertEqual(VisitorPresence.objects.get().affiliate_id,self.profile.pk)
    @override_settings(DEBUG=True)
    def test_admin_excluded_test_optional_and_csrf(self):
        self.beat(self.staff);self.assertEqual(VisitorPresence.objects.count(),0)
        test=get_user_model().objects.create_user('test_affiliate');self.browser.force_login(test);self.beat()
        self.assertEqual(self.report()['total'],0)
        self.assertEqual(self.staff.get('/api/admin/analytics/presence?includeTest=1').json()['total'],1)
        secure=Client(enforce_csrf_checks=True)
        self.assertEqual(self.beat(secure).status_code,403)
    def test_retention_and_rate_limit(self):
        self.beat()
        VisitorPresence.objects.update(seen_at=timezone.now()-timedelta(hours=25))
        purge_presence();self.assertFalse(VisitorPresence.objects.exists())
        for seq in range(2,61):self.beat(sequence=seq)
        self.assertEqual(self.beat(sequence=61).status_code,429)

    def test_tab_limit_and_source_stability(self):
        self.beat()
        self.beat(sequence=2,source='facebook')
        row=VisitorPresence.objects.get()
        self.assertEqual(row.source,'instagram')
        VisitorPresence.objects.bulk_create([VisitorPresence(visitor=row.visitor,tab=uuid4(),seen_at=timezone.now()) for _ in range(127)])
        self.assertEqual(self.beat(tab=str(uuid4())).status_code,429)
        self.assertEqual(self.beat(sequence=3,consent=False).status_code,200)
