import logging
from django.conf import settings
from django.core.mail import send_mail
from django.core.cache import cache
from django.http import JsonResponse
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from .models import AccessApproval

MESSAGE = 'Tvoj račun čeka odobrenje administratora. Pristup će biti dostupan nakon odobrenja.'

def allowed(user):
    return not settings.ACCESS_APPROVAL_REQUIRED or user.is_staff or AccessApproval.objects.filter(user=user, approved=True).exists()

def request_access(user):
    row, _ = AccessApproval.objects.get_or_create(user=user)
    if not row.approved and not row.notified_at and settings.ACCESS_APPROVAL_EMAIL:
        # Claim notification before sending to avoid mail storms on repeated login.
        now=timezone.now()
        if cache.add(f'approval-mail-{row.pk}',True,60) and AccessApproval.objects.filter(pk=row.pk,notified_at__isnull=True).update(notified_at=now):
            try:
                sent=send_mail('Edita — zahtjev za pristup', f'Korisnik: {user.username}\nEmail: {user.email or "nije unesen"}\nOdobri ili odbij pristup nakon prijave u administraciju:\nhttps://edita.ba/studio', settings.DEFAULT_FROM_EMAIL,[settings.ACCESS_APPROVAL_EMAIL])
                if not sent: raise RuntimeError('Mail not sent')
            except Exception:
                AccessApproval.objects.filter(pk=row.pk,notified_at=now).update(notified_at=None)
                logging.getLogger('edita.requests').warning('approval_notification_failed user_id=%s',user.pk)
                # Admin dashboard remains the reliable queue even when mail is unavailable.
    return row

class ApprovalMiddleware:
    def __init__(self,get_response): self.get_response=get_response
    def __call__(self,request):
        if request.user.is_authenticated and request.path.startswith('/api/') and request.path not in {'/api/auth/logout','/api/auth/csrf','/api/csrf','/api/health'} and not allowed(request.user):
            if request.path=='/api/auth/me': return JsonResponse({'user':None,'workspaces':[],'approvalPending':True})
            return JsonResponse({'error':MESSAGE,'code':'approval_pending'},status=403)
        return self.get_response(request)

@api_view(['POST'])
@permission_classes([IsAdminUser])
def decide(request,user_id):
    value=request.data.get('approved')
    if not isinstance(value,bool): return Response({'error':'Odaberi odobrenje ili opoziv.'},status=400)
    user=get_user_model().objects.filter(pk=user_id,is_staff=False).first()
    if not user:return Response({'error':'Korisnik nije pronađen.'},status=404)
    AccessApproval.objects.update_or_create(user=user,defaults={'approved':value,'approved_by':request.user,'approved_at':timezone.now() if value else None})
    return Response({'approved':value})
