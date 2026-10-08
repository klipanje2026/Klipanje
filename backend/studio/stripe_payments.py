"""Test-only Stripe billing. All entitlements come from verified server events."""
import hashlib
import hmac
import json
import re
import time
from datetime import datetime, timezone as dt_timezone
from urllib.parse import urlparse
from uuid import NAMESPACE_URL, uuid5

import httpx
from django.conf import settings
from django.db import transaction
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .models import StripeAccount, StripeEvent, StripeInvoice, Subscription, TokenEntry, TokenOperation


class PaymentError(Exception):
    pass


def enabled():
    origin = urlparse(settings.STRIPE_RETURN_ORIGIN)
    return bool(settings.DEBUG and settings.STRIPE_TEST_ENABLED
                and settings.STRIPE_SECRET_KEY.startswith(('sk_test_', 'rk_test_'))
                and settings.STRIPE_WEBHOOK_SECRET.startswith('whsec_')
                and settings.STRIPE_BASIC_PRICE_ID.startswith('price_')
                and origin.scheme == 'http' and origin.hostname in ('localhost', '127.0.0.1')
                and not origin.username and not origin.query and not origin.fragment
                and origin.path in ('', '/'))


def api(method, path, data=None, key=None):
    if not enabled():
        raise PaymentError('Testno plaćanje još nije povezano.')
    headers = {'Authorization': 'Bearer ' + settings.STRIPE_SECRET_KEY,
               'Stripe-Version': '2025-03-31.basil'}
    if key:
        headers['Idempotency-Key'] = str(key)
    try:
        result = httpx.request(method, 'https://api.stripe.com/v1/' + path,
                               data=data, headers=headers, timeout=20)
        result.raise_for_status()
        return result.json()
    except (httpx.HTTPError, ValueError):
        # Never expose provider responses, credentials or customer data.
        raise PaymentError('Stripe trenutno nije dostupan. Pokušaj ponovo.') from None


def object_id(value):
    return value.get('id', '') if isinstance(value, dict) else value or ''


def retrieve(resource, ident):
    if not re.fullmatch(r'[a-z]+_[A-Za-z0-9_]+', str(ident)):
        raise PaymentError('Neispravan Stripe identifikator.')
    return api('GET', resource + '/' + ident)


def checkout_url(value):
    parsed = urlparse(value or '')
    if parsed.scheme != 'https' or parsed.netloc != 'checkout.stripe.com':
        raise PaymentError('Stripe nije vratio ispravnu stranicu plaćanja.')
    return value


@api_view(['POST'])
def checkout(request):
    if not enabled():
        return Response({'error': 'Testno plaćanje još nije povezano.'}, status=503)
    plan = request.data.get('plan')
    prices = {'standard': settings.STRIPE_BASIC_PRICE_ID, 'advanced': settings.STRIPE_ADVANCED_PRICE_ID}
    if plan not in prices or not prices[plan]:
        return Response({'error': 'Odabrani paket još nije povezan za testno plaćanje.'}, status=400)
    from .billing import PLANS
    from .user_controls import checkout_discount
    try: discount = checkout_discount(request)
    except ValueError as exc:return Response({'error':str(exc)},status=400)
    chosen = PLANS[plan]
    price_id = prices[plan]
    from .billing import account
    account(request.user)
    profile, _ = StripeAccount.objects.get_or_create(user=request.user)
    try:
        with transaction.atomic():
            profile = StripeAccount.objects.select_for_update().get(pk=profile.pk)
            local = Subscription.objects.select_for_update().get(user=request.user)
            if local.paid_until and local.paid_until > timezone.now():
                return Response({'error': 'Već imaš aktivan plaćeni period. Otvori Moje tokene.'}, status=409)
            if profile.subscription_id:
                current = retrieve('subscriptions', profile.subscription_id)
                if current['status'] not in ('canceled', 'incomplete_expired'):
                    return Response({'error': 'Pretplata već postoji. Sačekaj potvrdu ili provjeri Moje tokene.'}, status=409)
            if profile.checkout_id:
                previous = retrieve('checkout/sessions', profile.checkout_id)
                if previous['status'] == 'open':
                    if previous.get('metadata', {}).get('edita_plan', 'standard') != plan or str(previous.get('metadata', {}).get('edita_discount', '0')) != str(discount):
                        return Response({'error': 'Već imaš otvoreno plaćanje s drugim paketom ili popustom. Prvo dovrši ili sačekaj istek tog plaćanja.'}, status=409)
                    return Response({'url': checkout_url(previous['url'])})
                if previous['status'] == 'complete' and not profile.subscription_id:
                    return Response({'error': 'Uplata se provjerava. Ne pokreći novu kupovinu.'}, status=409)
                # Deterministic even if an upstream timeout rolls back this transaction.
                profile.checkout_key = uuid5(NAMESPACE_URL, 'edita-checkout:' + previous['id'])
            price = retrieve('prices', price_id)
            if (price.get('livemode') is not False or not price.get('active')
                    or price.get('unit_amount') != chosen['price'] * 100 or price.get('currency') != 'usd'
                    or price.get('recurring', {}).get('interval') != 'month'
                    or price.get('recurring', {}).get('interval_count') != 1):
                raise PaymentError('Testna cijena ne odgovara odabranom mjesečnom paketu.')
            if not profile.customer_id:
                customer = api('POST', 'customers', {'metadata[edita_user_id]': str(request.user.pk)},
                               key='edita-customer-' + str(profile.checkout_key))
                profile.customer_id = customer['id']
            discount_fields={}
            if discount:
                coupon=api('POST','coupons',{'percent_off':str(discount),'duration':'once','name':f'Edita affiliate {discount}%'},key=f'edita-test-affiliate-once-{discount}-v1')
                discount_fields={'discounts[0][coupon]':coupon['id']}
            origin = settings.STRIPE_RETURN_ORIGIN
            session = api('POST', 'checkout/sessions', {
                'customer': profile.customer_id, 'mode': 'subscription',
                'payment_method_types[0]': 'card',
                'line_items[0][price]': price_id,
                'metadata[edita_plan]': plan,
                'metadata[edita_discount]':str(discount),
                **discount_fields,
                'line_items[0][quantity]': '1',
                'client_reference_id': str(request.user.pk),
                'subscription_data[metadata][edita_user_id]': str(request.user.pk),
                'success_url': origin + '/pretplate/kupovina?paket=' + plan + '&rezultat=uspjeh',
                'cancel_url': origin + '/pretplate/kupovina?paket=' + plan + '&rezultat=odustao',
            }, key='edita-checkout-' + str(profile.checkout_key) + ('-advanced' if plan == 'advanced' else '') + (f'-discount{discount}' if discount else ''))
            profile.checkout_id = session['id']
            profile.save()
            return Response({'url': checkout_url(session['url'])})
    except PaymentError as exc:
        return Response({'error': str(exc)}, status=503)


@api_view(['GET'])
def status(request):
    profile = StripeAccount.objects.filter(user=request.user).first()
    grant = StripeInvoice.objects.filter(account=profile, granted=True).order_by('-period_end').first() if profile else None
    local = Subscription.objects.filter(user=request.user).first()
    return Response({'testMode': True, 'enabled': enabled(),
                     'status': profile.status if profile else '',
                     'confirmed': bool(grant and grant.period_end > timezone.now() and local
                                       and local.paid_until and local.paid_until > timezone.now()),
                     'paidUntil': grant.period_end if grant else None}, headers={'Cache-Control': 'no-store'})


def cancel_subscription(user):
    profile = StripeAccount.objects.filter(user=user).first()
    if not profile or not profile.subscription_id:
        return False
    remote = api('POST', 'subscriptions/' + profile.subscription_id, {'cancel_at_period_end': 'true'})
    if not remote.get('cancel_at_period_end') and remote.get('status') != 'canceled':
        raise PaymentError('Otkazivanje još nije potvrđeno. Pokušaj ponovo.')
    return True


def binding(remote):
    """Match a server-created customer and metadata; never trust a browser user ID."""
    if remote.get('livemode') is not False:
        return None
    profile = StripeAccount.objects.select_for_update().filter(customer_id=object_id(remote.get('customer'))).first()
    if not profile or str(profile.user_id) != remote.get('metadata', {}).get('edita_user_id'):
        return None
    if profile.subscription_id and profile.subscription_id != remote['id']:
        # A late event from an older subscription must never replace the new one.
        old = retrieve('subscriptions', profile.subscription_id)
        if old.get('status') not in ('canceled', 'incomplete_expired') or old.get('created', 0) >= remote.get('created', 0):
            return None
    items = remote.get('items', {}).get('data', [])
    if len(items) != 1 or object_id(items[0].get('price')) not in [p for p in (settings.STRIPE_BASIC_PRICE_ID, settings.STRIPE_ADVANCED_PRICE_ID) if p] or items[0].get('quantity') != 1:
        return None
    profile.subscription_id = remote['id']
    profile.status = remote['status']
    profile.save()
    return profile


def sync_subscription(remote):
    profile = binding(remote)
    if not profile:
        return
    local = Subscription.objects.select_for_update().get(user_id=profile.user_id)
    local.cancelled = bool(remote.get('cancel_at_period_end') or remote['status'] == 'canceled')
    if remote['status'] in ('canceled', 'unpaid', 'incomplete_expired', 'paused'):
        now = timezone.now()
        local.paid_until = min(local.paid_until, now) if local.paid_until else None
        local.period_end = min(local.period_end, now) if local.period_end else now
    local.save()


def paid_invoice(invoice):
    subscription_id = object_id(invoice.get('parent', {}).get('subscription_details', {}).get('subscription') or invoice.get('subscription'))
    if not subscription_id or invoice.get('livemode') is not False:
        return
    remote = retrieve('subscriptions', subscription_id)
    profile = binding(remote)
    if not profile or invoice.get('customer') != profile.customer_id:
        return
    if (invoice.get('status') != 'paid' or invoice.get('amount_paid', 0) <= 0
            or invoice.get('currency') != 'usd' or remote['status'] != 'active'
            or invoice.get('billing_reason') not in ('subscription_create', 'subscription_cycle')):
        return
    if StripeInvoice.objects.filter(invoice_id=invoice['id']).exists():
        return
    lines = invoice.get('lines', {})
    if lines.get('has_more') or len(lines.get('data', [])) != 1:
        raise PaymentError('Neočekivane stavke računa; potrebna je provjera.')
    line = lines['data'][0]
    line_price = object_id(line.get('pricing', {}).get('price_details', {}).get('price') or line.get('price'))
    from .billing import PLANS
    price_plans = {settings.STRIPE_BASIC_PRICE_ID: 'standard'}
    if settings.STRIPE_ADVANCED_PRICE_ID: price_plans[settings.STRIPE_ADVANCED_PRICE_ID] = 'advanced'
    plan = price_plans.get(line_price)
    if not plan or line_price != object_id(remote['items']['data'][0].get('price')) or line.get('quantity') != 1:
        raise PaymentError('Račun ne odgovara Basic paketu.')
    start = datetime.fromtimestamp(line['period']['start'], dt_timezone.utc)
    end = datetime.fromtimestamp(line['period']['end'], dt_timezone.utc)
    if end <= start:
        raise PaymentError('Neispravan period računa.')
    local = Subscription.objects.select_for_update().get(user_id=profile.user_id)
    current = remote['items']['data'][0]
    grant = bool(end > timezone.now() and start <= timezone.now()
                 and line['period']['start'] == current.get('current_period_start')
                 and line['period']['end'] == current.get('current_period_end')
                 and (not local.paid_until or end > local.paid_until))
    if grant and TokenOperation.objects.filter(user_id=profile.user_id, status='reserved').exists():
        # Retry after in-flight work settles; never refund old reservations into a new quota.
        raise PaymentError('Obrada je u toku; ponovi potvrdu uplate.')
    StripeInvoice.objects.create(invoice_id=invoice['id'], account=profile, subscription_id=subscription_id,
        amount_paid=invoice['amount_paid'], currency='usd', period_start=start, period_end=end, granted=grant)
    if grant:
        chosen = PLANS[plan]
        local.plan = plan; local.allowance = chosen['tokens']; local.remaining = chosen['tokens']; local.used = 0
        local.period_start = start; local.period_end = end; local.paid_until = end
        local.last_price = chosen['price']; local.loyalty_months = 0
        local.cancelled = bool(remote.get('cancel_at_period_end'))
        local.save()
        purchase = TokenEntry.objects.create(user_id=profile.user_id, kind='plan', amount=chosen['tokens'], balance_after=chosen['tokens'],
            detail=f"Stripe TEST · {chosen['name']} · {chosen['price']} USD · {chosen['tokens']} tokena",
            reference=uuid5(NAMESPACE_URL, 'stripe-test-invoice:' + invoice['id']))
        from .affiliates import reward_purchase
        reward_purchase(purchase)
        from .account_email import queue
        queue(profile.user, 'payment', 'Edita — potvrda testne uplate', f"Stripe testna uplata je potvrđena. Dodijeljeno je {chosen['tokens']} tokena. Ovo nije stvarna naplata.")


def verify_event(body, signature):
    parts = [item.split('=', 1) for item in signature.split(',') if '=' in item]
    timestamps = [value for key, value in parts if key == 't']
    if len(timestamps) != 1 or abs(time.time() - int(timestamps[0])) > 300:
        raise ValueError('Invalid timestamp')
    digest = hmac.new(settings.STRIPE_WEBHOOK_SECRET.encode(), timestamps[0].encode() + b'.' + body, hashlib.sha256).hexdigest()
    if not any(hmac.compare_digest(digest, value) for key, value in parts if key == 'v1'):
        raise ValueError('Invalid signature')
    event = json.loads(body)
    if not isinstance(event, dict) or event.get('livemode') is not False or not re.fullmatch(r'evt_[A-Za-z0-9]+', event.get('id', '')):
        raise ValueError('Invalid event')
    return event


@csrf_exempt
@require_POST
def webhook(request):
    if not enabled():
        return JsonResponse({'error': 'Test billing unavailable'}, status=503)
    if len(request.body) > 512000:
        return JsonResponse({'error': 'Payload too large'}, status=413)
    try:
        event = verify_event(request.body, request.headers.get('Stripe-Signature', ''))
    except (ValueError, TypeError, UnicodeError):
        return JsonResponse({'error': 'Invalid signature or event'}, status=400)
    try:
        with transaction.atomic():
            _, created = StripeEvent.objects.get_or_create(event_id=event['id'], defaults={'kind': event['type']})
            if created:
                obj = event['data']['object']
                if event['type'] == 'invoice.paid':
                    paid_invoice(retrieve('invoices', obj['id']))
                elif event['type'] in ('customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'):
                    sync_subscription(retrieve('subscriptions', obj['id']))
                elif event['type'] == 'invoice.payment_failed':
                    invoice = retrieve('invoices', obj['id'])
                    sid = object_id(invoice.get('parent', {}).get('subscription_details', {}).get('subscription') or invoice.get('subscription'))
                    if sid:
                        sync_subscription(retrieve('subscriptions', sid))
    except (PaymentError, KeyError, TypeError, ValueError):
        # Transaction includes the event receipt: failures remain retryable.
        return JsonResponse({'error': 'Event processing pending; retry'}, status=503)
    return JsonResponse({'received': True})
