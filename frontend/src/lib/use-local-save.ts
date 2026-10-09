import {useEffect,useRef,useState} from 'react';
import {useNavigate} from 'react-router-dom';

export function useLocalSave<T>(data:T,persist:(value:T)=>Promise<void>,{auto=true,guardNavigation=true}:{auto?:boolean;guardNavigation?:boolean}={}){
 const navigate=useNavigate(),key=JSON.stringify(data);
 const latest=useRef({data,key,persist});latest.current={data,key,persist};
 const saved=useRef(key),pending=useRef<Promise<boolean>|null>(null);
 const [status,setStatus]=useState('Sve izmjene spremljene'),[busy,setBusy]=useState(false);
 const dirty=key!==saved.current;
 async function save(){
  if(pending.current){if(!await pending.current)return false;}
  if(saved.current===latest.current.key){setStatus('✓ Spremljeno');return true;}
  const task=(async()=>{setBusy(true);try{
   do{const current=latest.current;setStatus('Spremanje…');await current.persist(current.data);saved.current=current.key;}while(saved.current!==latest.current.key);
   setStatus('✓ Spremljeno');return true;
  }catch(e){setStatus('Spremanje nije uspjelo: '+(e as Error).message);return false;}
  finally{setBusy(false);pending.current=null;}})();pending.current=task;return task;
 }
 const action=useRef(save);action.current=save;
 useEffect(()=>{if(!dirty||!auto)return;setStatus('Izmjene čekaju spremanje…');const timer=setTimeout(()=>void action.current(),900);return()=>clearTimeout(timer);},[key,auto]);
 useEffect(()=>{
  const click=(event:MouseEvent)=>{if(!guardNavigation||event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey)return;
   const link=(event.target as Element)?.closest('a[href]') as HTMLAnchorElement|null;
   if(!link||link.target==='_blank'||link.hasAttribute('download')||link.origin!==location.origin||saved.current===latest.current.key)return;
   event.preventDefault();event.stopPropagation();void action.current().then(ok=>{if(ok)navigate(link.pathname+link.search+link.hash);});
  };
  const unload=(event:BeforeUnloadEvent)=>{if(saved.current!==latest.current.key){event.preventDefault();event.returnValue='';}};
  document.addEventListener('click',click,true);window.addEventListener('beforeunload',unload);
  return()=>{document.removeEventListener('click',click,true);window.removeEventListener('beforeunload',unload);};
 },[navigate,guardNavigation]);
 return {save,busy,status,dirty};
}
