import logging
from datetime import timedelta
from django.conf import settings
from django.core import signing
from django.core.mail import send_mail
from django.core.validators import validate_email
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.response import Response
from .models import AccountEmail, UserControls


def deliver(pk):
    row=AccountEmail.objects.get(pk=pk)
    if row.status=='sent':return
    # Local development never pretends that an unconfigured SMTP server sent mail.
    if settings.DEBUG and settings.EMAIL_HOST=='localhost' and settings.EMAIL_BACKEND.endswith('smtp.EmailBackend'):
        return
    if not AccountEmail.objects.filter(pk=pk,status__in=['pending','failed']).update(status='sending'):return
    try:
        if not send_mail(row.subject,row.body,settings.DEFAULT_FROM_EMAIL,[row.recipient]):raise RuntimeError()
        AccountEmail.objects.filter(pk=pk).update(status='sent',sent_at=timezone.now())
    except Exception:
        AccountEmail.objects.filter(pk=pk).update(status='failed')
        logging.getLogger('edita.requests').warning('account_email_failed id=%s',pk)


def queue(user, kind, subject, body, verified=True):
    if not user.email:return None
    if verified and not UserControls.objects.filter(user=user,verified_email=user.email).exists():return None
    if AccountEmail.objects.filter(user=user,kind=kind,created_at__gte=timezone.now()-timedelta(minutes=2)).exists():return None
    row=AccountEmail.objects.create(user=user,recipient=user.email,kind=kind,subject=subject,body=body)
    transaction.on_commit(lambda:deliver(row.pk))
    return row


def verification(user):
    token=signing.dumps({'user':user.pk,'email':user.email},salt='edita-email')
    origin=settings.ACCOUNT_EMAIL_ORIGIN.rstrip('/')
    return queue(user,'verify','Edita — potvrdi email',f'Potvrdi email klikom na link i dugme za potvrdu:\n{origin}/potvrdi-email?token={token}\n\nLink vrijedi 24 sata. Ako nisi tražio registraciju, zanemari poruku.',verified=False)


@api_view(['GET','POST'])
def status(request):
    row,_=UserControls.objects.get_or_create(user=request.user)
    if request.method=='POST':
        email=request.data.get('email',request.user.email)
        try:validate_email(email)
        except (ValidationError,TypeError):return Response({'error':'Unesi ispravan email.'},status=400)
        request.user.email=email.strip();request.user.save(update_fields=['email'])
        verification(request.user)
    latest=AccountEmail.objects.filter(user=request.user,kind='verify').order_by('-created_at').first()
    return Response({'email':request.user.email,'verified':bool(request.user.email and row.verified_email==request.user.email),'delivery':latest.status if latest else None})


@api_view(['POST'])
@permission_classes([AllowAny])
def verify(request):
    try:
        data=signing.loads(request.data.get('token',''),salt='edita-email',max_age=86400)
        user=get_user_model().objects.get(pk=data['user'],email=data['email'],is_active=True)
    except (signing.BadSignature,KeyError,TypeError,ValueError,get_user_model().DoesNotExist):
        return Response({'error':'Link je istekao ili nije važeći.'},status=400)
    UserControls.objects.update_or_create(user=user,defaults={'verified_email':user.email})
    return Response({'verified':True})


@api_view(['GET','POST'])
@permission_classes([IsAdminUser])
def admin_mail(request):
    if request.method=='POST':
        row=AccountEmail.objects.filter(pk=request.data.get('id'),status__in=['pending','failed']).first()
        if not row:return Response({'error':'Poruka nije dostupna za ponovno slanje.'},status=400)
        deliver(row.pk)
    return Response({'configured':not settings.DEBUG or settings.EMAIL_HOST!='localhost' or not settings.EMAIL_BACKEND.endswith('smtp.EmailBackend'),'messages':list(AccountEmail.objects.order_by('-created_at').values('id','user__username','recipient','kind','subject','status','created_at','sent_at')[:100])})


@api_view(['GET'])
@permission_classes([IsAdminUser])
def payments(request):
    from .models import StripeInvoice, StripeEvent
    from .stripe_payments import enabled
    return Response({'testMode':True,'liveEnabled':False,'checkoutEnabled':enabled(),'invoices':list(StripeInvoice.objects.select_related('account__user').order_by('-created_at').values('invoice_id','account__user__username','amount_paid','currency','granted','period_start','period_end','created_at')[:100]),'events':list(StripeEvent.objects.order_by('-processed_at').values('event_id','kind','processed_at')[:20])})
