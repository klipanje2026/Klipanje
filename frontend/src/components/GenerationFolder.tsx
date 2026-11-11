import {importGenerationFolder} from '../lib/generation-folder-import';
import {useEffect,useRef,useState} from 'react';
import {apiJson} from '../lib/api';
import {uploadAsset,type Asset,type Script} from '../lib/production';
type Folder={name:string;kind:'directory';values:()=>AsyncIterable<Folder|{name:string;kind:'file';getFile:()=>Promise<File>}>;queryPermission:(v:{mode:'read'})=>Promise<string>;requestPermission:(v:{mode:'read'})=>Promise<string>};
async function folderStore(key:string,handle?:Folder){
 const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open('klipanje-generation-folders',1);request.onupgradeneeded=()=>request.result.createObjectStore('folders');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
 try{return await new Promise<Folder|undefined>((resolve,reject)=>{const tx=db.transaction('folders',handle?'readwrite':'readonly'),store=tx.objectStore('folders'),request=handle?store.put(handle,key):store.get(key);tx.oncomplete=()=>resolve(handle||request.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}finally{db.close();}
}
export function GenerationFolder({script,onAssets,onBusy}:{script:Script;onAssets:(assets:Asset[])=>void;onBusy:(busy:boolean)=>void}){
 const [folder,setFolder]=useState<Folder>(),[busy,setBusy]=useState(false),[message,setMessage]=useState('');const running=useRef(false);
 useEffect(()=>{let active=true;void folderStore(script.id).then(f=>{if(active)setFolder(f);}).catch(()=>{});return()=>{active=false;};},[script.id]);
 async function choose(){try{const picker=(window as unknown as {showDirectoryPicker?:()=>Promise<Folder>}).showDirectoryPicker;if(!picker)throw new Error('Odabir foldera koristi Microsoft Edge. Ručni uvoz slika je i dalje dostupan.');const next=await picker();await folderStore(script.id,next);setFolder(next);setMessage('Folder je odabran. Klikni Osvježi generacije za uvoz novih slika.');}catch(e){if((e as Error).name!=='AbortError')setMessage((e as Error).message);}}
 async function refresh(){if(running.current)return;running.current=true;setBusy(true);onBusy(true);setMessage('');let imported=0;try{
  if(folder&&await folder.queryPermission({mode:'read'})!=='granted'&&await folder.requestPermission({mode:'read'})!=='granted')throw new Error('Potrebna je dozvola za čitanje odabranog foldera.');
  const current=await apiJson<{assets:Asset[]}>(`/api/projects/${script.project}/assets`);let all=current.assets;onAssets(all);
  let skipped=0;
  if(folder){const result=await importGenerationFolder(folder.values(),all.filter(a=>a.metadata.scriptId===script.id),(file,hash)=>uploadAsset(script.project,file,{scriptId:script.id,purpose:'image',gallery:false,sourceFingerprint:hash,sourceFolder:folder.name}),asset=>{all=[asset,...all];onAssets(all);imported++;window.dispatchEvent(new CustomEvent('klipanje-asset-added',{detail:{project:script.project,asset}}));});skipped=result.skipped;}
  setMessage(folder?`Osvježeno · dodano ${imported} novih slika iz foldera ${folder.name}.${skipped?` Preskočeno ${skipped} praznih slika ili slika preko 50 MB.`:''}`:'Mediji osvježeni. Odaberi folder za pronalaženje novih slika na računaru.');
 }catch(e){setMessage(`Uvezeno ${imported} slika. ${(e as Error).message}`);}finally{running.current=false;setBusy(false);onBusy(false);}}
 return <div className="generation-folder"><button disabled={busy} onClick={()=>void choose()}>{folder?'Promijeni folder':'Odaberi folder generacija'}</button><button disabled={busy} onClick={()=>void refresh()}>{busy?'Osvježavanje…':'Osvježi generacije'}</button>{folder&&<small>Folder: {folder.name}</small>}{message&&<p role="status">{message}</p>}</div>;
}
