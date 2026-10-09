import {LocalDialog} from '../components/LocalDialog';
import {useRef,useState} from 'react';
import {useSelection,ProjectTree,Icon} from '../components/ProductionWorkspace';
import {VideoStudio} from './VideoStudio/VideoStudio';
import {useAuth} from '../context/auth-context';
import {apiJson} from '../lib/api';
import {jsonBody,type Production} from '../lib/production';
export function ProductionVideo(){
 const w=useSelection(),{session}=useAuth();const guard=useRef<()=>Promise<boolean>>(async()=>true);
 const [collapsed,setCollapsed]=useState(()=>{try{return localStorage.getItem('klipanje-project-rail')==='closed';}catch{return false;}});
 const [adding,setAdding]=useState(false),[name,setName]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const toggle=()=>setCollapsed(value=>{try{localStorage.setItem('klipanje-project-rail',value?'open':'closed');}catch{}return !value;});
 return <div className={`local-video-layout${collapsed?' projects-collapsed':''}`}>
 <div className="klipanje-shell local-video-projects"><nav className="local-project-rail" aria-label="Projekti"><button title={collapsed?'Proširi moje projekte':'Sklopi moje projekte'} aria-label={collapsed?'Proširi moje projekte':'Sklopi moje projekte'} aria-expanded={!collapsed} onClick={toggle}><Icon name="folder"/><span>{collapsed?'Projekti':'Sklopi'}</span></button><button title="Dodaj skriptu" aria-label="Dodaj skriptu" onClick={async()=>{if(await guard.current())w.createScript(w.project?.id);}}><Icon name="file"/><span>+ Skripta</span></button><button title="Dodaj projekat" aria-label="Dodaj projekat" onClick={async()=>{if(await guard.current()){setName('');setError('');setAdding(true);}}}><span className="local-folder-plus"><Icon name="folder"/><b>+</b></span><span>+ Projekat</span></button></nav>{!collapsed&&<ProjectTree beforeSelect={()=>guard.current()}/>}</div>
 {w.script?<VideoStudio key={w.script.id} localScript={w.script} registerSave={save=>{guard.current=save;}}/>:<div className="local-video-empty"><h1>Video editor</h1><p>Odaberi projekat i dodaj skriptu da započneš.</p><button onClick={()=>w.createScript(w.project?.id)}>+ Dodaj skriptu</button></div>}
 {adding&&<LocalDialog title="Novi projekat" busy={busy} onClose={()=>setAdding(false)}><form onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{const p=await apiJson<Production>('/api/projects',jsonBody({name:name.trim(),workspace:session.workspaces[0]?.id,kind:'production',brief:{style:'cinematic'}}));w.putProject(p);w.select(p.id);setAdding(false);setCollapsed(false);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}><label>Naziv projekta<input autoFocus required maxLength={160} value={name} onChange={e=>setName(e.target.value)}/></label>{error&&<p role="alert">{error}</p>}<div className="production-row"><button type="button" disabled={busy} onClick={()=>setAdding(false)}>Odustani</button><button className="klipanje-primary" disabled={busy||!name.trim()}>{busy?'Spremanje…':'Dodaj projekat'}</button></div></form></LocalDialog>}
 </div>;
}
