import {LocalDialog} from '../components/LocalDialog';
import {Fragment, useEffect, useState, type FormEvent} from 'react';
import {Link, Navigate} from 'react-router-dom';
import {useAuth} from '../context/auth-context';
import {apiJson} from '../lib/api';
import {jsonBody} from '../lib/production';
import {Icon, useProduction} from '../components/ProductionWorkspace';
import {SelectField, visualStyles} from '../components/CreativeControls';
import './Administration.scss';

type Member = {id:number; name:string; username:string; isAdmin:boolean; isActive:boolean; passwordPending:boolean; lastLogin:string|null};
type Usage={images:number;estimatedUsd:number;unpriced:number;historicalImages:number;historicalUsd:number;historicalUnpriced:number;narrations:number;characters:number;credits:number;unknownCredits:number};
type Project = {id:string; name:string; ownerId:number; description:string; style:string; scriptCount:number; assetCount:number; updatedAt:string;usage:Usage};
type Overview = {users:Member[]; projects:Project[];usage:Usage};
const date = (value:string|null) => {if(!value)return 'Još nema prijave';const d=new Date(value);return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;};
const money=(value:number)=>`$${value.toFixed(4)}`;
const number=(value:number)=>value.toLocaleString('bs-BA');

export function Administration(){
 const {session}=useAuth();
 return session.user?.isStaff ? <AdminOverview/> : <Navigate to="/" replace/>;
}

function AdminOverview(){
 const {session}=useAuth(), workspace=useProduction();
 const [data,setData]=useState<Overview|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 const [owner,setOwner]=useState(''),[query,setQuery]=useState(''),[style,setStyle]=useState('all');
 const [expanded,setExpanded]=useState<string[]>([]),[eleven,setEleven]=useState<{remaining:number;used:number;limit:number}|null>(null),[elevenError,setElevenError]=useState('');
 const [selected,setSelected]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{let active=true;void apiJson<Overview>('/api/administration').then(value=>{if(active)setData(value);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[]);
 useEffect(()=>{let active=true;void apiJson<{remaining:number;used:number;limit:number}>('/api/elevenlabs-status').then(v=>{if(active)setEleven(v);}).catch(()=>{if(active)setElevenError('Stanje računa trenutno nije dostupno.');});return()=>{active=false;};},[]);
 const projects=(data?.projects||[]).filter(p=>(!owner||String(p.ownerId)===owner)&&(style==='all'||p.style===style)&&`${p.name} ${p.description}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
 const current=data?.projects.find(p=>p.id===selected);
 return <div className="local-admin">
  <header className="admin-heading"><div><span className="admin-eyebrow">Klipanje / administracija</span><h1>Korisnici i projekti</h1><p>Vlasništvo, osnovne informacije i pregled rada na ovom računaru.</p></div><span className="admin-local"><i/>Lokalno</span></header>
  {error&&<p className="admin-message" role="alert">{error}</p>}
  {loading?<p role="status">Učitavanje administracije…</p>:data&&<>
   <section className="admin-members" aria-label="Korisnici">{data.users.filter(user=>user.id===session.user?.id).map(user=>{const owned=data.projects.filter(p=>p.ownerId===user.id);return <button key={user.id} className="admin-member" aria-pressed={owner===String(user.id)} onClick={()=>setOwner(owner===String(user.id)?'':String(user.id))}>
    <div className="admin-member-top"><span className="admin-avatar">{user.name.slice(0,1).toUpperCase()}</span><span className="admin-role">{user.isAdmin?'Administrator':'Član'}</span></div>
    <strong>{user.name}</strong><span className="admin-handle">@{user.username}</span>
    <div className="admin-member-counts"><span><b>{owned.length}</b> projekata</span><span><b>{owned.reduce((sum,p)=>sum+p.scriptCount,0)}</b> skripti</span></div>
    <small>{!user.isActive?'Račun nije aktivan':user.passwordPending?'Čeka prvu promjenu lozinke':`Posljednja prijava: ${date(user.lastLogin)}`}</small>
   </button>;})}<div className="admin-spending"><h2>Potrošnja</h2><div className="admin-usage-grid"><div><small>ElevenLabs · preostali krediti</small><strong>{eleven?number(eleven.remaining):'—'}</strong><small>{eleven?`${number(eleven.used)} / ${number(eleven.limit)} potrošeno u periodu`:elevenError||'Učitavanje…'}</small></div><div><small>Image generacije · lokalno</small><strong>{money(data.usage.estimatedUsd)}</strong><small>{data.usage.images} generacija · procjena{data.usage.unpriced?` · ${data.usage.unpriced} bez cijene`:''}</small></div><div><small>OpenAI · preostala sredstva</small><strong>—</strong><a href="https://platform.openai.com/settings/organization/billing/overview" target="_blank" rel="noreferrer">Pogledaj stanje računa ↗</a><small>Stanje nije dostupno kroz ovu vezu.</small></div></div></div></section>
   <section className="admin-projects"><header><div><h2>Projekti <span>{projects.length}</span></h2><p>{owner?`Projekti korisnika ${data.users.find(u=>String(u.id)===owner)?.name||''}`:'Svi projekti na jednom mjestu.'}</p></div>{owner&&<button className="klipanje-secondary" onClick={()=>setOwner('')}>Svi korisnici</button>}</header>
    <div className="admin-filters"><label>Pretraga<input type="search" placeholder="Naziv ili opis projekta…" value={query} onChange={e=>setQuery(e.target.value)}/></label><SelectField label="Vlasnik" value={owner} onChange={setOwner} options={[["","Svi korisnici"],...data.users.map(u=>[String(u.id),u.name])]}/><SelectField label="Stil" value={style} onChange={setStyle} options={[["all","Svi stilovi"],["","Nije odabran"],...visualStyles]}/></div>
    {notice&&<p role="status" className="admin-saved">✓ {notice}</p>}
    <div className="admin-table-wrap"><table><thead><tr><th>Projekat</th><th>Vlasnik</th><th>Stil</th><th>Sadržaj</th><th>Izmijenjeno</th><th><span className="admin-sr-only">Akcije</span></th></tr></thead><tbody>{projects.map(p=><Fragment key={p.id}><tr>
     <td><div className="admin-project-name"><span className="admin-folder"><Icon name="folder"/></span><div><strong>{p.name}</strong><p>{p.description||'Opis još nije dodan.'}</p></div></div></td>
     <td><span className="admin-owner">{data.users.find(u=>u.id===p.ownerId)?.name||'—'}</span></td><td><span className="admin-style">{visualStyles.find(([id])=>id===p.style)?.[1]||'Nije odabran'}</span></td>
     <td><span className="admin-content-count">{p.scriptCount} skripti<small>{p.assetCount} datoteka</small></span></td><td className="admin-date">{date(p.updatedAt)}</td><td><button className="admin-expand" aria-label={`Statistika projekta ${p.name}`} aria-expanded={expanded.includes(p.id)} aria-controls={`stats-${p.id}`} onClick={()=>setExpanded(old=>old.includes(p.id)?old.filter(id=>id!==p.id):[...old,p.id])}>{expanded.includes(p.id)?'−':'+'}</button></td>
    </tr><tr className="admin-stat-row"><td colSpan={6}><div id={`stats-${p.id}`} className={`admin-stat-collapse ${expanded.includes(p.id)?'is-open':''}`} inert={!expanded.includes(p.id)}><div><div className="admin-stat-content"><div className="admin-usage-grid"><div><small>Generisane slike</small><strong>{p.usage.images+p.usage.historicalImages}</strong><small>Uključuje reference likova, bez lokalnih izreza</small></div><div><small>Slike · procijenjena potrošnja</small><strong>{money(p.usage.estimatedUsd+p.usage.historicalUsd)}</strong><small>{p.usage.unpriced+p.usage.historicalUnpriced} generacija bez podatka o cijeni</small></div><div><small>ElevenLabs · potvrđeni krediti</small><strong>{p.usage.narrations>p.usage.unknownCredits?number(p.usage.credits):'—'}</strong><small>{p.usage.unknownCredits?`${p.usage.unknownCredits} generacija bez potvrđene cijene`:'Evidentirani obračun'}</small></div><div><small>Naracija · poslani znakovi</small><strong>{number(p.usage.characters)}</strong><small>{p.usage.narrations} evidentiranih generacija</small></div></div><small>Nova potrošnja se prati po projektu. Starije slike prikazane su prema sačuvanim zapisima; obrisane slike i stare naracije mogu nedostajati.</small><button className="admin-edit" onClick={()=>{setNotice('');setSelected(p.id);}}>Uredi projekat ↗</button></div></div></div></td></tr></Fragment>)}</tbody></table></div>
    {!projects.length&&<div className="admin-empty"><Icon name="folder"/><h3>{data.projects.length?'Nema rezultata':'Još nema projekata'}</h3><p>{data.projects.length?'Promijeni pretragu ili odabrane filtere.':'Novi projekti će se ovdje pojaviti uz svog vlasnika.'}</p></div>}
   </section>
   <p className="admin-footnote">Pregled prikazuje lokalnu bazu ovog računara. Projekti s drugih računara ne sinhronizuju se preko GitHuba.</p>
  </>}
  {current&&<ProjectDetails key={current.id} project={current} owner={data?.users.find(u=>u.id===current.ownerId)?.name||''} canOpen={session.user?.id===current.ownerId} onClose={()=>setSelected('')} onSaved={p=>{setData(old=>old?{...old,projects:old.projects.map(item=>item.id===p.id?p:item)}:old);setNotice(`Projekat „${p.name}” je spremljen.`);setSelected('');void workspace.reload();}}/>}
 </div>;
}

function ProjectDetails({project,owner,canOpen,onClose,onSaved}:{project:Project;owner:string;canOpen:boolean;onClose:()=>void;onSaved:(p:Project)=>void}){
 const [name,setName]=useState(project.name),[description,setDescription]=useState(project.description),[style,setStyle]=useState(project.style),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function save(e:FormEvent){e.preventDefault();setBusy(true);setError('');try{onSaved(await apiJson<Project>(`/api/administration/projects/${project.id}`,jsonBody({name:name.trim(),description,style},'PATCH')));}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <LocalDialog title="Osnove projekta" className="admin-modal" busy={busy} onClose={onClose}><form onSubmit={e=>void save(e)} onKeyDown={e=>{if(e.key==='Escape'&&!busy)onClose();}}>
  <header><span className="admin-folder"><Icon name="folder"/></span><div><h2 id="admin-edit-title">Osnove projekta</h2><p>Vlasnik: {owner}</p></div></header>
  <fieldset disabled={busy}><label>Naziv projekta<input autoFocus required maxLength={160} value={name} onChange={e=>setName(e.target.value)}/></label><label>Opis<textarea rows={4} maxLength={10000} placeholder="O čemu je projekat?" value={description} onChange={e=>setDescription(e.target.value)}/></label><SelectField label="Vizuelni stil" value={style} onChange={setStyle} options={[["","Nije odabran"],...visualStyles]}/></fieldset>
  {error&&<p role="alert">{error}</p>}<footer>{canOpen&&!busy&&<Link to={`/projekti?project=${project.id}`}>Otvori projekat</Link>}<button type="button" disabled={busy} onClick={onClose}>Odustani</button><button className="klipanje-primary" disabled={busy||!name.trim()}>{busy?'Spremanje…':'Spremi izmjene'}</button></footer>
 </form></LocalDialog>;
}
