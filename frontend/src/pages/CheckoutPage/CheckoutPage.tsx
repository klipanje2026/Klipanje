import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PublicLayout } from '../../components/PublicLayout/PublicLayout';
import { useAuth } from '../../context/auth-context';
import { apiJson } from '../../lib/api';
import type { Plan } from '../../lib/billing';
import './CheckoutPage.scss';

export function CheckoutPage() {
  const { session } = useAuth();
  const [params] = useSearchParams();
  const [plan,setPlan] = useState<Plan>();
  const [enabled,setEnabled] = useState(false);
  const [error,setError] = useState('');
  const [coupon,setCoupon]=useState('');
  const [busy,setBusy] = useState(false);
  const [confirmed,setConfirmed] = useState(false);
  const [waiting,setWaiting] = useState(false);
  const selectedPlan=params.get('paket')||'standard';
  const returned = params.get('rezultat') === 'uspjeh';
  useEffect(()=>{let live=true;apiJson<{plans:Plan[];checkoutEnabled:boolean}>('/api/plans').then(result=>{if(live){setPlan(result.plans.find(item=>item.id===selectedPlan));setEnabled(result.checkoutEnabled);}}).catch(error=>{if(live)setError(error.message);});return()=>{live=false;};},[selectedPlan]);
  useEffect(()=>{
    if(!returned)return;
    let live=true, attempts=0;
    let timer:ReturnType<typeof setTimeout>;
    setWaiting(true);
    const poll=async()=>{
      try{
        const result=await apiJson<{confirmed:boolean}>('/api/payments/status');
        if(!live)return;
        if(result.confirmed){setConfirmed(true);setWaiting(false);return;}
        if(++attempts<20){timer=setTimeout(poll,3000);return;}
        setWaiting(false);
      }catch(error){if(live){setWaiting(false);setError(error instanceof Error?error.message:'Potvrda još nije dostupna.');}}
    };
    void poll();return()=>{live=false;clearTimeout(timer);};
  },[returned]);
  const start=async()=>{
    setBusy(true);setError('');
    try{
      const result=await apiJson<{url:string}>('/api/payments/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({plan:plan?.id,coupon})});
      const target=new URL(result.url);
      if(target.protocol!=='https:'||target.host!=='checkout.stripe.com')throw new Error('Neispravna adresa plaćanja.');
      window.location.assign(target.href);
    }catch(error){setError(error instanceof Error?error.message:'Plaćanje se nije otvorilo.');setBusy(false);}
  };
  return <PublicLayout><main className="checkout-page">
    <Link className="checkout-back" to="/pretplate">← Svi paketi</Link>
    <span className="billing-eyebrow">EDITA {plan?.name.toUpperCase()} · TESTNO PLAĆANJE</span>
    <h1>{confirmed?'Paket je aktiviran.':'Pregledaj svoj paket.'}</h1>
    <p>{plan?.tokens} tokena za tvoje riječi, ideje i video priče.</p>
    {error&&<p role="alert" className="billing-error">{error}</p>}
    {params.get('rezultat')==='odustao'&&<p role="status">Odustao/la si od plaćanja. Možeš nastaviti kad želiš.</p>}
    {returned&&<p className="billing-notice" role="status">{confirmed?'Uplata je potvrđena. Tokeni su dodijeljeni tvom računu.':waiting?'Čekamo potvrdu uplate od Stripea…':'Potvrda još nije stigla. Provjeri Moje tokene za nekoliko trenutaka; ne pokreći novu kupovinu.'}</p>}
    {!plan&&!error&&<p role="status">Učitavanje paketa…</p>}
    {plan&&<div className="checkout-grid"><section className="checkout-details">
      <h2>Detalji pretplate</h2>
      <div className="checkout-account"><small>Tvoj račun</small><strong>{session.user?.name||session.user?.username}</strong><span>@{session.user?.username}</span></div>
      <label>Affiliate kupon (opciono)<input value={coupon} onChange={e=>setCoupon(e.target.value.toUpperCase())} maxLength={32} placeholder="Npr. GOGI10"/></label><p>Važeći popust preko linka ili kupona primjenjuje se na prvi mjesec. Konačan iznos vidiš na Stripeu prije potvrde.</p><h2>Način plaćanja</h2><p>Plaćanje se otvara na Stripeovoj stranici. Ovo je test: nema stvarne naplate. Koristi samo testne podatke kartice.</p>
      <p>Pretplata se obnavlja svakog mjeseca. Obnovu možeš otkazati u pregledu svojih tokena.</p>
      <Link to="/krediti">Moji tokeni i pretplata →</Link>
    </section><section className="checkout-summary" aria-label="Sažetak kupovine">
      <span className="billing-eyebrow">TVOJ PAKET</span><h2>{plan.name}</h2><strong className="checkout-price">${plan.price}<small> / mjesečno</small></strong>
      <dl><div><dt>Edita tokeni</dt><dd>{plan.tokens} mjesečno</dd></div><div><dt>Period paketa</dt><dd>1 mjesec</dd></div><div><dt>Valuta</dt><dd>USD</dd></div></dl>
      <p>Titlovi troše 1 token po započetoj minuti. Glas troši 1 token po započetih 1,5 minuta. Neiskorišteni tokeni se ne prenose.</p>
      {!returned&&<button className="checkout-confirm" disabled={!enabled||busy} onClick={()=>void start()}>{busy?'Otvaranje Stripea…':enabled?'Nastavi na testno plaćanje →':'Testno plaćanje se priprema'}</button>}
      <small className="checkout-disclaimer">Tokeni se aktiviraju tek nakon potvrđene uplate.</small>
    </section></div>}
  </main></PublicLayout>;
}
