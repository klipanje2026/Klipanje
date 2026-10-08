import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {useAuth} from '../context/auth-context';
import {apiJson} from '../lib/api';
import {StudioIcon} from './StudioIcon/StudioIcon';

export type Announcement = {id:string; title:string; message:string; tone:'info'|'update'|'maintenance'; version:number; expires_at:string|null; active?:boolean; published_at?:string|null; created_at?:string};
const noticeKey = (item:Announcement) => `${item.id}:${item.version}`;
function readDismissed(key:string):string[] {
  try {const value:unknown=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(value)?value.filter((v):v is string=>typeof v==='string'):[];} catch {return [];}
}

export function AnnouncementContent({item,onClose,preview=false}:{item:Pick<Announcement,'title'|'message'|'tone'>;onClose?:()=>void;preview?:boolean}) {
  return <div className={`announcement-strip tone-${item.tone}${preview?' is-preview':''}`}>
    <span className="announcement-icon" aria-hidden="true"><StudioIcon name={item.tone==='maintenance'?'settings':'spark'}/></span>
    <div className="announcement-copy" role={preview?undefined:'status'}><strong>{item.title}</strong><span>{item.message}</span></div>
    <button type="button" aria-label="Zatvori obavijest" onClick={onClose} disabled={preview}><StudioIcon name="close"/></button>
  </div>;
}

export function Announcements() {
  const {session}=useAuth();
  const storageKey=`edita-announcements:${session.user?.id??'guest'}`;
  const [items,setItems]=useState<Announcement[]>([]);
  const [dismissed,setDismissed]=useState<string[]>([]);
  const bar=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    setItems([]);setDismissed(readDismissed(storageKey));
    const controller=new AbortController();let loading=false;
    const load=async()=>{
      if(loading||document.hidden)return;
      loading=true;
      try {const data=await apiJson<{items:Announcement[]}>('/api/announcements',{signal:controller.signal,cache:'no-store'});if(!controller.signal.aborted)setItems(data.items);} catch {/* An unavailable notice service must not interrupt editing. */} finally {loading=false;}
    };
    const sync=()=>setDismissed(readDismissed(storageKey));
    void load();const timer=window.setInterval(()=>void load(),30000);
    window.addEventListener('storage',sync);window.addEventListener('edita-announcements-updated',load);document.addEventListener('visibilitychange',load);
    return()=>{controller.abort();clearInterval(timer);window.removeEventListener('storage',sync);window.removeEventListener('edita-announcements-updated',load);document.removeEventListener('visibilitychange',load);};
  },[storageKey]);
  const item=items.find(row=>!dismissed.includes(noticeKey(row))&&(!row.expires_at||Date.parse(row.expires_at)>Date.now()));
  useLayoutEffect(()=>{
    const root=document.documentElement;
    const measure=()=>root.style.setProperty('--announcement-height',`${bar.current?.getBoundingClientRect().height??0}px`);
    measure();const observer=new ResizeObserver(measure);if(bar.current)observer.observe(bar.current);
    return()=>{observer.disconnect();root.style.removeProperty('--announcement-height');};
  },[item?.id,item?.version]);
  function close() {
    if(!item)return;
    const next=[...new Set([...readDismissed(storageKey),...dismissed,noticeKey(item)])].slice(-200);
    setDismissed(next);try {localStorage.setItem(storageKey,JSON.stringify(next));}catch {/* Keep the in-memory dismissal. */}
    if(session.user)void apiJson(`/api/announcements/${item.id}/dismiss`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({version:item.version})}).catch(()=>{});
  }
  return item?<><div className="announcement-spacer"/><aside ref={bar} className="announcement-global" aria-label="Obavijest Edite"><AnnouncementContent item={item} onClose={close}/></aside></>:null;
}
