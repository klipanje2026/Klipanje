import {useEffect, useRef, useState} from 'react'

type Generation = {
  id:string; title:string; model:string; model_id:string; gpu:string; mode:string;
  status:string; status_label:string; duration:number; steps_label:string; resolution:string;
  elapsed_seconds:number; wall_seconds:number|null; cost:number|null; cost_kind:string;
  cost_label:string; cost_note:string; source_cost:number|null; video_url:string|null;
  reference_url:string|null; prompt:string; negative_prompt:string; review:string;
  created_at:string; placement:string; seed:number; source_report:string|null;
}
type Archive = {
  generated_at:string; published_total:number; tests_remaining:number; creative_remaining:number;
  counts:{all:number; videos:number; unsuccessful:number; local:number}; rows:Generation[];
  latest_ids:string[];
}
const usd=(value:number)=>'$'+value.toFixed(3)

export default function GenerationArchive(){
  const [archive,setArchive]=useState<Archive|null>(null)
  const [error,setError]=useState('')
  const [query,setQuery]=useState(''),[scope,setScope]=useState('videos'),[sort,setSort]=useState('cheap')
  const [selectedId,setSelectedId]=useState<string|null>(null)
  const preview=useRef<HTMLElement|null>(null)
  useEffect(()=>{
    fetch('/generation-archive.json',{cache:'no-store'}).then(r=>{
      if(!r.ok)throw Error('Pregled se još priprema.'); return r.json()
    }).then(setArchive).catch(()=>setError('Na ovom računaru nema lokalne arhive ranijih proba. Novi radovi su u radnoj sobi i galeriji.'))
  },[])
  useEffect(()=>{if(selectedId)preview.current?.scrollIntoView({block:'start'})},[selectedId])
  if(!archive)return <section className="panel analysis-section"><h2>{error||'Učitavanje svih proba…'}</h2></section>
  const selected=archive.rows.find(r=>r.id===selectedId)
  const needle=query.trim().toLocaleLowerCase()
  const rows=archive.rows.filter(r=>{
    const inScope=scope==='all'||(scope==='videos'?r.mode==='modal'&&r.status==='completed':scope==='failed'?r.mode==='modal'&&r.status!=='completed':r.mode!=='modal')
    return inScope&&(!needle||[r.title,r.model,r.gpu,r.review].join(' ').toLocaleLowerCase().includes(needle))
  }).sort((a,b)=>{
    if(sort==='newest')return b.created_at.localeCompare(a.created_at)
    if(a.cost===null)return b.cost===null?b.created_at.localeCompare(a.created_at):1
    if(b.cost===null)return -1
    return (sort==='expensive'?-1:1)*(a.cost-b.cost)||b.created_at.localeCompare(a.created_at)
  })
  return <div className="generation-archive">
    <section className="archive-summary panel analysis-section">
      <div><span>OD PRVOG POKUŠAJA</span><h2>{archive.counts.videos} završenih AI videa</h2><p>{archive.counts.all} zapisa ukupno · {archive.counts.unsuccessful} neuspjelih ili zaustavljenih proba · {archive.counts.local} lokalna rezultata</p></div>
      <div><span>OBJAVLJENO NA MODALU</span><strong>{usd(archive.published_total)}</strong><small>Preostalo za testove {usd(archive.tests_remaining)} · kreativno {usd(archive.creative_remaining)}</small></div>
    </section>
    <section className="panel analysis-section archive-latest"><h2>Posljednje probe</h2><div>{archive.latest_ids.map(id=>{
      const row=archive.rows.find(r=>r.id===id)
      return row?<button className="text-button" key={id} onClick={()=>setSelectedId(id)}>{row.title} ↗</button>:null
    })}</div></section>
    <section className="panel analysis-section">
      <div className="archive-heading"><div><h2>Sve generacije, poredane po cijeni</h2><p>Svaki pokušaj ostaje zaseban red. Cijena je procjena resursa, a ukupan Modal račun uključuje i pokretanje i pripremu. Rezervacije nisu cijene videa.</p></div><a className="text-button archive-download" href="/generation-archive.csv" download>Preuzmi cijelu tabelu CSV ↓</a></div>
      <div className="archive-controls">
        <label>PRETRAGA<input placeholder="Traži scenu, model ili karticu" value={query} onChange={e=>setQuery(e.target.value)}/></label>
        <label>PRIKAŽI<select value={scope} onChange={e=>setScope(e.target.value)}><option value="videos">Svi završeni AI videi ({archive.counts.videos})</option><option value="all">Svi zapisi ({archive.counts.all})</option><option value="failed">Greške i zaustavljene probe ({archive.counts.unsuccessful})</option><option value="local">Montaže i lokalni demo ({archive.counts.local})</option></select></label>
        <label>REDOSLIJED<select value={sort} onChange={e=>setSort(e.target.value)}><option value="cheap">Najjeftinije prvo</option><option value="expensive">Najskuplje prvo</option><option value="newest">Najnovije prvo</option></select></label>
      </div>
      <p className="archive-cost-key"><b>Izmjereni resursi</b> = izračun iz zapisanih vremena i traženih resursa. <b>Ranija procjena</b> = sačuvana konzervativna procjena gdje nema preciznijeg mjerenja. <b>Nepoznato</b> = nema pouzdane pojedinačne cijene; ne znači besplatno. Različite scene i rezolucije nisu jednak test kvaliteta.</p>
    </section>
    {selected&&<section className="panel analysis-section archive-preview" ref={preview} aria-label="Pregled izabrane generacije">
      <div className="archive-heading"><div><h2>{selected.title}</h2><p>{selected.model} · {selected.gpu} · {selected.duration} s · {selected.mode==='modal'?selected.steps_label+' koraka':selected.mode==='assembled'?'spoj dva klipa':'lokalni demo'} · {selected.resolution}</p></div><button className="text-button" onClick={()=>setSelectedId(null)}>Zatvori pregled ×</button></div>
      <div className="archive-preview-grid"><div>{selected.video_url?<video key={selected.id} src={selected.video_url} controls preload="metadata"/>:selected.reference_url?<img src={selected.reference_url} alt="Početna slika neuspjele probe"/>:<p>Nema izlaznog videa.</p>}</div><div>
        <p><b>{selected.status_label}</b> · {selected.cost!==null?usd(selected.cost):'Nepoznata cijena'} · {selected.cost_label}</p>
        <p>{selected.cost_note}</p>{selected.source_cost!==null&&<p>Resursi izvornih AI klipova: {usd(selected.source_cost)}. Montaža ne naplaćuje izvore ponovo.</p>}
        {selected.review&&<p>{selected.review}</p>}
        <p>GPU posao: {selected.elapsed_seconds.toFixed(1)} s{selected.wall_seconds!==null?` · Od slanja do završetka: ${selected.wall_seconds.toFixed(1)} s`:''}. Seed {selected.seed} · profil {selected.placement}.</p>
        {selected.video_url&&<a className="text-button" href={selected.video_url} download>Preuzmi ovaj video ↓</a>}
        <details><summary>Opis i trag mjerenja</summary><p className="archive-prompt">{selected.prompt}</p>{selected.negative_prompt&&<p>Sačuvani negativni opis: {selected.negative_prompt}</p>}<p>ID: {selected.id}</p>{selected.source_report&&<p>Izvor mjerenja: {selected.source_report}</p>}</details>
      </div></div>
    </section>}
    <section className="panel analysis-section"><p className="archive-visible-count">Prikazano {rows.length} od {archive.counts.all} zapisa · Nepoznate cijene su na kraju.</p>
      <div className="table-wrap"><table className="analysis-table archive-table"><thead><tr><th># / SCENA</th><th>MODEL / GPU</th><th>POSTAVKE</th><th>GPU POSAO</th><th>PROCJENA CIJENE</th><th>PREGLED</th></tr></thead><tbody>{rows.map((r,i)=><tr key={r.id}>
        <td><div className="archive-scene">{r.reference_url&&<img loading="lazy" src={r.reference_url} alt=""/>}<div><span>{i+1}. {r.title}</span><small>{r.status_label}</small></div></div></td>
        <td><strong>{r.model}</strong><small>{r.gpu}</small></td><td>{r.duration} s · {r.mode==='modal'?r.steps_label+' koraka':r.mode==='assembled'?'spoj dva klipa':'lokalni demo'}<small>{r.resolution}</small></td><td>{r.elapsed_seconds>0?r.elapsed_seconds.toFixed(1)+' s':'—'}</td>
        <td><strong>{r.cost!==null?usd(r.cost):'Nepoznato'}</strong><small>{r.cost_label}</small></td><td><button className="text-button" onClick={()=>setSelectedId(r.id)}>{r.video_url?'Pogledaj video':'Detalji probe'} ↗</button></td>
      </tr>)}</tbody></table></div>{rows.length===0&&<p>Nema rezultata za izabranu pretragu.</p>}
    </section>
    <p className="source-note">Sačuvani pregled: {new Date(archive.generated_at).toLocaleString('bs-BA')}. Izvori su lokalna biblioteka i zapisnici testova. Iznosi po redovima nisu pojedinačne Modal fakture.</p>
  </div>
}
