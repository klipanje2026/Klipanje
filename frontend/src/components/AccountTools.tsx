import {useEffect,useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {apiJson} from '../lib/api';
import {useAuth} from '../context/auth-context';
import type {MyBilling} from '../lib/billing';

export function TokenBalance(){
 const {session}=useAuth();const [value,setValue]=useState<string>('…');
 useEffect(()=>{if(!session.user)return;let live=true;const load=()=>{if(document.visibilityState!=='visible')return;void apiJson<MyBilling>('/api/subscription').then(r=>{if(live)setValue(r.subscription.unlimited?'∞':String(r.subscription.remaining??0));}).catch(()=>{if(live)setValue('—');});};load();const timer=setInterval(load,30000);window.addEventListener('focus',load);return()=>{live=false;clearInterval(timer);window.removeEventListener('focus',load);};},[session.user]);
 return session.user?<a className="workspace-token-balance" data-no-tooltip href="/krediti" aria-label={`Preostalo tokena: ${value}`}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M15 8h-4a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4H9m3-10v12"/></svg><strong>{value}</strong></a>:null;
}
export function EmailSettings(){
 const [data,setData]=useState<{email:string;verified:boolean;delivery:string|null}|null>(null),[email,setEmail]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{void apiJson<NonNullable<typeof data>>('/api/account/email').then(r=>{setData(r);setEmail(r.email);}).catch(e=>setError(e.message));},[]);
 return <section id="email" className="affiliate-card email-settings"><header><h2>Potvrda emaila</h2><p>Potvrdi adresu povezanu s tvojim Edita računom.</p></header>{data?.verified?<p>Email {data.email} je potvrđen.</p>:<form onSubmit={async e=>{e.preventDefault();setBusy(true);try{setData(await apiJson('/api/account/email',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})}));setError('');}catch(e){setError(e instanceof Error?e.message:'Slanje nije uspjelo.');}finally{setBusy(false);}}}><label><span>Email adresa</span><input type="email" autoComplete="email" placeholder="ime@primjer.ba" required value={email} onChange={e=>setEmail(e.target.value)}/></label><button type="submit" disabled={busy}>{busy?'Slanje…':'Pošalji potvrdu'}</button></form>}{data?.delivery&&!data.verified&&<p>{data.delivery==='sent'?'Poruka je poslana. Otvori link iz emaila.':'Poruka čeka slanje. Administracija treba provjeriti email servis.'}</p>}{error&&<p role="alert">{error}</p>}</section>;
}
export function VerifyEmail(){
 const [params]=useSearchParams(),[message,setMessage]=useState('Potvrdi email za svoj Edita račun.'),[busy,setBusy]=useState(false),[done,setDone]=useState(false);
 return <main className="billing-workspace"><h1>Potvrda emaila</h1><p role="status">{message}</p><button disabled={busy||done} onClick={async()=>{setBusy(true);try{await apiJson('/api/account/verify-email',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:params.get('token')})});setMessage('Email je potvrđen.');setDone(true);}catch(e){setMessage(e instanceof Error?e.message:'Potvrda nije uspjela.');}finally{setBusy(false);}}}>Potvrdi email</button><p><a href="/titlovi">Otvori Editu</a></p></main>;
}
export function AffiliateCoupons(){
 const [data,setData]=useState<{percent:number;coupons:{code:string;active:boolean}[]}|null>(null),[code,setCode]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{void apiJson<NonNullable<typeof data>>('/api/affiliate/coupons').then(setData).catch(e=>setError(e.message));},[]);
 return <section className="affiliate-card"><h2>Moji kuponi</h2>{error&&<p role="alert">{error}</p>}{data&&<><p>{data.percent?`${data.percent}% popusta na prvi mjesec preko tvog linka ili kupona.`:'Administrator još nije dodijelio popust.'}</p>{data.percent>0&&<form onSubmit={async e=>{e.preventDefault();setBusy(true);try{setData(await apiJson('/api/affiliate/coupons',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code})}));setCode('');setError('');}catch(e){setError(e instanceof Error?e.message:'Kupon nije kreiran.');}finally{setBusy(false);}}}><label>Naziv kupona<input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} pattern="[A-Z0-9][A-Z0-9-]{2,31}" required minLength={3} maxLength={32}/></label><button disabled={busy}>Kreiraj kupon</button></form>}{data.coupons.map(c=><p key={c.code}><strong>{c.code}</strong> · {c.active?'Aktivan':'Neaktivan'}</p>)}</>}</section>;
}
