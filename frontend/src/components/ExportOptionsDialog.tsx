import './ExportDialogs.scss';
import {useEffect,useRef,useState} from 'react';
import {LanguageDropdown} from './LanguageDropdown/LanguageDropdown';
import {createPortal} from 'react-dom';
export function exportFilename(name:string){return (name.trim().replace(/\.mp4$/i,'').replace(/[<>:"/\\|?*\x00-\x1f]/g,'-').replace(/[. ]+$/,'')||'edita-video')+'.mp4';}
export type ExportOptions={filename?:string;quality:'full'|'balanced'|'small';fps?:number;maxEdge?:number};
export function ExportOptionsDialog({onClose,onExport,defaultName='edita-video'}:{defaultName?:string;onClose:()=>void;onExport:(options:ExportOptions)=>void}){
 const ref=useRef<HTMLDialogElement>(null);
 const [filename,setFilename]=useState(defaultName);
 const [quality,setQuality]=useState<ExportOptions['quality']>('full'),[fps,setFps]=useState(0),[maxEdge,setMaxEdge]=useState(0);
 useEffect(()=>{ref.current?.showModal();const dialog=ref.current;return()=>dialog?.close();},[]);
 return createPortal(<dialog ref={ref} className="export-options-dialog" aria-label="Opcije izvoza" onCancel={onClose}>
 <header><h2>Izvezi video</h2><button type="button" aria-label="Zatvori opcije izvoza" onClick={onClose}>×</button></header>
 <p>MP4 · Video s titlovima i zvukom</p>
 <label>Naziv datoteke<div className="export-filename"><input aria-label="Naziv datoteke" value={filename} onChange={e=>setFilename(e.target.value)} maxLength={180}/><span>.mp4</span></div></label>
 <LanguageDropdown label="Rezolucija" value={String(maxEdge)} onChange={v=>setMaxEdge(Number(v))} options={[{value:'0',label:'Originalna rezolucija'},{value:'3840',label:'Do 4K'},{value:'1920',label:'Do 1080p'},{value:'1280',label:'Do 720p'}]}/>
 <LanguageDropdown label="Broj kadrova (FPS)" value={String(fps)} onChange={v=>setFps(Number(v))} options={[{value:'0',label:'Originalni kadrovi'},...[24,25,30,50,60].map(n=>({value:String(n),label:`${n} FPS`}))]}/>
 <LanguageDropdown label="Kvalitet" value={quality} onChange={v=>setQuality(v as ExportOptions['quality'])} options={[{value:'full',label:'Najviši kvalitet'},{value:'balanced',label:'Uravnoteženo'},{value:'small',label:'Manja datoteka'}]}/>
 <small>Original ostaje sačuvan. Izvoz zadržava omjer videa i ne povećava izvornu rezoluciju.</small>
 <footer><button type="button" onClick={onClose}>Odustani</button><button type="button" onClick={()=>onExport({filename:exportFilename(filename),quality,fps:fps||undefined,maxEdge:maxEdge||undefined})}>Preuzmi video</button></footer>
 </dialog>,document.body);
}
