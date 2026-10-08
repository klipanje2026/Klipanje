import copy
import hashlib
import hmac
import json
import time
from datetime import timedelta
from unittest.mock import patch
from uuid import uuid4
from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from .billing import account, reserve, settle
from .models import StripeAccount, StripeInvoice, StripeEvent, TokenEntry, Subscription
from . import stripe_payments as payments


@override_settings(DEBUG=True, STRIPE_TEST_ENABLED=True, STRIPE_SECRET_KEY='sk_test_fixture',
    STRIPE_WEBHOOK_SECRET='whsec_fixture', STRIPE_BASIC_PRICE_ID='price_fixture',
    STRIPE_RETURN_ORIGIN='http://127.0.0.1:5175', ACCESS_APPROVAL_REQUIRED=False)
class StripePaymentTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username='buyer', password='Testing-only!21')
        self.other = get_user_model().objects.create_user(username='otherbuyer')
        account(self.user)
        self.profile = StripeAccount.objects.create(user=self.user, customer_id='cus_fixture')
        self.client = APIClient(); self.client.force_authenticate(self.user)
        start = int(time.time()) - 60; end = start + 30 * 86400
        self.remote = {'id':'sub_fixture', 'customer':'cus_fixture', 'livemode':False, 'status':'active',
            'created':start, 'metadata':{'edita_user_id':str(self.user.pk)}, 'cancel_at_period_end':False,
            'items':{'data':[{'price':{'id':'price_fixture'}, 'quantity':1,
                             'current_period_start':start, 'current_period_end':end}]}}
        self.invoice = {'id':'in_fixture', 'customer':'cus_fixture', 'livemode':False, 'status':'paid',
            'amount_paid':2000, 'currency':'usd', 'billing_reason':'subscription_create',
            'parent':{'subscription_details':{'subscription':'sub_fixture'}},
            'lines':{'has_more':False, 'data':[{'pricing':{'price_details':{'price':'price_fixture'}},
                        'quantity':1, 'period':{'start':start,'end':end}}]}}

    def deliver(self, event_id='evt_fixture', kind='invoice.paid', ident='in_fixture', **changes):
        event={'id':event_id,'type':kind,'livemode':False,'data':{'object':{'id':ident}},**changes}
        body=json.dumps(event).encode();stamp=str(int(time.time()))
        sig=hmac.new(b'whsec_fixture',stamp.encode()+b'.'+body,hashlib.sha256).hexdigest()
        with patch.object(payments,'retrieve',side_effect=lambda resource, ident: copy.deepcopy(self.invoice if resource=='invoices' else self.remote)):
            return self.client.post('/api/payments/webhook',body,content_type='application/json',HTTP_STRIPE_SIGNATURE=f't={stamp},v1={sig}')

    def test_payment_grants_once_even_with_different_event_ids(self):
        self.assertEqual(self.deliver().status_code,200)
        op=reserve(self.user,'titlovi',7,uuid4());settle(op,True)
        self.assertEqual(self.deliver().status_code,200)
        self.assertEqual(self.deliver('evt_duplicate').status_code,200)
        self.assertEqual(account(self.user).remaining,93)
        self.assertEqual(StripeInvoice.objects.count(),1)
        self.assertEqual(TokenEntry.objects.filter(user=self.user,kind='plan').count(),1)

    def test_forged_or_stale_or_live_webhook_cannot_grant(self):
        self.assertEqual(self.client.post('/api/payments/webhook',{},format='json').status_code,400)
        self.assertEqual(self.deliver(livemode=True).status_code,400)
        with self.assertRaises(ValueError):payments.verify_event(b'{}','t=1,v1=no')
        self.assertEqual(account(self.user).remaining,5)
        self.assertEqual(StripeEvent.objects.count(),0)

    def test_unpaid_or_wrong_customer_or_metadata_cannot_grant(self):
        for number, change in enumerate(({'status':'open'}, {'amount_paid':0}, {'customer':'cus_other'})):
            original=copy.deepcopy(self.invoice);self.invoice.update(change)
            self.assertEqual(self.deliver(f'evt_case{number}').status_code,200)
            self.invoice=original
        self.remote['metadata']['edita_user_id']=str(self.other.pk)
        self.assertEqual(self.deliver('evt_metadata').status_code,200)
        self.assertEqual(account(self.user).remaining,5)

    def test_reserved_operation_defers_grant_and_keeps_event_retryable(self):
        op=reserve(self.user,'titlovi',2,uuid4())
        self.assertEqual(self.deliver().status_code,503)
        self.assertFalse(StripeEvent.objects.exists())
        settle(op,False)
        self.assertEqual(self.deliver().status_code,200)
        self.assertEqual(account(self.user).remaining,100)

    def test_renewal_resets_quota_and_old_invoice_does_not_roll_back(self):
        self.deliver();old=copy.deepcopy(self.invoice)
        op=reserve(self.user,'titlovi',7,uuid4());settle(op,True)
        end=self.invoice['lines']['data'][0]['period']['end']
        self.invoice['id']='in_renewal';self.invoice['billing_reason']='subscription_cycle'
        self.invoice['lines']['data'][0]['period']={'start':end,'end':end+30*86400}
        item=self.remote['items']['data'][0];item.update(current_period_start=end,current_period_end=end+30*86400)
        with patch('studio.stripe_payments.timezone.now',return_value=timezone.now()+timedelta(days=30)):
            self.assertEqual(self.deliver('evt_renewal',ident='in_renewal').status_code,200)
            self.assertEqual(account(self.user).remaining,100)
            self.invoice=old;self.invoice['id']='in_late'
            self.assertEqual(self.deliver('evt_late',ident='in_late').status_code,200)
            self.assertEqual(account(self.user).remaining,100)
        self.assertEqual(StripeInvoice.objects.filter(granted=True).count(),2)

    def test_cancel_at_end_preserves_access_but_deleted_ends_it(self):
        self.deliver();self.remote['cancel_at_period_end']=True
        self.deliver('evt_updated','customer.subscription.updated','sub_fixture')
        self.assertTrue(account(self.user).cancelled)
        self.assertGreater(account(self.user).paid_until,timezone.now())
        self.remote['status']='canceled'
        self.deliver('evt_deleted','customer.subscription.deleted','sub_fixture')
        self.assertLessEqual(account(self.user).paid_until,timezone.now())

    def test_failed_renewal_does_not_add_tokens_and_late_failure_uses_current_status(self):
        self.deliver();self.remote['status']='past_due'
        self.deliver('evt_failed','invoice.payment_failed')
        self.assertEqual(account(self.user).remaining,100)
        self.assertEqual(StripeAccount.objects.get(user=self.user).status,'past_due')
        self.remote['status']='active'
        self.deliver('evt_oldfailure','invoice.payment_failed')
        self.assertEqual(StripeAccount.objects.get(user=self.user).status,'active')

    def test_checkout_uses_server_price_and_reuses_open_session(self):
        price={'active':True,'livemode':False,'unit_amount':2000,'currency':'usd','recurring':{'interval':'month','interval_count':1}}
        session={'id':'cs_test_fixture','status':'open','url':'https://checkout.stripe.com/c/pay/cs_test_fixture'}
        with patch.object(payments,'retrieve',return_value=price),patch.object(payments,'api',return_value=session) as api:
            result=self.client.post('/api/payments/checkout',{'plan':'standard','tokens':99999,'price':1},format='json')
            self.assertEqual(result.status_code,200)
            self.assertEqual(api.call_args.args[2]['line_items[0][price]'],'price_fixture')
            self.assertEqual(api.call_args.args[2]['customer'],'cus_fixture')
        with patch.object(payments,'retrieve',return_value=session),patch.object(payments,'api') as api:
            self.assertEqual(self.client.post('/api/payments/checkout',{'plan':'standard'},format='json').status_code,200)
            api.assert_not_called()
        self.assertEqual(account(self.user).remaining,5)

    def test_disabled_live_and_csrf_fail_closed(self):
        for config in ({'DEBUG':False},{'STRIPE_SECRET_KEY':'sk_live_no'},{'STRIPE_WEBHOOK_SECRET':''}):
            with self.settings(**config),patch.object(payments,'api') as api:
                self.assertEqual(self.client.post('/api/payments/checkout',{'plan':'standard'},format='json').status_code,503)
                api.assert_not_called()
        client=APIClient(enforce_csrf_checks=True);client.login(username='buyer',password='Testing-only!21')
        self.assertEqual(client.post('/api/payments/checkout',{'plan':'standard'},format='json').status_code,403)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get('/api/payments/status').status_code,403)

    def test_status_is_private_and_return_url_does_not_grant(self):
        self.deliver();self.client.force_authenticate(self.other)
        self.assertFalse(self.client.get(f'/api/payments/status?user_id={self.user.pk}&rezultat=uspjeh').data['confirmed'])
        self.assertEqual(account(self.other).remaining,5)

    def test_cancel_failure_does_not_pretend_subscription_was_cancelled(self):
        self.deliver()
        with patch.object(payments,'api',side_effect=payments.PaymentError('Unavailable')):
            self.assertEqual(self.client.post('/api/subscription/cancel').status_code,503)
        self.assertFalse(account(self.user).cancelled)
        with patch.object(payments,'api',return_value={'cancel_at_period_end':True}) as api:
            self.assertEqual(self.client.post('/api/subscription/cancel').status_code,200)
            self.assertEqual(api.call_args.args[2],{'cancel_at_period_end':'true'})

    def test_provider_failure_rolls_back_receipt_for_retry(self):
        self.invoice['lines']['data'][0]['pricing']['price_details']['price']='price_wrong'
        self.assertEqual(self.deliver().status_code,503)
        self.assertFalse(StripeEvent.objects.exists())
        self.assertEqual(account(self.user).remaining,5)

    @override_settings(STRIPE_ADVANCED_PRICE_ID='price_advanced')
    def test_advanced_grants_200_once(self):
        self.remote['items']['data'][0]['price']['id'] = 'price_advanced'
        self.invoice['lines']['data'][0]['pricing']['price_details']['price'] = 'price_advanced'
        self.invoice['amount_paid'] = 3000
        self.assertEqual(self.deliver().status_code, 200)
        self.assertEqual(self.deliver('evt_repeatadvanced').status_code, 200)
        sub = account(self.user)
        self.assertEqual((sub.plan, sub.remaining, sub.last_price), ('advanced', 200, 30))

    @override_settings(STRIPE_ADVANCED_PRICE_ID='price_advanced')
    def test_advanced_checkout_price_and_cross_plan_guard(self):
        price={'active':True,'livemode':False,'unit_amount':3000,'currency':'usd','recurring':{'interval':'month','interval_count':1}}
        session={'id':'cs_advanced','status':'open','url':'https://checkout.stripe.com/c/pay/cs_advanced','metadata':{'edita_plan':'advanced'}}
        with patch.object(payments,'retrieve',return_value=price),patch.object(payments,'api',return_value=session) as api:
            self.assertEqual(self.client.post('/api/payments/checkout',{'plan':'advanced'},format='json').status_code,200)
            self.assertEqual(api.call_args.args[2]['line_items[0][price]'],'price_advanced')
        with patch.object(payments,'retrieve',return_value=session):
            self.assertEqual(self.client.post('/api/payments/checkout',{'plan':'standard'},format='json').status_code,409)
