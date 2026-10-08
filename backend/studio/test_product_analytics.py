import json
from uuid import uuid4
from datetime import timedelta
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from django.core.cache import cache
from django.test import TestCase, Client, RequestFactory, override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from .models import ProductEvent
from .product_analytics import record_server_event, purge_old_events

@override_settings(ACCESS_APPROVAL_REQUIRED=False)
class ProductAnalyticsTests(TestCase):
    def setUp(self):
        cache.clear()
        self.user=get_user_model().objects.create_user(username='viewer')
        self.admin=get_user_model().objects.create_user(username='staff',is_staff=True)
        self.client=Client()

    def event(self,name='style_export',style='prismFold'):
        return {'id':str(uuid4()),'name':name,'page':'captions',**({'style':style} if style else {})}

    def post(self,events,consent=True):
        return self.client.post('/api/analytics/events',data=json.dumps({'consent':consent,'events':events}),content_type='application/json')

    def test_dedup_and_no_consent(self):
        e=self.event()
        self.assertEqual(self.post([e],False).status_code,400)
        self.assertFalse(ProductEvent.objects.exists())
        self.assertEqual(self.post([e]).status_code,200)
        self.post([e]);self.assertEqual(ProductEvent.objects.count(),1)

    def test_no_free_text_and_no_forged_server_events(self):
        e=self.event();e['transcript']='private'
        self.assertEqual(self.post([e]).status_code,400)
        self.assertEqual(self.post([self.event('save_confirmed','')]).status_code,400)
        self.assertEqual(self.post([self.event(style='private file.mp4')]).status_code,400)
        self.assertFalse(ProductEvent.objects.exists())

    def test_staff_excluded_and_dashboard_private(self):
        self.client.force_login(self.admin);self.post([self.event()])
        self.assertFalse(ProductEvent.objects.exists())
        api=APIClient();api.force_authenticate(self.user)
        self.assertEqual(api.get('/api/admin/analytics').status_code,403)
        api.force_authenticate(self.admin)
        self.assertEqual(api.get('/api/admin/analytics?days=7').status_code,200)

    def test_only_exported_styles_count(self):
        self.post([self.event('style_impression'),self.event('style_select'),self.event('palette_select')])
        self.assertFalse(ProductEvent.objects.exists())
        exported=self.event('style_export','prismFold')
        self.post([exported, self.event('style_export','inkImpact'),self.event('style_export','inkImpact')])
        self.post([exported])
        # Old selection records must not influence the ranking after deployment.
        ProductEvent.objects.create(visitor=uuid4(),name='style_select',page='captions',style='oldStyle')
        api=APIClient();api.force_authenticate(self.admin)
        data=api.get('/api/admin/analytics').data
        self.assertEqual([row['style'] for row in data['styles']],['inkImpact','prismFold'])
        self.assertEqual(data['styles'][0]['style_export'],2)
        self.assertEqual(data['styles'][0]['style_export_visitors'],1)
        self.assertEqual(data['styles'][1]['style_export'],1)
        self.assertNotIn('style_select',data['totals'])
        self.assertEqual(len(data['series']),30)

    def test_server_opt_in_dedup(self):
        req=RequestFactory().post('/api/projects');req.user=self.user;req.session={}
        record_server_event(req,'save_confirmed')
        self.assertFalse(ProductEvent.objects.exists())
        req=RequestFactory().post('/api/projects',HTTP_X_PRODUCT_ANALYTICS='1');req.user=self.user;req.session={}
        with self.captureOnCommitCallbacks(execute=True):
            record_server_event(req,'upload_confirmed','asset-1')
            record_server_event(req,'upload_confirmed','asset-1')
        self.assertEqual(ProductEvent.objects.count(),1)
        self.assertEqual(ProductEvent.objects.get().name,'upload_confirmed')

    def test_retention_and_rate_limit(self):
        old=ProductEvent.objects.create(visitor=uuid4(),name='page_view',page='home')
        ProductEvent.objects.filter(pk=old.pk).update(created_at=timezone.now()-timedelta(days=91))
        self.assertEqual(purge_old_events(),1)
        for _ in range(6):self.assertEqual(self.post([self.event() for i in range(40)]).status_code,200)
        self.assertEqual(self.post([self.event()]).status_code,429)

    def test_csrf(self):
        client=Client(enforce_csrf_checks=True)
        self.assertEqual(client.post('/api/analytics/events',data=json.dumps({'consent':True,'events':[self.event()]}),content_type='application/json').status_code,403)
