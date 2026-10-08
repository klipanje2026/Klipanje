import {useSyncExternalStore} from 'react';
export type PreviewQuality='720'|'1080'|'original';
const key='edita-preview-quality';
const read=():PreviewQuality=>{try{const v=localStorage.getItem(key);return v==='1080'||v==='original'?v:'720';}catch{return '720';}};
let quality:PreviewQuality=read();const listeners=new Set<()=>void>();
export function setPreviewQuality(value:PreviewQuality){quality=value;try{localStorage.setItem(key,value);}catch{}listeners.forEach(fn=>fn());}
const subscribe=(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn);};};
export const usePreviewQuality=()=>useSyncExternalStore(subscribe,()=>quality,()=> '720' as PreviewQuality);
