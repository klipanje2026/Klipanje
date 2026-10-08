import {useEffect,useRef,useState,type RefObject} from 'react';
import {prepareEditingPreview} from './prepare-browser-video';
import {usePreviewQuality} from './preview-quality';
const previews=new WeakMap<File,Map<number,File>>();
const dimensions=new WeakMap<File,{long:number;short:number}>();
let queue:Promise<unknown>=Promise.resolve();
// Display-only files never enter assets, project saves or the export compatibility cache.
export function useEditingPreview(file:File|null,source:string|undefined,ref:RefObject<HTMLVideoElement|null>,enabled=true){
 const quality=usePreviewQuality();
 const [result,setResult]=useState<{source:string;file:File;url:string}|null>(null);
 const [status,setStatus]=useState('');
 const restore=useRef<{time:number;playing:boolean;rate:number}|null>(null);
 const previousSource=useRef(source);
 useEffect(()=>{const video=ref.current;if(!video)return;const resume=()=>{const saved=restore.current;if(!saved)return;restore.current=null;video.currentTime=Math.min(saved.time,Math.max(0,video.duration-.001));video.playbackRate=saved.rate;if(saved.playing)void video.play().catch(()=>{});else video.pause();};video.addEventListener('loadedmetadata',resume);return()=>video.removeEventListener('loadedmetadata',resume);},[ref,source]);
 useEffect(()=>()=>{if(result)URL.revokeObjectURL(result.url);},[result]);
 useEffect(()=>{
  setStatus('');
  if(previousSource.current!==source){restore.current=null;setResult(null);previousSource.current=source;}
  if(!file||!source)return;
  const video=ref.current;if(!video)return;
  const snapshot=()=>{restore.current={time:video.currentTime,playing:!video.paused,rate:video.playbackRate};};
  if(!enabled||quality==='original'){snapshot();setResult(null);return;}
  const height=quality==='1080'?1080:720,width=height===1080?1920:1280;
  const task=new AbortController();let started=false;
  const inspect=()=>{
   if(started||task.signal.aborted||video.readyState<1)return;
   let size=dimensions.get(file);
   if(!size){if(video.getAttribute('src')!==source)return;size={long:Math.max(video.videoWidth,video.videoHeight),short:Math.min(video.videoWidth,video.videoHeight)};dimensions.set(file,size);}
   started=true;
   if(size.long<=width&&size.short<=height){snapshot();setResult(null);return;}
   setStatus(`Priprema ${height}p pregleda…`);
   const work=async()=>{
    task.signal.throwIfAborted();
    let preview=previews.get(file)?.get(height);
    if(!preview){preview=await prepareEditingPreview(file,task.signal,p=>{if(!task.signal.aborted)setStatus(`Priprema ${height}p pregleda${p.percent===null?'…':` · ${p.percent}%`}`);},height);const cache=previews.get(file)||new Map<number,File>();cache.set(height,preview);previews.set(file,cache);}
    task.signal.throwIfAborted();snapshot();setResult({source,file,url:URL.createObjectURL(preview)});setStatus('');
   };
   const pending=queue.then(work);queue=pending.catch(()=>{});
   void pending.catch(error=>{if(!task.signal.aborted){setStatus('');console.warn('Edita preview preparation failed:',error);}});
  };
  video.addEventListener('loadedmetadata',inspect);inspect();
  return()=>{task.abort();video.removeEventListener('loadedmetadata',inspect);};
 },[file,source,ref,enabled,quality]);
 return {src:result&&result.source===source&&result.file===file?result.url:source,status:enabled?status:''};
}
