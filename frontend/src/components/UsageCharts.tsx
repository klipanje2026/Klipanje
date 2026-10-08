import {AdminSelect} from './BillingSelect/AdminSelect';
import { useState } from 'react';

type Metrics = { calls:number; inputSeconds:number; inputBytes:number };
type Data = {
 date:string;
 calendar:({day:string}&Metrics)[];
 groups:({provider:string}&Metrics)[];
 users?:({user_id:number|null;user__username:string|null}&Metrics)[];
};
const format=(value:number)=>value.toLocaleString('bs-BA',{maximumFractionDigits:1});
const labels:Record<string,string>={elevenlabs:'ElevenLabs',r2:'Cloudflare R2',b2:'Backblaze',local:'Lokalna pohrana'};

export function UsageCharts({data,admin,onDay,onProvider,onUser}:{data:Data;admin:boolean;onDay:(day:string)=>void;onProvider:(provider:string)=>void;onUser:(id:number,name:string)=>void}) {
 const [metric,setMetric]=useState<keyof Metrics>('inputSeconds');
 const divisor=metric==='inputSeconds'?60:metric==='inputBytes'?1e6:1;
 const unit=metric==='inputSeconds'?'min':metric==='inputBytes'?'MB':'poziva';
 const count=new Date(Number(data.date.slice(0,4)),Number(data.date.slice(5,7)),0).getDate();
 const days=Array.from({length:count},(_,i)=>{
  const day=data.date.slice(0,7)+'-'+String(i+1).padStart(2,'0');
  return {day,value:(data.calendar.find(row=>row.day===day)?.[metric]||0)/divisor};
 });
 const maximum=Math.max(1,...days.map(row=>row.value));
 const providers=Object.entries(data.groups.reduce<Record<string,number>>((all,row)=>{
  all[row.provider]=(all[row.provider]||0)+row[metric]/divisor;return all;
 },{})).sort((a,b)=>b[1]-a[1]);
 const users=(data.users||[]).slice().sort((a,b)=>b[metric]-a[metric]).slice(0,8);
 const providerMax=Math.max(1,...providers.map(row=>row[1]));
 const userMax=Math.max(1,...users.map(row=>row[metric]/divisor));
 const point=(value:number,index:number)=>`${20+index*560/Math.max(1,count-1)},${145-value/maximum*120}`;
 return <div className="usage-charts">
  <div className="billing-toolbar admin-section-header"><strong>Grafički pregled potrošnje</strong><AdminSelect label="Mjera" value={metric} onChange={e=>setMetric(e.target.value as keyof Metrics)}><option value="inputSeconds">Minute zvuka</option><option value="inputBytes">Poslano MB</option><option value="calls">Broj poziva</option></AdminSelect></div>
  <article className="usage-chart-card usage-chart-wide"><h3>Kretanje kroz mjesec · {unit}</h3><p>Klikni dan za detalje. Aktivni filter korisnika i servisa vrijedi i za grafikon.</p>
   {!days.some(row=>row.value>0)?<p>Nema zabilježene potrošnje za ovu mjeru.</p>:<>
    <svg viewBox="0 0 600 180" role="img" aria-label={`Mjesečno kretanje potrošnje u ${unit}`}>
     {[0,.5,1].map(level=><g key={level}><line x1="20" x2="580" y1={145-level*120} y2={145-level*120} stroke="currentColor" opacity=".12"/><text x="20" y={139-level*120} fill="currentColor" fontSize="10">{format(maximum*level)} {unit}</text></g>)}
     <polyline points={days.map((row,i)=>point(row.value,i)).join(' ')} fill="none" stroke="#2ed3d3" strokeWidth="3"/>
     {days.map((row,i)=><circle key={row.day} cx={20+i*560/Math.max(1,count-1)} cy={145-row.value/maximum*120} r="4" fill="#2ed3d3"><title>{row.day}: {format(row.value)} {unit}</title></circle>)}
    </svg>
    <div className="usage-day-buttons">{days.map((row,i)=><button key={row.day} onClick={()=>onDay(row.day)} aria-pressed={row.day===data.date} title={`${row.day}: ${format(row.value)} ${unit}`}>{i+1}</button>)}</div>
   </>}
  </article>
  <article className="usage-chart-card"><h3>Servisi · odabrani dan/sat</h3>{!providers.some(row=>row[1]>0)?<p>Nema potrošnje za ovu mjeru.</p>:providers.map(([provider,value])=><button className="usage-bar" key={provider} onClick={()=>onProvider(provider)}><span>{labels[provider]||provider}</span><strong>{format(value)} {unit}</strong><i style={{width:`${value/providerMax*100}%`}}/></button>)}</article>
  {admin&&<article className="usage-chart-card"><h3>Najveći korisnici · odabrani dan/sat</h3><p>Do osam korisnika iz prikazanog izvještaja. Klik otvara njihov kalendar.</p>{!users.some(row=>row[metric]>0)?<p>Nema potrošnje za ovu mjeru.</p>:users.map(row=><button className="usage-bar" key={row.user_id??'guest'} disabled={row.user_id===null} onClick={()=>row.user_id!==null&&onUser(row.user_id,row.user__username||'Korisnik')}><span>{row.user__username||'Gost / obrisan račun'}</span><strong>{format(row[metric]/divisor)} {unit}</strong><i style={{width:`${row[metric]/divisor/userMax*100}%`}}/></button>)}</article>}
 </div>;
}
