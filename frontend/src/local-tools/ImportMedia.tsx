import {useEffect, useRef, useState} from 'react';
import {Link} from 'react-router-dom';
import {useProduction} from '../components/ProductionWorkspace';
import {uploadAsset} from '../lib/production';
import './ImportMedia.scss';
const origin = 'http://127.0.0.1:5176';
export function ImportMedia(){
 const {projects,scripts}=useProduction();
 const [file,setFile]=useState<File|null>(null),[project,setProject]=useState(''),[script,setScript]=useState(''),[message,setMessage]=useState('Čekam snimak iz lokalnog alata…'),[busy,setBusy]=useState(false),[done,setDone]=useState(false);
 const received=useRef(false);
 const [preview,setPreview]=useState('');
 useEffect(()=>{if(!file)return;const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url);},[file]);
 useEffect(()=>{
  const receive=(event:MessageEvent)=>{
   if(event.origin!==origin||event.source!==window.opener||received.current||event.data?.type!=='klipanje-media'||!(event.data.file instanceof File))return;
   if(!event.data.file.type.startsWith('video/')||event.data.file.size>500*1024*1024){setMessage('Snimak nije podržan ili je veći od 500 MB.');return;}
   received.current=true;setFile(event.data.file);setMessage('Odaberi projekat i skriptu za ovaj snimak.');
   window.opener?.postMessage({type:'klipanje-received'},origin);
  };
  window.addEventListener('message',receive);
  const ready=()=>{if(!received.current)window.opener?.postMessage({type:'klipanje-ready'},origin);};
  ready();const timer=window.setInterval(ready,1500);
  return()=>{window.clearInterval(timer);window.removeEventListener('message',receive);};
 },[]);
 async function save(){if(!file||!project||!script||busy||done)return;setBusy(true);try{await uploadAsset(project,file,{gallery:true,purpose:'video',...(script?{scriptId:script}:{})});setDone(true);setMessage('Snimak je spremljen u medije projekta.');}catch(e){setMessage(e instanceof Error?e.message:'Uvoz nije uspio.');}finally{setBusy(false);}}
 return <section className="production-page local-import-page"><div className="local-import-heading"><span>VideoGen → Klipanje</span><h1>Prebaci u Klipanje</h1><p>Odaberi gdje želiš koristiti ovaj snimak.</p></div><div className="local-import-card"><p role="status">{message}</p>{file&&<div className="local-import-preview"><strong>{file.name}</strong></div>}{!done&&<><div className="local-import-fields"><label>Projekat <select value={project} disabled={busy} onChange={e=>{setProject(e.target.value);setScript('');}}><option value="">Odaberi projekat</option>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Skripta <select value={script} disabled={busy||!project} onChange={e=>setScript(e.target.value)}><option value="">Odaberi skriptu</option>{scripts.filter(s=>s.project===project).map(s=><option key={s.id} value={s.id}>{s.title}</option>)}</select></label></div><button className="klipanje-primary" disabled={!file||!project||!script||busy} onClick={()=>void save()}>{busy?'Prebacujem…':'Spremi u medije'}</button><p className="local-import-hint">Snimak će biti dostupan u medijima odabrane skripte. Odatle ga dodaj u montažu.</p></>}{done&&<Link className="klipanje-primary" to={`/videa?project=${project}${script?'&script='+script:''}`}>Otvori video editor →</Link>}</div></section>;
}
