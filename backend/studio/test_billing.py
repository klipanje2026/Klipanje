from uuid import uuid4
from datetime import timedelta
from unittest.mock import patch
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from .models import Subscription, TokenEntry, PlanRequest
from .billing import account, reserve, settle, CreditError

class BillingTests(TestCase):
    def setUp(self):
        self.user=get_user_model().objects.create_user(username='member',password='Tests-only-pass!57')
        self.admin=get_user_model().objects.create_user(username='operator',is_staff=True)
        self.other=get_user_model().objects.create_user(username='another')
        self.client=APIClient(); self.client.force_authenticate(self.user)

    def activate(self,plan='standard',key=None,**extra):
        return self.client.post(f'/api/admin/users/{self.user.pk}/plan',{'plan':plan,'reason':'Testna aktivacija','operationId':str(key or uuid4()),**extra},format='json')

    def test_catalog_has_exact_packages_and_prices(self):
        self.client.force_authenticate(None)
        result=self.client.get('/api/plans').data
        self.assertEqual([(p['id'],p['tokens'],p['price']) for p in result['plans']],[('free',5,0),('standard',100,20),('advanced',200,30)])
        self.assertFalse(result['checkoutEnabled'])

    def test_admin_four_package_summary_and_affiliate_filter(self):
        from .models import AffiliateProfile
        account(self.user);account(self.other)
        AffiliateProfile.objects.create(user=self.user,active=True)
        self.client.force_authenticate(self.admin)
        data=self.client.get('/api/admin/users?plan=affiliate').data
        self.assertEqual([row['id'] for row in data['users']],[self.user.pk])
        self.assertEqual(set(data['stats']['plans']),{'free','affiliate','standard','advanced'})
        self.assertEqual(data['stats']['plans']['affiliate'],1)
        free=self.client.get('/api/admin/users?plan=free').data
        self.assertNotIn(self.user.pk,[row['id'] for row in free['users']])

    def test_free_granted_once_and_private(self):
        account(self.other); reserve(self.other,'test',3,uuid4())
        first=self.client.get('/api/subscription').data
        self.assertEqual(first['subscription']['remaining'],5)
        self.client.get('/api/subscription')
        self.assertEqual(TokenEntry.objects.filter(user=self.user,kind='grant').count(),1)
        self.assertEqual(len(first['entries']),1)
        self.assertEqual(self.client.get('/api/admin/users').status_code,403)
        self.assertEqual(self.client.get(f'/api/admin/users/{self.other.pk}/history').status_code,403)
        self.assertEqual(self.activate().status_code,403)

    def test_request_does_not_grant_or_charge_tokens(self):
        account(self.user)
        self.assertEqual(self.client.post('/api/subscription/request',{'plan':'annual'},format='json').status_code,201)
        self.assertEqual(self.client.post('/api/subscription/request',{'plan':'loyalty'},format='json').status_code,409)
        self.assertEqual(Subscription.objects.get(user=self.user).remaining,5)

    def test_admin_activation_audited_idempotent_and_monthly(self):
        self.client.force_authenticate(self.admin); key=uuid4()
        response=self.activate(key=key)
        self.assertEqual(response.status_code,200,response.data)
        sub=Subscription.objects.get(user=self.user)
        self.assertEqual(sub.remaining,100)
        self.assertTrue(timedelta(days=27)<sub.period_end-sub.period_start<timedelta(days=32))
        op=reserve(self.user,'test',20,uuid4()); settle(op,True)
        self.assertEqual(self.activate(key=key).status_code,200)
        self.assertEqual(Subscription.objects.get(user=self.user).remaining,80)
        self.assertEqual(TokenEntry.objects.filter(reference=key,actor=self.admin).count(),1)
        self.assertEqual(self.activate('free').status_code,200)
        self.assertEqual(Subscription.objects.get(user=self.user).remaining,0)

    def test_pending_request_cannot_be_approved_twice(self):
        row=PlanRequest.objects.create(user=self.user,plan='standard')
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.activate('standard',requestId=row.pk).status_code,200)
        self.assertEqual(self.activate('standard',requestId=row.pk).status_code,409)

    def test_balance_reservation_prevents_overspend_and_duplicate_calls(self):
        key=uuid4(); op=reserve(self.user,'titlovi',4,key)
        with self.assertRaises(CreditError): reserve(self.user,'titlovi',4,uuid4())
        with self.assertRaises(CreditError): reserve(self.user,'titlovi',1,key)
        settle(op,False); settle(op,False)
        self.assertEqual(Subscription.objects.get(user=self.user).remaining,5)
        success=reserve(self.user,'titlovi',3,uuid4()); settle(success,True); settle(success,True)
        sub=Subscription.objects.get(user=self.user)
        self.assertEqual((sub.remaining,sub.used),(2,3))

    def test_expired_plan_cannot_spend_or_refill_itself(self):
        sub=account(self.user); sub.period_end=timezone.now()-timedelta(seconds=1);sub.save()
        with self.assertRaises(CreditError): reserve(self.user,'test',1,uuid4())
        self.assertEqual(self.client.get('/api/subscription').data['subscription']['remaining'],0)

    def test_ai_calls_fail_closed_during_billing_setup(self):
        with patch('studio.ai.httpx.request') as upstream,patch('studio.ai.stream_audio') as audio:
            for path in ['/api/narration','/api/voice-change']:
                result=self.client.post(path,{},format='json')
                self.assertEqual(result.status_code,403)
                self.assertEqual(result.data['code'],'paid_package_required')
            upstream.assert_not_called();audio.assert_not_called()

    def test_admin_mutation_requires_csrf_for_session_auth(self):
        self.user.is_staff=True;self.user.save()
        client=APIClient(enforce_csrf_checks=True);client.login(username='member',password='Tests-only-pass!57')
        result=client.post(f'/api/admin/users/{self.other.pk}/plan',{'plan':'pro','reason':'No CSRF','operationId':str(uuid4())},format='json')
        self.assertEqual(result.status_code,403)

    def test_regular_user_cannot_select_another_account(self):
        result=self.client.get(f'/api/subscription?user_id={self.other.pk}').data
        self.assertEqual(result['subscription']['remaining'],5)
        self.assertTrue(Subscription.objects.filter(user=self.user).exists())
        self.assertFalse(Subscription.objects.filter(user=self.other).exists())

    def test_customer_never_receives_provider_token(self):
        with self.settings(ELEVENLABS_API_KEY='test'), patch('studio.ai.json_request') as upstream:
            self.assertEqual(self.client.post('/api/transcribe',{},format='json').data,{'proxy':True})
            upstream.assert_not_called()

    def test_partner_quota_and_admin_unlimited(self):
        from .billing import charge_transfer
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.activate('partner').status_code,200)
        sub=account(self.user)
        self.assertEqual(sub.remaining,1000)
        key=uuid4()
        charge_transfer(self.user,'upload',900000000,key)
        charge_transfer(self.user,'upload',900000000,key)
        with self.assertRaises(CreditError): charge_transfer(self.user,'upload',100000001,uuid4())
        charge_transfer(self.user,'export',1000000000,uuid4())
        with self.assertRaises(CreditError): charge_transfer(self.user,'export',1,uuid4())
        charge_transfer(self.admin,'export',9000000000,uuid4())
        result=self.client.get('/api/subscription').data['subscription']
        self.assertTrue(result['unlimited'])
        self.assertIsNone(result['remaining'])

    def test_transcription_charges_minutes_and_refunds_failure(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        from pathlib import Path
        import httpx
        def decode(upload,directory):
            import wave
            path=Path(directory)/'audio.wav'
            with wave.open(str(path),'wb') as audio:
                audio.setnchannels(1);audio.setsampwidth(2);audio.setframerate(1);audio.writeframes(b'\x00\x00'*61)
            return path,61
        def post():
            return self.client.post('/api/transcribe',{'file':SimpleUploadedFile('video.mp4',b'video',content_type='video/mp4'),'operationId':str(uuid4())})
        with self.settings(ELEVENLABS_API_KEY='test'),patch('studio.transcription.decode_audio',side_effect=decode),patch('studio.transcription.httpx.post',return_value=httpx.Response(200,json={'words':[],'text':'Zdravo'})) as upstream:
            self.assertEqual(post().status_code,200)
            self.assertEqual(account(self.user).remaining,3)
            self.assertEqual(account(self.user).used,2)
            from .models import ProviderUsage
            self.assertEqual(ProviderUsage.objects.get().input_seconds,61)
            self.assertEqual(ProviderUsage.objects.get().user_id,self.user.pk)
            upstream.return_value=httpx.Response(500,json={})
            self.assertEqual(post().status_code,502)
            self.assertEqual(account(self.user).remaining,3)
            upstream.return_value=httpx.Response(200,json={'text':'Ok'})
            self.assertEqual(post().status_code,200)
            calls=upstream.call_count
            self.assertEqual(post().status_code,409)
            self.assertEqual(upstream.call_count,calls)

    def test_real_audio_duration_is_decoded_on_server(self):
        import io,wave,tempfile
        from django.core.files.uploadedfile import SimpleUploadedFile
        from .transcription import decode_audio
        data=io.BytesIO()
        with wave.open(data,'wb') as wav:
            wav.setnchannels(1);wav.setsampwidth(2);wav.setframerate(16000);wav.writeframes(b'\x00\x00'*16000)
        with tempfile.TemporaryDirectory() as directory:
            _,duration=decode_audio(SimpleUploadedFile('clip.wav',data.getvalue()),directory)
            self.assertAlmostEqual(duration,1,places=2)

    def test_loyalty_renewal_floor_and_cancellation_reset(self):
        self.client.force_authenticate(self.admin)
        now=timezone.now()
        for month in range(12):
            with patch('studio.billing.timezone.now',return_value=now):
                response=self.activate('loyalty',paymentConfirmed=True)
                self.assertEqual(response.status_code,200,response.data)
                sub=Subscription.objects.get(user=self.user)
                self.assertEqual(sub.last_price,max(10,20-month))
                self.assertEqual(sub.remaining,30)
                self.assertEqual(self.activate('loyalty',paymentConfirmed=True).status_code,409)
            now=sub.paid_until+timedelta(seconds=1)
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.post('/api/subscription/cancel').status_code,200)
        self.client.force_authenticate(self.admin)
        with patch('studio.billing.timezone.now',return_value=now):
            self.assertEqual(self.activate('loyalty',paymentConfirmed=True).status_code,200)
            self.assertEqual(account(self.user).last_price,20)

    def test_annual_refresh_monthly_without_accumulation(self):
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.activate('annual',paymentConfirmed=True).status_code,200)
        sub=account(self.user)
        self.assertEqual(sub.last_price,144)
        end=sub.period_end
        op=reserve(self.user,'titlovi',5,uuid4());settle(op,True)
        with patch('studio.billing.timezone.now',return_value=end+timedelta(seconds=1)):
            self.assertEqual(account(self.user).remaining,30)
            self.assertEqual(account(self.user).used,0)
            self.assertEqual(TokenEntry.objects.filter(user=self.user,kind='grant').count(),2)
        with patch('studio.billing.timezone.now',return_value=sub.paid_until+timedelta(seconds=1)):
            from .billing import paid_access
            self.assertFalse(paid_access(self.user))
            with self.assertRaises(CreditError):reserve(self.user,'titlovi',1,uuid4())

    def test_voice_reservation_charges_only_actual_duration_and_refunds_remainder(self):
        op=reserve(self.user,'glas',5,uuid4())
        settle(op,True,2);settle(op,True,2)
        sub=account(self.user)
        self.assertEqual((sub.remaining,sub.used),(3,2))
        op=reserve(self.user,'glas',3,uuid4())
        with self.assertRaises(CreditError):settle(op,True,4)
        settle(op,False)
        self.assertEqual(account(self.user).remaining,3)

    def test_manual_grant_does_not_unlock_paid_features(self):
        from .billing import paid_access
        self.client.force_authenticate(self.admin)
        self.activate('standard')
        self.assertFalse(paid_access(self.user))
        self.activate('standard',paymentConfirmed=True)
        self.assertTrue(paid_access(self.user))
