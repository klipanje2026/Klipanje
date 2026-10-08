import {useEffect,useState} from 'react';
import type {RefObject} from 'react';
import {scanPersonMasks} from './person-mask-scan';
/** Source changes are observed without coupling scans to timeline renders. */
export function usePersonMaskScan(enabled:boolean,videoRef?:RefObject<HTMLVideoElement|null>,mediaRefs?:RefObject<Map<string,HTMLMediaElement>>){
 const [status,setStatus]=useState('');
 useEffect(()=>{
  if(!enabled){setStatus('');return;}
  const active=new Map<string,{dispose:()=>void;status:string}>();
  const sync=()=>{
   const videos=videoRef?[videoRef.current]:Array.from(mediaRefs?.current.values()||[]);
   const urls=new Set(videos.filter((v):v is HTMLVideoElement=>v instanceof HTMLVideoElement&&!!v.currentSrc).map(v=>v.currentSrc));
   for(const [url,entry] of active)if(!urls.has(url)){entry.dispose();active.delete(url);}
   for(const video of videos){if(!(video instanceof HTMLVideoElement)||video.readyState<2||!video.currentSrc||active.has(video.currentSrc))continue;
    const entry={dispose:()=>{},status:''};active.set(video.currentSrc,entry);
    entry.dispose=scanPersonMasks(video,value=>{entry.status=value;setStatus(Array.from(active.values()).map(v=>v.status).filter(Boolean).join(' · '));});
   }
   if(!active.size)setStatus('');
  };
  sync();const timer=setInterval(sync,1000);
  return()=>{clearInterval(timer);for(const entry of active.values())entry.dispose();};
 },[enabled,videoRef,mediaRefs]);
 return status;
}
