import {EmailSettings} from '../../components/AccountTools';
import { ProviderUsage } from '../../components/ProviderUsage';
import { UserInsights } from '../../components/UserInsights';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiJson } from '../../lib/api';
import { dateLabel, entryLabel, type MyBilling } from '../../lib/billing';
import '../SubscriptionsPage/SubscriptionsPage.scss';
export function CreditsPage(){
  const [data,setData]=useState<MyBilling|null>(null),[error,setError]=useState(''),[cancelling,setCancelling]=useState(false);
  useEffect(()=>{let live=true;apiJson<MyBilling>('/api/subscription').then(data=>{if(live)setData(data);}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[]);
  return <main className="billing-workspace credits-workspace"><header className="credits-heading"><span className="billing-eyebrow">MOJ RAČUN</span><h1>Tokeni i pretplata</h1><p>Pregled paketa, potrošnje i postavki računa.</p></header>{error&&<p role="alert">{error}</p>}{!data&&!error&&<p>Učitavanje…</p>}{data&&<>
    <section className="credits-section credits-overview"><div className="billing-stats"><div><small>Paket</small><strong>{data.subscription.plan}</strong></div><div><small>Preostalo tokena</small><strong>{data.subscription.unlimited?'∞':data.subscription.remaining}</strong></div><div><small>Potrošeno u periodu</small><strong>{data.subscription.unlimited?'Neograničeno':`${data.subscription.used} / ${data.subscription.allowance}`}</strong></div></div>
    <p>{data.subscription.unlimited?'Administratorski pristup nema ograničenje tokena.':data.subscription.status==='expired'?'Paket je istekao.':data.subscription.periodEnd?'Aktivan do '+dateLabel(data.subscription.periodEnd):'Free tokeni su jednokratni i ne obnavljaju se mjesečno.'}</p><Link className="billing-link" to="/pretplate">Pregledaj pakete →</Link>

    {data.subscription.plan==='loyalty'&&<p>{data.subscription.cancelled?'Popust je resetovan. Sljedeća pretplata počinje od $20.':`Uzastopnih plaćenih mjeseci: ${data.subscription.loyaltyMonths||0}. Sljedeća cijena: $${data.subscription.nextPrice||20}.`}</p>}
    {data.subscription.paidAccess&&!data.subscription.cancelled&&<button disabled={cancelling} onClick={async()=>{setCancelling(true);setError('');try{const result=await apiJson<{subscription:MyBilling['subscription']}>('/api/subscription/cancel',{method:'POST'});setData({...data,subscription:result.subscription});}catch(e){setError(e instanceof Error?e.message:'Otkazivanje nije uspjelo.');}finally{setCancelling(false);}}}>Otkaži obnovu{data.subscription.plan==='loyalty'?' i resetuj popust':''}</button>}
    {data.subscription.cancelled&&<p>Obnova je otkazana. Plaćeni pristup ostaje do {dateLabel(data.subscription.paidUntil||null)}.</p>}
    <p className="billing-notice">Titlovi troše 1 token po započetoj minuti videa. Glas troši 1 token po započetih 1,5 minuta i zahtijeva aktivan plaćeni paket ili odobren affiliate pristup. Tokom generisanja glasa saldo je rezervisan; ostatak se vraća po završetku. Neuspjela obrada vraća rezervisane tokene. Administratori koriste obradu bez ograničenja.</p>
    {data.subscription.transferLimit&&<p>Partner · upload {((data.subscription.uploadUsed||0)/1000000).toFixed(1)} / 1.000 MB · izvoz {((data.subscription.exportUsed||0)/1000000).toFixed(1)} / 1.000 MB u ovom mjesečnom periodu.</p>}
    </section><section className="credits-section credits-usage"><h2>Potrošnja po funkciji</h2><div className="billing-stats">{(data.usage?.length?data.usage:[{capability:'transcription',tokens:0}]).map(row=><div key={row.capability}><small>{{titlovi:'Automatski titlovi',transcription:'Automatski titlovi',narration:'Naracija',voice_change:'Promjena glasa'}[row.capability]||row.capability}</small><strong>{row.tokens} tokena</strong></div>)}</div>
    </section><UserInsights/><details className="credits-section credits-service-history"><summary>Historija korištenja servisa · grafikon i detalji</summary><ProviderUsage/></details><section className="credits-section credits-token-history"><h2>Historija tokena</h2><div className="billing-table-wrap"><table className="billing-table"><thead><tr><th>Datum</th><th>Radnja</th><th>Tokeni</th><th>Preostalo</th></tr></thead><tbody>{data.entries.map(entry=><tr key={entry.id}><td>{dateLabel(entry.created_at)}</td><td>{entryLabel[entry.kind]??entry.kind} · {entry.detail}</td><td>{entry.amount}</td><td>{entry.balance_after}</td></tr>)}</tbody></table></div>{!data.entries.length&&<p className="credits-empty">Još nema promjena tokena.</p>}</section></>}
  <EmailSettings/></main>;
}
