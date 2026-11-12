"""Named Modal clients; never changes global active credentials."""
import hashlib,os,re,subprocess,sys,tomllib
from pathlib import Path
from threading import RLock
from urllib.parse import urlparse
from django.conf import settings
from django.db import transaction
from .models import ModalAccount,ModalSelection,BillingSnapshot,Job
_lock=RLock();_clients={};_logins={}
AUTH_MESSAGE='Modal prijava je istekla ili više nije važeća. Otvori Promijeni račun → Obnovi prijavu i prijavi se u isti Modal workspace.'

def credential_fingerprint(credentials):
    return hashlib.sha256((credentials.get('token_id','')+credentials.get('token_secret','')).encode()).hexdigest()

def configured_profiles():
    from modal.config import user_config_path
    try:
        config=tomllib.loads(Path(user_config_path).read_text(encoding='utf-8'))
    except (OSError,ValueError):return {}
    return {name:data for name,data in config.items() if isinstance(data,dict) and data.get('token_id') and data.get('token_secret')}


def ensure_accounts():
    profiles=configured_profiles()
    with transaction.atomic():
        selection,_=ModalSelection.objects.get_or_create(pk=1)
        first=not ModalAccount.objects.exists()
        for name,metadata in profiles.items():
            ModalAccount.objects.get_or_create(profile=name,defaults={'label':name,'monthly_credit':30 if first and (metadata.get('active') or len(profiles)==1) else None})
        if not selection.account_id:
            preferred=next((n for n,m in profiles.items() if m.get('active')),next(iter(profiles),None))
            if preferred:
                selection.account=ModalAccount.objects.get(profile=preferred);selection.save(update_fields=['account'])
                # Existing local history and confirmed billing belong to the previously connected profile.
                Job.objects.filter(modal_account__isnull=True).update(modal_account=selection.account)
                BillingSnapshot.objects.filter(account__isnull=True).update(account=selection.account)
        return selection.account


def account_data(account,profiles=None):
    profiles=configured_profiles() if profiles is None else profiles
    return {'id':account.pk,'label':account.label,'profile':account.profile,'workspace':account.workspace_name,'monthly_credit':float(account.monthly_credit) if account.monthly_credit is not None else None,'configured':account.profile in profiles}


def accounts_state():
    selected=ensure_accounts();profiles=configured_profiles()
    return {'selected_account':selected.pk if selected else None,'accounts':[account_data(a,profiles) for a in ModalAccount.objects.all().order_by('id')]}


def client_for(account):
    import modal
    profiles=configured_profiles();credentials=profiles.get(account.profile)
    if not credentials:raise ValueError('Ovaj Modal profil nije prijavljen. Poveži račun prije generisanja.')
    if credentials.get('server_url') not in [None,'https://api.modal.com']:raise ValueError('Ovaj profil ne koristi službeni Modal server.')
    token_id,secret=credentials['token_id'],credentials['token_secret'];fingerprint=credential_fingerprint(credentials)
    with _lock:
        cached=_clients.get(account.profile)
        if not cached or cached[0]!=fingerprint or cached[1].is_closed():
            try:
                candidate=modal.Client.from_credentials(token_id,secret)
                if account.workspace_name:
                    workspace=modal.Workspace.from_context(client=candidate)
                    workspace.hydrate()
                    name=workspace.name
                    actual=name() if callable(name) else name
                    if actual!=account.workspace_name:
                        raise ValueError(f'Prijavljen je drugi workspace. Za obnovu ovog računa odaberi {account.workspace_name}; postojeći budžet nije promijenjen.')
                _clients[account.profile]=(fingerprint,candidate)
            except modal.exception.AuthError:raise ValueError(AUTH_MESSAGE) from None
        return _clients[account.profile][1]


def job_client(job):
    return client_for(job.modal_account) if job.modal_account_id else None


def start_login(profile,label,credit,renew=False):
    if not re.fullmatch(r'[A-Za-z0-9_-]{1,40}',profile):raise ValueError('Naziv profila koristi samo slova, brojeve, crticu i donju crtu.')
    profiles=configured_profiles()
    if profile in profiles and not renew:raise ValueError('Ovaj profil je već povezan; odaberi ga na listi.')
    with _lock:
        if any(item['process'].poll() is None for item in _logins.values()):raise ValueError('Jedna prijava već traje. Dovrši je u pregledniku.')
        if renew:account=ModalAccount.objects.get(profile=profile)
        else:account,_=ModalAccount.objects.update_or_create(profile=profile,defaults={'label':label[:120] or profile,'monthly_credit':credit})
        runtime=Path(settings.BASE_DIR)/'.runtime';runtime.mkdir(exist_ok=True);log=runtime/f'modal-login-{profile}.log'
        env=dict(os.environ)
        for key in ['MODAL_PROFILE','MODAL_TOKEN_ID','MODAL_TOKEN_SECRET']:env.pop(key,None)
        env['PYTHONUNBUFFERED']='1';env['PYTHONIOENCODING']='utf-8'
        with log.open('wb') as stream:
            process=subprocess.Popen([sys.executable,'-m','modal','token','new','--profile',profile,'--no-activate'],cwd=settings.BASE_DIR,env=env,stdout=stream,stderr=subprocess.STDOUT,creationflags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0)
        _logins[profile]={'process':process,'log':log,'renew':renew,'before':credential_fingerprint(profiles.get(profile,{}))}
    return login_state(profile)


def login_state(profile):
    profiles=configured_profiles();configured=profile in profiles;state=_logins.get(profile);url='';code='';error=''
    if state and state.get('renew'):
        configured=configured and credential_fingerprint(profiles[profile])!=state['before']
        if configured and not state.get('validated'):
            try:client_for(ModalAccount.objects.get(profile=profile));state['validated']=True
            except ValueError as exc:error=str(exc);configured=False
    if state:
        text=state['log'].read_text(encoding='utf-8',errors='replace')[-16000:]
        clean=re.sub(r'\x1b\[[0-9;]*m','',text)
        match=re.search(r'Enter this code:\s*([A-Za-z0-9-]+)',clean)
        if match:code=match.group(1)
        for candidate in re.findall(r'https://modal\.com/[^\s\x1b<>]+',text):
            candidate=candidate.rstrip('.,\"\'')
            if urlparse(candidate).hostname=='modal.com':url=candidate;break
    return {'profile':profile,'configured':configured,'renew':bool(state and state.get('renew')),'error':error,'status':'connected' if configured else 'not_connected' if error else 'waiting' if state and state['process'].poll() is None else 'not_connected','url':url if not configured else '', 'code':code if not configured else ''}
