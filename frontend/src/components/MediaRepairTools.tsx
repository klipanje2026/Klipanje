import {useEffect,useRef,useState} from 'react';
import {prepareBrowserVideo} from '../lib/prepare-browser-video';
import {reportEditorFailure} from '../lib/diagnostics';
import {useLoadingLeaveGuard} from '../lib/use-loading-leave-guard';
import './MediaRepairTools.scss';
type Kind='video'|'audio'|'export';
export function MediaRepairTools({file,disabled,onPrepared,onExportRepair,onBusy,onCaptions,captionsBusy=false}:{onCaptions?:()=>void;captionsBusy?:boolean;file:File|null;disabled:boolean;onPrepared:(file:File,kind:Kind)=>void;onExportRepair:()=>Promise<void>;onBusy:(busy:boolean)=>void}){
 const [busy,setBusy]=useState(false),[status,setStatus]=useState(''),[error,setError]=useState('');
 const panel=useRef<HTMLDetailsElement>(null);
 const task=useRef<AbortController|null>(null);useLoadingLeaveGuard(busy);
 useEffect(()=>()=>{task.current?.abort();task.current=null;},[]);
 useEffect(()=>{task.current?.abort();task.current=null;setBusy(false);onBusy(false);setStatus('');setError('');},[file,onBusy]);
 async function repair(kind:Kind){
  if(!file||disabled||task.current)return;
  const controller=new AbortController();task.current=controller;setBusy(true);onBusy(true);setError('');setStatus('Pripremam kompatibilnu kopiju…');
  try{
   const prepared=await prepareBrowserVideo(file,controller.signal,p=>{if(!controller.signal.aborted)setStatus(p.label+(p.percent===null?'':` · ${p.percent}%`));});
   controller.signal.throwIfAborted();
   if(kind==='export'){setStatus('Pripremam efekte za izvoz…');await onExportRepair();controller.signal.throwIfAborted();}
   onPrepared(prepared,kind);
   setStatus(kind==='export'?'Priprema izvoza završena. Pokušaj ponovo preuzeti video.':kind==='audio'?'Kompatibilni zvuk je pripremljen. Provjeri reprodukciju.':'Kompatibilni video je pripremljen. Provjeri prikaz.');
  }catch(cause){if(!controller.signal.aborted){reportEditorFailure('repair_'+kind);setError(cause instanceof Error?cause.message:'Priprema nije uspjela.');}}
  finally{if(task.current===controller){task.current=null;setBusy(false);onBusy(false);}}
 }
 return <details ref={panel} className="media-repair-tools"><summary aria-label="Alati za popravku" title="Alati za popravku"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M14 6a5 5 0 0 0-6 6L3 17a2.8 2.8 0 0 0 4 4l5-5a5 5 0 0 0 6-6l-3 3-4-4 3-3Z"/></svg></summary><section className="media-repair-panel"><header><strong>Alati za popravku</strong><button type="button" aria-label="Zatvori alate za popravku" onClick={()=>{if(panel.current){panel.current.open=false;panel.current.querySelector("summary")?.focus();}}}>×</button></header><p>Pripremi kompatibilnu kopiju videa i zvuka u izvornoj rezoluciji. Original i titlovi ostaju sačuvani. Pripremljena kopija važi dok je projekat otvoren.</p><div>{(['video','audio','export'] as const).map(kind=><button type="button" key={kind} disabled={!file||disabled||busy} onClick={()=>void repair(kind)}>{kind==='video'?'Popravi video':kind==='audio'?'Popravi zvuk':'Pripremi izvoz ponovo'}</button>)}</div><button type="button" disabled={!file||disabled||busy||captionsBusy} title="Ponovo prepoznaj govor i zamijeni titlove nakon uspješnog prepoznavanja" onClick={onCaptions}>{captionsBusy?"Prepoznavanje…":"Prepoznaj titlove"}</button><small>Popravka zvuka obnavlja zvuk izvornog snimka; ne mijenja odabrani glas ni postavku mute.</small>{status&&<p role="status">{status}</p>}{error&&<p role="alert">{error}</p>}{busy&&<button type="button" onClick={()=>{task.current?.abort();setStatus('Priprema prekinuta.');}}>Prekini</button>}</section></details>;
}
