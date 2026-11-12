import {DownloadButton,useDownloads} from './Downloads';
import {useEffect,useRef,useState} from 'react';
import type {Job} from './App';
const mb=(n:number)=>(n/1e6).toLocaleString('bs-BA',{maximumFractionDigits:2})+' MB';
const requestedDownloads=new Set<string>();
export function requestProcessedDownload(id:string){requestedDownloads.add(id)}
export function ProcessedVideo({job,process}:{job:Job;process:(j:Job,speed:number)=>void}){
 const info=job.processing_info;
 const [speed,setSpeed]=useState(job.processing_speed||1);
 useEffect(()=>setSpeed(job.processing_speed||1),[job.processing_speed]);
 const pending=['pending','processing'].includes(job.processing_status);
 if(job.status!=='completed'||!job.original_url)return null;
 return <section className={'processed-video '+job.processing_status} aria-live="polite">
  {job.processing_status==='ready'?<><strong>Spremno za galeriju · {info.width} × {info.height} · bez zvuka · {info.speed||1}×</strong><span>{mb(info.original_bytes)} → {mb(info.processed_bytes)}{info.processed_bytes<info.original_bytes?` · ${Math.round((1-info.processed_bytes/info.original_bytes)*100)}% manje`:''}{info.duration?` · ${info.duration.toLocaleString('bs-BA',{maximumFractionDigits:2})} s`:''}</span></>:pending?<><strong>Prilagođavam video…</strong><span>Do 1200 px · bez zvuka · {job.processing_speed}× · lokalna obrada</span></>:job.processing_status==='failed'?<><strong>Obrada nije završena</strong><span>{job.processing_error}</span></>:<strong>Original · {job.original_size?mb(job.original_size):''}</strong>}
  <div className="processing-controls"><label>Brzina videa<select aria-label="Brzina videa" value={speed} disabled={pending} onChange={e=>setSpeed(Number(e.target.value))}>{[.5,.75,1,1.25,1.5,2].map(n=><option key={n} value={n}>{n.toLocaleString('bs-BA')}×{n===1?' · normalno':''}</option>)}</select></label><button className="button secondary" disabled={pending} onClick={()=>process(job,speed)}>{pending?'Obrađujem…':job.processing_status==='failed'?'Ponovi obradu':'Obradi video'}</button></div><small>Do 1200 px · bez zvuka. Brzina se primjenjuje na original.</small>
  {job.processing_status==='ready'&&<DownloadButton job={job}>Preuzmi obrađeni video</DownloadButton>}
  {!!job.processing_status&&<DownloadButton job={job} original className="text-button original-download">Preuzmi original</DownloadButton>}
 </section>
}

// Export only results observed in flight or explicitly processed in this tab.
export function ProcessedDownloads({jobs,enabled}:{jobs:Job[]|undefined;enabled:boolean}){
 const {directory,save}=useDownloads();
 const seen=useRef<Set<string>|null>(null),waiting=useRef(new Set<string>());
 const saving=useRef(new Set<string>());
 useEffect(()=>{
  if(!jobs)return;
  const initial=seen.current===null;
  if(initial)seen.current=new Set(jobs.map(j=>j.id));
  for(const job of jobs){
   const observedActive=!job.historical&&!['completed','failed','cancelled'].includes(job.status);
   const processing=['pending','processing'].includes(job.processing_status);
   const observedNew=!job.historical&&!initial&&!seen.current!.has(job.id);
   if(requestedDownloads.has(job.id)||observedActive||processing||observedNew)waiting.current.add(job.id);
   seen.current!.add(job.id);
   if(!waiting.current.has(job.id)||job.processing_status!=='ready'||!job.download_url)continue;
   if(!enabled){waiting.current.delete(job.id);requestedDownloads.delete(job.id);continue}
   if(!directory.available)continue;
   const key='videogen-saved-folder-'+job.id+'-'+job.processing_info.revision+'-'+directory.directory;
   try{
    if(localStorage.getItem(key)){waiting.current.delete(job.id);requestedDownloads.delete(job.id);continue}
   }catch{/* The server also recognises a video that was already saved. */}
   if(saving.current.has(key))continue;
   saving.current.add(key);
   void save(job).then(()=>{
    waiting.current.delete(job.id);requestedDownloads.delete(job.id);
    try{localStorage.setItem(key,'1')}catch{/* The copied file is already safe. */}
   }).catch(()=>{
    // Keep a failed automatic export available for the explicit download button.
    waiting.current.delete(job.id);requestedDownloads.delete(job.id);
   }).finally(()=>saving.current.delete(key));
  }
 },[jobs,enabled,directory.available,directory.directory]);
 return null;
}
