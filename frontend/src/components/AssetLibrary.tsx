import {useEffect,useState,useRef} from 'react';
import {confirmDelete} from '../lib/confirm-delete';
import {apiFetch,apiJson} from '../lib/api';
import {recentProjectIds,forgetProject} from '../lib/recent-projects';
import {useAuth} from '../context/auth-context';
import {StudioIcon} from './StudioIcon/StudioIcon';
type Project={id:string;name:string;kind:string;updated_at:string;state?:{version?:number}};
function Preview({id}:{id:string}){const[src,setSrc]=useState(''),[duration,setDuration]=useState(0),[visible,setVisible]=useState(false);const ref=useRef<HTMLDivElement>(null);useEffect(()=>{const o=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){setVisible(true);o.disconnect();}});if(ref.current)o.observe(ref.current);return()=>o.disconnect();},[]);useEffect(()=>{if(!visible)return;const c=new AbortController();void apiJson<{assets:{contentType:string;previewUrl?:string;url:string}[]}>(`/api/projects/${id}/assets`,{signal:c.signal}).then(data=>{const video=data.assets.find(a=>a.contentType.startsWith('video/'));if(video)setSrc(video.previewUrl||video.url);}).catch(()=>{});return()=>c.abort();},[id,visible]);return <div ref={ref} className="asset-card-preview">{src?<video src={src} muted playsInline preload="metadata" onLoadedMetadata={e=>{setDuration(e.currentTarget.duration);e.currentTarget.currentTime=Math.min(.1,e.currentTarget.duration/2);}}/>:<StudioIcon name="video"/>}{duration>0&&<small>{Math.floor(duration/60)}:{String(Math.floor(duration%60)).padStart(2,'0')}</small>}</div>;}
export function AssetLibrary(){
 const {session}=useAuth();const[items,setItems]=useState<Project[]>([]),[all,setAll]=useState(false),[recent,setRecent]=useState(false),[error,setError]=useState('');
 const [selecting,setSelecting]=useState(false),[selected,setSelected]=useState<string[]>([]),[busy,setBusy]=useState(false);
 useEffect(()=>{let active=true;const load=()=>void apiJson<Project[]>('/api/projects').then(data=>{if(active)setItems(data.filter(p=>p.state?.version===1).sort((a,b)=>b.updated_at.localeCompare(a.updated_at)));}).catch(()=>{if(active)setError('Biblioteka trenutno nije dostupna.');});load();window.addEventListener('projects-changed',load);return()=>{active=false;window.removeEventListener('projects-changed',load);};},[]);
 const ids=session.user?recentProjectIds(session.user.id):[];const shown=recent?ids.flatMap(id=>items.find(p=>p.id===id)||[]):items;
 async function remove(id?:string){const targets=selected.length?selected:id?[id]:[];if(busy||!targets.length||!await confirmDelete(`Obrisati ${targets.length} odabranih projekata i njihove datoteke?`))return;
 setBusy(true);setError('');const failed:string[]=[];
 for(const target of targets){try{const response=await apiFetch(`/api/projects/${target}`,{method:'DELETE'});if(!response.ok)throw new Error();setItems(current=>current.filter(p=>p.id!==target));if(session.user)forgetProject(session.user.id,target);window.dispatchEvent(new CustomEvent('project-deleted',{detail:target}));}catch{failed.push(target);}}
 setSelected(failed);setBusy(false);window.dispatchEvent(new Event('projects-changed'));if(failed.length)setError(`${failed.length} projekata nije obrisano. Pokušaj ponovo.`);
 }
 return <section className="asset-library"><header><strong>Asset Library</strong><button onClick={()=>setAll(v=>!v)}>{all?'Prikaži manje':'View all'} →</button></header>
 <nav><button aria-pressed={!recent} onClick={()=>{setRecent(false);setSelected([]);}}>Spremljeni</button><button aria-pressed={recent} onClick={()=>{setRecent(true);setSelected([]);}}>Nedavni</button><button disabled={busy} onClick={()=>{setSelecting(v=>!v);setAll(true);setSelected([]);}}>{selecting?'Završi odabir':'Odaberi više'}</button>
 {selecting&&<><button disabled={busy} onClick={()=>setSelected(selected.length===shown.length?[]:shown.map(p=>p.id))}>Odaberi sve</button><button disabled={busy||!selected.length} onClick={()=>void remove()}><StudioIcon name="trash"/> Obriši ({selected.length})</button></>}</nav>
 {error&&<p role="status">{error}</p>}<div className="asset-library-grid">{shown.slice(0,all?undefined:3).map(p=><div key={p.id}>
 {selecting&&<label><input type="checkbox" disabled={busy} checked={selected.includes(p.id)} onChange={()=>setSelected(current=>current.includes(p.id)?current.filter(id=>id!==p.id):[...current,p.id])}/> Odaberi {p.name}</label>}
 <a href={`${p.kind==='video'?'/video-editor':'/titlovi'}?project=${p.id}`} title={p.name}><Preview id={p.id}/><span>{p.name}</span></a>{all&&<button disabled={busy} title={selected.length?'Obriši odabrane':`Obriši ${p.name}`} onClick={()=>void remove(p.id)}><StudioIcon name="trash"/></button>}</div>)}</div>{!shown.length&&!error&&<p>Ovdje će biti tvoji spremljeni projekti.</p>}</section>;
}
