import base64, hashlib, hmac, secrets, time
from urllib.parse import urlencode
import httpx
from django.conf import settings
from django.contrib.auth import get_user_model, login
from django.db import transaction, IntegrityError
from django.http import JsonResponse, HttpResponseRedirect
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_GET, require_POST
from .models import SocialIdentity, Workspace, Membership

PROVIDERS=('google','facebook','linkedin','microsoft','twitter')
OAUTH={
 'google':('https://accounts.google.com/o/oauth2/v2/auth','https://oauth2.googleapis.com/token','https://openidconnect.googleapis.com/v1/userinfo','openid email profile'),
 'linkedin':('https://www.linkedin.com/oauth/v2/authorization','https://www.linkedin.com/oauth/v2/accessToken','https://api.linkedin.com/v2/userinfo','openid profile email'),
 'microsoft':('https://login.microsoftonline.com/common/oauth2/v2.0/authorize','https://login.microsoftonline.com/common/oauth2/v2.0/token','https://graph.microsoft.com/oidc/userinfo','openid profile email'),
 'twitter':('https://x.com/i/oauth2/authorize','https://api.x.com/2/oauth2/token','https://api.x.com/2/users/me','tweet.read users.read'),
}

def credentials(provider):
    return (getattr(settings,provider.upper()+'_CLIENT_ID',''),getattr(settings,provider.upper()+'_CLIENT_SECRET','')) if provider in PROVIDERS else ('','')
def redirect_uri(provider):return settings.SOCIAL_AUTH_BASE_URL+f'/api/auth/social/{provider}/callback'
def failure(code):return HttpResponseRedirect('/login?social_error='+code)

@never_cache
@require_GET
def providers(request):
    return JsonResponse({'providers':[{'id':p,'enabled':all(credentials(p))} for p in PROVIDERS]})

@never_cache
@csrf_protect
@require_POST
def start(request,provider):
    client,secret=credentials(provider)
    if not client or not secret:return JsonResponse({'error':'Ova prijava još nije povezana. Koristi korisničko ime i lozinku.'},status=503)
    state=secrets.token_urlsafe(32)
    request.session['social_state']={'value':state,'provider':provider,'created':time.time(),'link_user':request.user.pk if request.user.is_authenticated else None}
    endpoint=OAUTH[provider][0] if provider in OAUTH else f'https://www.facebook.com/{settings.FACEBOOK_GRAPH_VERSION}/dialog/oauth'
    params={'client_id':client,'redirect_uri':redirect_uri(provider),'response_type':'code','scope':OAUTH[provider][3] if provider in OAUTH else 'public_profile,email','state':state}
    if provider in ('google','microsoft','twitter'):
        verifier=secrets.token_urlsafe(48)
        request.session['social_state']={**request.session['social_state'],'verifier':verifier}
        params.update(code_challenge=base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b'=').decode(),code_challenge_method='S256')
    return JsonResponse({'url':endpoint+'?'+urlencode(params)})

def identity(provider,code,verifier=None):
    client,secret=credentials(provider)
    with httpx.Client(timeout=20) as http:
        endpoint=OAUTH[provider][1] if provider in OAUTH else f'https://graph.facebook.com/{settings.FACEBOOK_GRAPH_VERSION}/oauth/access_token'
        fields={'client_id':client,'client_secret':secret,'redirect_uri':redirect_uri(provider),'code':code,'grant_type':'authorization_code'}
        if verifier: fields['code_verifier']=verifier
        options={}
        if provider=='twitter':
            fields.pop('client_secret');options['auth']=(client,secret)
        response=http.post(endpoint,data=fields,**options)
        response.raise_for_status();token=response.json()['access_token']
        if provider in OAUTH:
            profile=http.get(OAUTH[provider][2],headers={'Authorization':'Bearer '+token})
        else:
            proof=hmac.new(secret.encode(),token.encode(),hashlib.sha256).hexdigest()
            profile=http.get(f'https://graph.facebook.com/{settings.FACEBOOK_GRAPH_VERSION}/me',headers={'Authorization':'Bearer '+token},params={'fields':'id,name,email','appsecret_proof':proof})
        profile.raise_for_status();data=profile.json()
    if provider=='twitter': data=data['data']
    subject=data.get('sub') if provider in ('google','linkedin','microsoft') else data.get('id')
    if not isinstance(subject,str) or not subject or len(subject)>255:raise ValueError('Missing subject')
    # Email is a contact attribute; never use it to silently link an existing account.
    email=data.get('email','') if provider!='google' or data.get('email_verified') is True else ''
    return subject,str(data.get('name') or provider.title())[:150],str(email)[:254]

@never_cache
@require_GET
def callback(request,provider):
    saved=request.session.pop('social_state',None)
    if not saved or saved.get('provider')!=provider or not secrets.compare_digest(str(saved.get('value','')),request.GET.get('state','')) or not 0<=time.time()-saved.get('created',0)<=600:return failure('expired')
    if request.GET.get('error'):return failure('cancelled')
    code=request.GET.get('code','')
    if not code or len(code)>4096 or not all(credentials(provider)):return failure('unavailable')
    try:
        subject,name,email=identity(provider,code,saved.get('verifier'))
        with transaction.atomic():
            existing=SocialIdentity.objects.select_related('user').filter(provider=provider,subject=subject).first()
            link_user=saved.get('link_user')
            if link_user:
                if not request.user.is_authenticated or request.user.pk!=link_user:return failure('expired')
                if existing and existing.user_id!=link_user:return failure('linked')
                SocialIdentity.objects.get_or_create(provider=provider,subject=subject,defaults={'user':request.user})
                return HttpResponseRedirect('/opcije')
            if existing:user=existing.user
            else:
                if email and get_user_model().objects.filter(email__iexact=email).exists():return failure('existing')
                user=get_user_model().objects.create_user(username=provider+'_'+secrets.token_hex(10),first_name=name,email=email)
                SocialIdentity.objects.create(provider=provider,subject=subject,user=user)
                workspace=Workspace.objects.create(name=name[:100]+' — projekti');Membership.objects.create(workspace=workspace,user=user,role='owner')
                from .billing import account
                from .affiliates import attribute_signup
                account(user);attribute_signup(request,user)
        if not user.is_active:return failure('inactive')
        from .access import allowed,request_access
        if not allowed(user):request_access(user);return failure('pending')
        login(request,user,backend='django.contrib.auth.backends.ModelBackend')
        from .account_email import queue
        queue(user,'login','Edita — nova prijava','Zabilježena je nova prijava preko vanjskog računa. Ako to nisi bio ti, kontaktiraj podršku.')
        return HttpResponseRedirect('/titlovi')
    except (httpx.HTTPError,ValueError,KeyError,TypeError,IntegrityError):return failure('unavailable')
