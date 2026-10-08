from datetime import datetime
from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4
from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from .models import ProviderUsage
from .provider_usage import provider_call, measure

@override_settings(ACCESS_APPROVAL_REQUIRED=False)
class ProviderUsageTests(TestCase):
    def setUp(self):
        self.user=get_user_model().objects.create_user('customer')
        self.other=get_user_model().objects.create_user('other')
        self.admin=get_user_model().objects.create_user('admin',is_staff=True)
        self.client=APIClient(); self.client.force_authenticate(self.user)
        self.request=SimpleNamespace(user=self.user)
    def test_actual_attempts_record_failures_and_retries_without_content(self):
        key=uuid4()
        for status in [429,200]:
            result=provider_call(self.request,'elevenlabs','transcription',lambda: SimpleNamespace(status_code=status),operation_key=key,input_seconds=12)
            self.assertEqual(result.status_code,status)
        with self.assertRaises(TimeoutError):
            provider_call(self.request,'r2','multipart_part',lambda: (_ for _ in ()).throw(TimeoutError('secret key or filename')),input_bytes=128)
        self.assertEqual(ProviderUsage.objects.count(),3)
        self.assertEqual(ProviderUsage.objects.filter(status='error').count(),2)
        self.assertEqual(ProviderUsage.objects.filter(operation_key=key).count(),2)
        self.assertNotIn('secret',str(list(ProviderUsage.objects.values())))
    def test_logging_failure_does_not_break_provider_call(self):
        with patch('studio.provider_usage.ProviderUsage.objects.create',side_effect=RuntimeError):
            self.assertEqual(provider_call(self.request,'r2','multipart_begin',lambda:'ok'),'ok')
    def test_permissions_ownership_internal_and_hour_drilldown(self):
        for user in [self.user,self.other,self.admin]:
            with measure(SimpleNamespace(user=user),'elevenlabs','narration',input_chars=80) as result:result['status']='success'
        self.assertEqual(self.client.get('/api/admin/usage/providers').status_code,403)
        own=self.client.get('/api/usage/providers?user='+str(self.other.pk)+'&includeInternal=1').data
        self.assertEqual(own['totals']['calls'],1)
        self.assertNotIn('users',own);self.assertNotIn('user__username',own['rows'][0])
        self.client.force_authenticate(self.admin)
        report=self.client.get('/api/admin/usage/providers').data
        self.assertEqual(report['totals']['calls'],2)
        self.assertEqual(sum(x['calls'] for x in report['series']),2)
        self.assertEqual(self.client.get('/api/admin/usage/providers?includeInternal=1').data['totals']['calls'],3)
        hour=timezone.localtime().hour
        filtered=self.client.get(f'/api/admin/usage/providers?hour={hour}&user={self.user.pk}').data
        self.assertEqual(filtered['totals']['calls'],1)
        self.assertEqual(filtered['groups'][0]['inputChars'],80)
    @override_settings(DEBUG=True)
    def test_test_account_excluded_and_paginated(self):
        user=get_user_model().objects.create_user('test_affiliate')
        provider_call(SimpleNamespace(user=user),'r2','multipart_part',lambda: {},input_bytes=5)
        self.assertTrue(ProviderUsage.objects.get().is_test)
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.get('/api/admin/usage/providers').data['totals']['calls'],0)
        for i in range(26):ProviderUsage.objects.create(user=self.user,provider='elevenlabs',action='narration')
        data=self.client.get('/api/admin/usage/providers').data
        self.assertEqual(len(data['rows']),25);self.assertTrue(data['hasNext'])
        self.assertEqual(len(self.client.get('/api/admin/usage/providers?page=2').data['rows']),1)
    def test_sarajevo_day_boundary(self):
        row=ProviderUsage.objects.create(user=self.user,provider='r2',action='asset_upload')
        ProviderUsage.objects.filter(pk=row.pk).update(created_at=timezone.make_aware(datetime(2026,10,7,0,15)))
        data=self.client.get('/api/usage/providers?date=2026-10-07').data
        self.assertEqual(data['totals']['calls'],1);self.assertEqual(data['series'][0]['calls'],1)
        self.assertEqual(self.client.get('/api/usage/providers?date=2026-10-06').data['totals']['calls'],0)
    def test_stream_audio_records_guest_cleanup_and_counts_bytes(self):
        from .ai import stream_audio
        from django.contrib.auth.models import AnonymousUser
        request=SimpleNamespace(user=AnonymousUser(),FILES={})
        upstream=SimpleNamespace(status_code=200,is_success=True,iter_bytes=lambda **kw:iter([b'abc',b'de']),close=lambda:None)
        with patch('studio.ai.httpx.Client') as client:
            client.return_value.send.return_value=upstream
            response=stream_audio('/test','čišćenje govora',tracking_request=request)
            response.close()
        row=ProviderUsage.objects.get()
        self.assertIsNone(row.user_id);self.assertEqual(row.action,'audio_cleanup');self.assertEqual(row.output_bytes,5);self.assertEqual(row.status,'success')

    def test_storage_error_records_status_and_preserves_exception(self):
        from botocore.exceptions import ClientError
        error=ClientError({'Error':{'Code':'Denied'},'ResponseMetadata':{'HTTPStatusCode':403}},'UploadPart')
        with self.assertRaises(ClientError):
            provider_call(self.request,'r2','multipart_part',lambda: (_ for _ in ()).throw(error),input_bytes=100)
        self.assertEqual(ProviderUsage.objects.get().http_status,403)

    def test_operation_summary_keeps_unlinked_calls_separate_and_filters_calendar(self):
        from .models import AffiliateProfile
        AffiliateProfile.objects.create(user=self.user)
        key=uuid4()
        for size in [10,20,30]:
            ProviderUsage.objects.create(user=self.user,provider='r2',action='multipart_part',operation_key=key,input_bytes=size,status='success')
        for _ in range(2):ProviderUsage.objects.create(user=self.other,provider='r2',action='object_check')
        self.client.force_authenticate(self.admin)
        report=self.client.get('/api/admin/usage/providers').data
        self.assertEqual(len(report['operations']),3)
        grouped=next(row for row in report['operations'] if row['calls']==3)
        self.assertEqual(grouped['storageBytes'],60)
        filtered=self.client.get('/api/admin/usage/providers?audience=affiliates').data
        self.assertEqual(filtered['totals']['calls'],3)
        self.assertEqual(sum(row['calls'] for row in filtered['calendar']),3)
        self.client.force_authenticate(self.other)
        own=self.client.get('/api/usage/providers?audience=affiliates').data
        self.assertEqual(len(own['operations']),2)
        self.assertNotIn('username',own['operations'][0])
        self.assertEqual(sum(row['calls'] for row in own['calendar']),2)
