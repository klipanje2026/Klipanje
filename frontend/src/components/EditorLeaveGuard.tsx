import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {SaveBeforeLeaving} from './SaveBeforeLeaving/SaveBeforeLeaving';
export function allowEditorLeave(){window.dispatchEvent(new Event('edita-leave-approved'));}
export function EditorLeaveGuard({active,onSave,bypass,localProject}:{localProject?:string;active:boolean;onSave:()=>Promise<boolean>;bypass?:()=>boolean}) {
 const [destination,setDestination]=useState<string|null>(null);
 const leaving=useRef(false);
 useEffect(()=>{
  const approve=()=>{leaving.current=true;};
  const warn=(event:BeforeUnloadEvent)=>{if(active&&!leaving.current&&!bypass?.()){event.preventDefault();event.returnValue='';}};
  const click=(event:MouseEvent)=>{
   if(!active||leaving.current||event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
   const anchor=(event.target as Element)?.closest<HTMLAnchorElement>('a[href]');
   if(!anchor||anchor.hasAttribute('download')||(anchor.target&&anchor.target!=='_self'))return;
   const url=new URL(anchor.href,location.href);
   if(!['http:','https:'].includes(url.protocol)||(url.pathname===location.pathname&&url.search===location.search&&url.origin===location.origin))return;
   event.preventDefault();event.stopPropagation();
   setDestination(url.href);
  };
  const navigation=(window as unknown as {navigation?:EventTarget}).navigation;
  const traverse=(event:Event)=>{
   const e=event as Event&{navigationType?:string;destination?:{url:string}};
   if(!active||leaving.current||e.navigationType!=='traverse'||!e.cancelable||!e.destination)return;
   const url=new URL(e.destination.url,location.href);e.preventDefault();
   setDestination(url.href);
  };
  navigation?.addEventListener('navigate',traverse);
  document.addEventListener('click',click,true);window.addEventListener('beforeunload',warn);window.addEventListener('edita-leave-approved',approve);
  return()=>{navigation?.removeEventListener('navigate',traverse);document.removeEventListener('click',click,true);window.removeEventListener('beforeunload',warn);window.removeEventListener('edita-leave-approved',approve);};
 },[active,bypass,localProject,onSave]);
 return createPortal(<SaveBeforeLeaving open={Boolean(destination)} title="Napustiti editor?" description="Možeš odmah izaći i prekinuti spremanje ili sačekati da se video i izmjene spreme." saveLabel="Spremi i izađi" continueLabel="Samo izađi" onSave={onSave} onCancel={()=>setDestination(null)} onContinue={()=>{if(destination){allowEditorLeave();window.location.assign(destination);}}}/>,document.body);
}
