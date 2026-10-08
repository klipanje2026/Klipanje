import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiJson } from '../../lib/api';
import type { MyBilling, Plan } from '../../lib/billing';
import { useAuth } from '../../context/auth-context';
import { PublicLayout } from '../../components/PublicLayout/PublicLayout';
import './SubscriptionsPage.scss';

export function SubscriptionsPage(){
  const {session}=useAuth();
  const [plans,setPlans]=useState<Plan[]>([]), [mine,setMine]=useState<MyBilling|null>(null);
  const [error,setError]=useState('');
  const [selected,setSelected]=useState('');
  useEffect(()=>{let live=true;Promise.all([apiJson<{plans:Plan[]}>('/api/plans'),session.user?apiJson<MyBilling>('/api/subscription'):Promise.resolve(null)]).then(([catalog,account])=>{if(live){setPlans(catalog.plans);setMine(account);}}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[session.user]);
  return <PublicLayout><main className="subscriptions-page"><span className="billing-eyebrow">TI KREIRAŠ. EDITA UREĐUJE.</span><h1>Prostor za tvoju sljedeću priču.</h1><p>Od prvog videa do redovnog stvaranja. Odaberi paket Edita tokena koji ti odgovara.</p>

    {error&&<p role="alert" className="billing-error">{error}</p>}
    <div className="subscription-plans" role="radiogroup" aria-label="Odaberi paket">{plans.flatMap(plan=>plan.id==='free'?[plan,{id:'affiliate',name:'Affiliate',price:0,tokens:0,interval:'once',currency:'USD'}]:[plan]).map(plan=><article key={plan.id} className={selected===plan.id?'featured is-selected':''} role="radio" aria-checked={selected===plan.id} tabIndex={0} onClick={()=>setSelected(plan.id)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();setSelected(plan.id);}}}><div><span>{plan.name}</span>{mine?.subscription.plan===plan.id&&mine.subscription.status==='active'&&<small>Trenutni paket</small>}</div><h2>${plan.price}<small>{plan.interval==='month'?'/ mjesečno':''}</small></h2><strong>{plan.id==='affiliate'?'Besplatan pristup nakon odobrenja':plan.id==='free'?'5 probnih tokena':`${plan.tokens} tokena mjesečno`}</strong><p>{plan.id==='affiliate'?'Dijeli Editu. Zatraži tokene kada su ti potrebni.':plan.id==='free'?'Jednokratno uz kreiranje računa.':plan.id==='annual'?'$144 godišnje · $12 mjesečno.':plan.id==='loyalty'?'$20 prvi mjesec, zatim $1 manje svakog mjeseca do $10. Otkazivanje resetuje popust.':`$${plan.price} mjesečno · ${plan.tokens} tokena.`}</p><ul><li>Editor titlova i videa</li><li>Stilovi i pozicije riječi</li><li>Privatni projekti</li>{plan.id!=='free'&&<><li>Glas: 1 token / započetih 1,5 min</li></>}</ul>
      <span className="plan-selection">{selected===plan.id?'✓ Odabrano':'Odaberi paket'}</span>
    </article>)}</div>
    <div className="plan-continue">{selected?<Link className="billing-button" to={selected==='affiliate'?'/affiliate':selected==='free'?'/login?mode=register':`/pretplate/kupovina?paket=${selected}`}>{selected==='affiliate'?'Prijavi se za Affiliate':selected==='free'?'Nastavi na registraciju':'Nastavi na pregled paketa'} →</Link>:<button disabled>Odaberi paket za nastavak</button>}</div>
    <p className="subscription-note">Plaćanje paketa je trenutno u testnoj fazi plaćanja, bez stvarne naplate. Neiskorišteni tokeni se ne prenose.</p>
    {session.user&&<Link to="/krediti">Moji tokeni i potrošnja →</Link>}
  </main></PublicLayout>;
}
