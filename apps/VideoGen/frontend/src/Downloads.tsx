import {createContext,useContext,useEffect,useRef,useState} from 'react';
import type {ReactNode} from 'react';
import {Download,FolderOpen,LoaderCircle} from 'lucide-react';
import type {Job} from './App';

type Directory={directory:string;available:boolean};
type Api=(path:string,options?:RequestInit)=>Promise<any>;
type Downloads={
 directory:Directory;choosing:boolean;saving:string[];message:string;error:string;
 choose:()=>Promise<Directory>;save:(job:Job,original?:boolean)=>Promise<void>;
};
const Context=createContext<Downloads|null>(null);

export function DownloadProvider({api,children}:{api:Api;children:ReactNode}){
 const apiRef=useRef(api);apiRef.current=api;
 const [directory,setDirectory]=useState<Directory>({directory:'',available:false});
 const [choosing,setChoosing]=useState(false),[saving,setSaving]=useState<string[]>([]);
 const [message,setMessage]=useState(''),[error,setError]=useState('');
 useEffect(()=>{apiRef.current('creative/download-directory/').then(setDirectory).catch(e=>setError(e.message))},[]);

 async function choose(){
  setChoosing(true);setError('');setMessage('Odaberi folder u otvorenom prozoru.');
  try{
   const selected:Directory&{cancelled:boolean}=await apiRef.current('creative/download-directory/',{method:'POST'});
   setDirectory(selected);setMessage(selected.cancelled?'Odabir je zatvoren.':`Odabrani folder: ${selected.directory}`);
   return selected;
  }catch(cause){setMessage('');setError((cause as Error).message);throw cause}
  finally{setChoosing(false)}
 }

 async function save(job:Job,original=false){
  setError('');setSaving(old=>[...old,job.id]);
  try{
   const selected=directory.available?directory:await choose();
   if(!selected.available)throw new Error('Odaberi folder prije preuzimanja videa.');
   const result=await apiRef.current(`creative/videos/${job.id}/save/`,{
    method:'POST',body:JSON.stringify({original,revision:job.processing_info?.revision}),
   });
   setMessage(`Spremljeno: ${result.path}`);
  }catch(cause){setMessage('');setError((cause as Error).message);throw cause}
  finally{setSaving(old=>old.filter(id=>id!==job.id))}
 }
 return <Context.Provider value={{directory,choosing,saving,message,error,choose,save}}>
  {children}
  {(message||error)&&<div className={'download-result '+(error?'error':'')} role={error?'alert':'status'}>{error||message}</div>}
 </Context.Provider>;
}

export function useDownloads(){
 const value=useContext(Context);
 if(!value)throw new Error('DownloadProvider nije postavljen.');
 return value;
}

export function DownloadFolder(){
 const {directory,choosing,choose}=useDownloads();
 return <section className="panel download-folder" aria-label="Folder za preuzimanje">
  <FolderOpen size={23}/><div><strong>Folder za preuzimanje videa</strong>
   <p>{directory.directory||'Odaberi gdje želiš spremati svoje generacije.'}</p>
   <small>{directory.available?'Dugme Preuzmi sprema MP4 direktno u ovaj folder.':directory.directory?'Folder trenutno nije dostupan. Odaberi dostupan folder.':'Folder se pamti za sljedeće preuzimanje.'}</small>
  </div><button className="button secondary" disabled={choosing} onClick={()=>void choose().catch(()=>{})}>
   {choosing?<LoaderCircle size={16} className="spin"/>:<FolderOpen size={16}/>}
   {choosing?'Odabir foldera…':directory.directory?'Promijeni folder':'Odaberi folder'}
  </button>
 </section>;
}

export function DownloadButton({job,original=false,children,className,iconOnly=false}:{
 job:Job;original?:boolean;children?:ReactNode;className?:string;iconOnly?:boolean;
}){
 const {save,saving,choosing}=useDownloads();
 const busy=saving.includes(job.id);
 const label=original?'Preuzmi original':'Preuzmi video';
 return <button className={className||'text-button'} disabled={busy||choosing} aria-label={iconOnly?label:undefined}
  onClick={()=>void save(job,original).catch(()=>{})}>
  {busy?<LoaderCircle size={16} className="spin"/>:<Download size={16}/>}
  {!iconOnly&&(children||label)}
 </button>;
}
