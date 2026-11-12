"""Read-only Modal billing. No GPU invocation or account-setting changes."""
import dataclasses
from datetime import datetime, timezone
from decimal import Decimal
from django.utils import timezone as dj_time
from .models import BillingSnapshot, Job


def json_value(value):
    if dataclasses.is_dataclass(value): return json_value(dataclasses.asdict(value))
    if isinstance(value, Decimal): return str(value)
    if isinstance(value, datetime): return value.isoformat()
    if isinstance(value, dict): return {str(k): json_value(v) for k,v in value.items()}
    if isinstance(value, (list,tuple)): return [json_value(v) for v in value]
    return value


def current_cycle(): return dj_time.now().astimezone(timezone.utc).strftime('%Y-%m')


def sync_billing(account=None):
    import modal
    cycle=current_cycle()
    from .modal_accounts import client_for
    try:
        ws=modal.Workspace.from_context(client=client_for(account)) if account else modal.Workspace.from_context()
        summary=json_value(ws.billing.summary(cycle=cycle))
    except modal.exception.AuthError:
        from .modal_accounts import AUTH_MESSAGE
        raise ValueError(AUTH_MESSAGE) from None
    for key in ['adjustments','metered_cost_breakdown']:
        summary[key]={str(k).lower().replace(' ','_'):v for k,v in summary.get(key,{}).items()}
    payload={'summary':summary,'reports':[], 'report_error':'', 'monthly_credit_usd':str(account.monthly_credit) if account and account.monthly_credit is not None else None if account else '30.00',
             'credit_source':'Mjesečni kredit unesen za ovaj račun; iskorištenje se čita s Modala.'}
    try:
        payload['reports']=json_value(ws.billing.report(start=datetime.strptime(cycle,'%Y-%m').replace(tzinfo=timezone.utc), resolution='d',tag_names=['*']))
    except Exception:
        payload['report_error']='Detaljni Modal izvještaj trenutno nije dostupan. Zbir je pročitan; pojedinačne procjene nisu potvrđene naplate.'
    obj,_=BillingSnapshot.objects.update_or_create(account=account,cycle=cycle,defaults={'payload':payload})
    if account:
        name=ws.name
        account.workspace_name=(name() if callable(name) else name) or '';account.save(update_fields=['workspace_name'])
    return billing_state(obj,account=account)


def billing_state(snapshot=None,account=None):
    obj=snapshot or BillingSnapshot.objects.filter(account=account,cycle=current_cycle()).first()
    if not obj:return {'synced':False,'remaining':None,'credit':float(account.monthly_credit) if account and account.monthly_credit is not None else 30 if not account else None,'message':'Osvježi Modal obračun za tekući mjesec.'}
    p=obj.payload;summary=p.get('summary',{});adjustments={str(k).lower().replace(' ','_'):v for k,v in summary.get('adjustments',{}).items()};used=-Decimal(adjustments.get('credits','0'))
    return {'synced':True,'cycle':obj.cycle,'synced_at':obj.synced_at.isoformat(),'account':obj.account_id,'credit':float(Decimal(p['monthly_credit_usd'])) if p.get('monthly_credit_usd') is not None else None,
            'credit_used':float(used),'remaining':float(max(Decimal('0'),Decimal(p['monthly_credit_usd'])-used)) if p.get('monthly_credit_usd') is not None else None,
            'metered':float(Decimal(summary.get('metered_cost','0'))),'billed':float(Decimal(summary.get('billed_cost','0'))),
            'summary':summary,'reports':p.get('reports',[]),'report_error':p.get('report_error',''),
            'note':'Službeni obračun do navedenog osvježavanja. Podaci mogu kasniti. Preostali kredit = uneseni mjesečni kredit ovog računa minus iskorišteni krediti. Bez lokalnih rezervacija.'}
