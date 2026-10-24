import {StudioIcon} from './StudioIcon/StudioIcon';
import {scriptSourceKey,scriptTextKey,scriptChoices,syncScriptDocument} from '../lib/script-montage-sync';
import {localConfirm,localQuestion} from './LocalDialog';
import {rememberMediaTiming} from '../lib/narration-sync';
import {useEffect,useImperativeHandle,useRef,useState,type Ref} from 'react';
import {apiFetch,apiJson,ApiError} from '../lib/api';
import {jsonBody,uploadAsset,type Script,type Asset} from '../lib/production';
import type {ProjectSaveHandle,ProjectSnapshot} from './ProjectToolbar/ProjectToolbar';
import {EditorHeaderPortal} from './EditorHeaderPortal/EditorHeaderPortal';
import {useProduction} from './ProductionWorkspace';
import {editorIntervals} from '../lib/script-editor-sync';
const remoteFiles=new WeakMap<File,string>();
export function rememberRemoteFile(file:File,id:string){remoteFiles.set(file,id);}
export function remoteFileId(file:File){return remoteFiles.get(file);}
export type LocalEditorDocument={editor:'edita';data:Record<string,unknown>;files:{key:string;id:string}[]};
export function LocalVideoStorage({script,snapshot,restore,saveHandle,changeKey,disabled}:{script:Script;snapshot:()=>Promise<ProjectSnapshot>;restore:(data:Record<string,unknown>,files:Map<string,File>)=>Promise<void>;saveHandle:Ref<ProjectSaveHandle>;changeKey?:string;disabled:boolean}){
 const [reload,setReload]=useState(0);
 const revision=useRef<string|undefined>(undefined),ready=useRef(false);
 const {putScript}=useProduction();const [message,setMessage]=useState(''),[opening,setOpening]=useState(true),[busy,setBusy]=useState(false),[blocked,setBlocked]=useState(false);const latest=useRef({script,snapshot,restore,putScript,changeKey});latest.current={script,snapshot,restore,putScript,changeKey};const activeSave=useRef<Promise<boolean>|null>(null),lastSaved=useRef(''),savedKey=useRef(''),failedKey=useRef('');

 const sourceState=useRef(scriptSourceKey(script)),choiceState=useRef(scriptChoices(script)),sourceText=useRef(scriptTextKey(script.segments)),syncing=useRef(false);
 async function refreshSource(fresh?:Script):Promise<boolean>{
  if(!ready.current||syncing.current||activeSave.current||!latest.current.changeKey)return false;
  syncing.current=true;
  try{
   fresh??=await apiJson<Script>(`/api/scripts/${script.id}`);
   if(scriptSourceKey(fresh)===sourceState.current&&JSON.stringify(scriptChoices(fresh))===JSON.stringify(choiceState.current))return false;
   if(revision.current!==fresh.storyboardRevision){setBlocked(true);ready.current=false;setMessage('Drugi prozor je spremio noviju montažu. Ponovo učitaj montažu.');return false;}
   const snap=await latest.current.snapshot();
   if(scriptSourceKey({segments:editorIntervals(snap.data,latest.current.script)})!==sourceState.current){setMessage('Skripta je promijenjena u drugom prozoru. Spremi trenutne izmjene prije osvježavanja.');return false;}
   const refs=snap.files.flatMap(f=>{const id=remoteFiles.get(f.file);return id?[{key:f.key,id}]:[];});
   const files=new Map(snap.files.map(f=>[f.key,f.file]));
   const prior={...snap.data,scriptSync:{sourceKey:sourceState.current,choices:choiceState.current}};
   const next=syncScriptDocument(prior,fresh),list=await apiJson<{assets:Asset[]}>(`/api/projects/${script.project}/assets`);
   await syncNarrations(next,prior,fresh,list.assets,files,refs);
   ready.current=false;await latest.current.restore(next,files);
   sourceState.current=scriptSourceKey(fresh);choiceState.current=scriptChoices(fresh);sourceText.current=scriptTextKey(fresh.segments);
   latest.current.script=fresh;latest.current.putScript(fresh);ready.current=true;failedKey.current='';setMessage('Skripta i odabrane naracije su osvježene.');return true;
  }catch(e){saveError.current=(e as Error).message;setMessage(saveError.current);if(!ready.current)setBlocked(true);return false;}finally{syncing.current=false;}
 }
 const refreshRef=useRef(refreshSource);refreshRef.current=refreshSource;
 useEffect(()=>{const refresh=()=>{if(document.visibilityState==='visible')void refreshRef.current();};window.addEventListener('focus',refresh);const timer=setInterval(refresh,15000);return()=>{window.removeEventListener('focus',refresh);clearInterval(timer);};},[script.id]);
 const saveError=useRef(''),acceptedText=useRef(''),rejectedText=useRef('');
 async function save():Promise<boolean>{
  if(activeSave.current)return activeSave.current;
  if(syncing.current){saveError.current='Usklađivanje skripte je u toku. Sačekaj trenutak pa spremi.';return false;}
  if(!ready.current||opening||disabled||blocked||!latest.current.changeKey){saveError.current=blocked?(saveError.current||'Spremanje je blokirano. Provjeri poruku pored dugmeta Spremi video.'):'Sačekaj da se učitavanje ili obrada završi, pa pokušaj ponovo.';return false;}
  if(savedKey.current===latest.current.changeKey)return true;
  saveError.current='';setBusy(true);setMessage('Spremanje…');
  const task=(async()=>{try{
   do {
    const keyAtStart=latest.current.changeKey;
    if(!keyAtStart)throw new Error('Učitavanje medija je u toku. Sačekaj završetak pa spremi video.');
    const s=await latest.current.snapshot();const freshSource=await apiJson<Script>(`/api/scripts/${latest.current.script.id}`);if(scriptSourceKey(freshSource)!==sourceState.current||JSON.stringify(scriptChoices(freshSource))!==JSON.stringify(choiceState.current)){throw new Error('Skripta je promijenjena u drugom prozoru. Editor će preuzeti nove kadrove pri osvježavanju; trenutna montaža nije prepisana.');}const files=[];for(const item of s.files){let id=remoteFiles.get(item.file);if(!id){const clips=Array.isArray(s.data.clips)?s.data.clips as {assetId:string;audioRole?:'narration'|'sound'|'music'}[]:[];const audioRole=clips.find(c=>c.assetId===item.key)?.audioRole;const asset=await uploadAsset(latest.current.script.project,item.file,{scriptId:latest.current.script.id,audioRole,purpose:item.file.type.startsWith('audio/')?(audioRole==='narration'?'narration':'audio'):'image'});id=asset.id;remoteFiles.set(item.file,id);}files.push({key:item.key,id});}const source=freshSource;
    const intervals=editorIntervals(s.data,source);
    const changedText=scriptTextKey(intervals)!==scriptTextKey(source.segments);
    const editKey=scriptTextKey(intervals);
    if(changedText&&acceptedText.current!==editKey){
      if(rejectedText.current===editKey)return false;
      if(!await localConfirm('Promijeniti skriptu prema titlovima iz editora? Novi tekst i kadrovi koristit će se i za generisanje naracije.','Uskladi skriptu','Promijeni skriptu')){rejectedText.current=editKey;failedKey.current=latest.current.changeKey||'';saveError.current='Promjena skripte nije potvrđena.';setMessage(saveError.current);return false;}
      acceptedText.current=editKey;
    }
    s.data.scriptSync={sourceKey:scriptSourceKey({segments:intervals}),choices:scriptChoices(source)};
    const result=await apiJson<Script>(`/api/scripts/${latest.current.script.id}`,jsonBody({expectedStoryboardRevision:revision.current,expectedScriptUpdatedAt:source.updated_at,segments:intervals,...changedText?{content:intervals.map(s=>s.text).join("\n\n")}: {},storyboard:{editor:'edita',data:s.data,files}},'PATCH'));revision.current=result.storyboardRevision;lastSaved.current=JSON.stringify(s.data);savedKey.current=keyAtStart||'';sourceState.current=scriptSourceKey(result);choiceState.current=scriptChoices(result);sourceText.current=scriptTextKey(result.segments);latest.current.script=result;latest.current.putScript(result);setMessage(`Spremljeno · ${new Date(String(result.storyboard.savedAt||result.updated_at)).toLocaleTimeString('hr-HR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}`);
   } while(savedKey.current!==latest.current.changeKey);
   return true;
  }catch(e){failedKey.current=latest.current.changeKey||'';saveError.current=(e as Error).message;setMessage(saveError.current);if(e instanceof ApiError&&e.status===409){ready.current=false;setBlocked(true);}return false;}
  finally{setBusy(false);activeSave.current=null;}})();
  activeSave.current=task;return task;
 }

 async function manualSave(){
  const choice=await localQuestion({title:'Spremi video',message:'Spremi trenutne izmjene u postojeći video. Nova verzija čuva zasebnu tačku za kasniji povratak.',options:[{value:'cancel',label:'Odustani'},{value:'version',label:'Spremi kao novu verziju'},{value:'save',label:'Spremi postojeći',primary:true}]});
  if(!choice||choice==='cancel')return;
  failedKey.current='';rejectedText.current='';
  if(!await save()||choice!=='version')return;
  setBusy(true);
  try{const result=await apiJson<{title:string}>(`/api/scripts/${script.id}/versions`,jsonBody({expectedStoryboardRevision:revision.current}));setMessage(`${result.title} sačuvana · Spremljeni videi`);}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}
 }
 useImperativeHandle(saveHandle,()=>({save,getSaveError:()=>saveError.current}));
 useEffect(()=>{let active=true;ready.current=false;void(async()=>{try{const fresh=await apiJson<Script>(`/api/scripts/${script.id}`);if(!active)return;revision.current=fresh.storyboardRevision;latest.current.script=fresh;latest.current.putScript(fresh);const doc=fresh.storyboard as unknown as Partial<LocalEditorDocument>;if(doc.editor==='edita'&&(!doc.data||!Array.isArray(doc.files)))throw new Error('Spremljena montaža nije potpuna. Automatsko spremanje je zaustavljeno.');if(doc.editor==='edita'&&doc.data&&doc.files){const list=await apiJson<{assets:Asset[]}>(`/api/projects/${script.project}/assets`);const files=new Map<string,File>();for(const ref of doc.files){const a=list.assets.find(a=>a.id===ref.id);if(!a)throw new Error('Nedostaje datoteka projekta.');const r=await apiFetch(a.url);if(!r.ok)throw new Error('Datoteka se ne može učitati.');const file=new File([await r.blob()],a.name,{type:a.contentType});rememberRemoteFile(file,a.id);rememberMediaTiming(file,{segmentIds:a.metadata.segmentIds||[a.metadata.segmentId||''].filter(Boolean),narration:a.metadata.narration});files.set(ref.key,file);}if(active){const synced=syncScriptDocument(doc.data,fresh);
      await syncNarrations(synced,doc.data,fresh,list.assets,files,doc.files);
      synced.scriptSync={sourceKey:scriptSourceKey(fresh),choices:scriptChoices(fresh)};
      if(!active)return;await latest.current.restore(synced,files);lastSaved.current=JSON.stringify(synced);}}else if(active){const snap=await latest.current.snapshot(),list=await apiJson<{assets:Asset[]}>(`/api/projects/${script.project}/assets`);const next=syncScriptDocument(snap.data,fresh),files=new Map(snap.files.map(f=>[f.key,f.file]));await syncNarrations(next,snap.data,fresh,list.assets,files,[]);if(!active)return;await latest.current.restore(next,files);}if(active){sourceState.current=scriptSourceKey(fresh);choiceState.current=scriptChoices(fresh);sourceText.current=scriptTextKey(fresh.segments);ready.current=true;setMessage(doc.editor==='edita'?`Spremljeno · ${new Date(String(fresh.storyboard.savedAt||fresh.updated_at)).toLocaleString('hr-HR')}`:'Još nije spremljeno');}}catch(e){if(active){saveError.current=(e as Error).message;setMessage(saveError.current);setBlocked(true);}}finally{if(active)setOpening(false);}})();return()=>{active=false;};},[script.id,reload]);
 useEffect(()=>{if(opening||disabled||busy||blocked||!changeKey||changeKey===savedKey.current||changeKey===failedKey.current)return;setMessage('Nespremljene izmjene');},[changeKey,opening,disabled,busy,blocked]);
 return <><EditorHeaderPortal slot="project"><div className="local-video-save"><strong>{script.title}</strong><small role="status">{opening?'Učitavanje…':message}</small>{blocked&&<button disabled={busy||opening} onClick={async()=>{if(await localConfirm('Ponovo učitati posljednju spremljenu montažu? Trenutne nespremljene izmjene bit će zamijenjene.','Ponovno učitavanje','Učitaj spremljeno')){ready.current=false;setOpening(true);setBlocked(false);setReload(value=>value+1);}}}>Ponovo učitaj montažu</button>}<button className="local-save-icon" title="Spremi video" aria-label="Spremi video" disabled={busy||opening||disabled||blocked} onClick={()=>void manualSave()}><StudioIcon name="save"/></button><button className="local-save-icon" aria-label="Spremljeni videi" title="Spremljeni videi i verzije" disabled={busy||opening} onClick={()=>window.dispatchEvent(new Event('klipanje-saved-videos'))}><StudioIcon name="menu"/></button></div></EditorHeaderPortal>{opening&&<div className="local-video-opening" role="status">Učitavanje montaže…</div>}</>;
}

async function syncNarrations(data:Record<string,unknown>,prior:Record<string,unknown>,script:Script,assets:Asset[],files:Map<string,File>,refs:{key:string;id:string}[]){
 const choices=scriptChoices(script),previous=(prior.scriptSync as {choices?:Record<string,string>}|undefined)?.choices;
 type Clip={id:string;assetId:string;type:string;audioRole?:string;narrationSegmentIds?:string[];start:number;inPoint:number;outPoint:number;layer:number};
 let clips=[...((data.clips||[]) as Clip[])];
 const descriptions=[...((data.assets||[]) as {id:string;name:string;type:string;duration:number;aspectRatio:number}[])];
 for(const [sceneId,assetId] of Object.entries(choices)){
  if(!assetId)continue;
  const asset=assets.find(a=>a.id===assetId),scene=script.segments.find(s=>s.id===sceneId);if(!asset||!scene)continue;
  const existing=refs.find(r=>r.id===assetId);
  if(existing&&clips.some(c=>c.assetId===existing.key))continue;
  const selectedIds=Object.keys(choices).filter(id=>choices[id]===assetId);
  const related=clips.filter(c=>{if(c.audioRole!=='narration')return false;const original=assets.find(a=>a.id===refs.find(r=>r.key===c.assetId)?.id);const ids=c.narrationSegmentIds?.length?c.narrationSegmentIds:original?.metadata.segmentIds||[original?.metadata.segmentId||''];return ids.some(id=>selectedIds.includes(id));});
  const newer=asset.created_at&&asset.created_at>String((script.storyboard as {savedAt?:string}).savedAt||'');
  // An unchanged choice deliberately removed from the timeline stays removed.
  if(previous?previous[sceneId]===assetId:!related.length&&!newer)continue;
  let key=existing?.key;
  if(!key){const response=await apiFetch(asset.url);if(!response.ok)throw new Error('Odabrana naracija nije dostupna.');key=crypto.randomUUID();const file=new File([await response.blob()],asset.name,{type:asset.contentType});rememberRemoteFile(file,asset.id);rememberMediaTiming(file,{segmentIds:asset.metadata.segmentIds||[sceneId],narration:asset.metadata.narration});files.set(key,file);refs.push({key,id:asset.id});descriptions.push({id:key,name:asset.name,type:'audio',duration:asset.metadata.narration?.duration||scene.end-scene.start,aspectRatio:16/9});}
  clips=clips.filter(c=>!related.includes(c));
  clips.push({id:crypto.randomUUID(),assetId:key,type:'audio',audioRole:'narration',narrationSegmentIds:selectedIds,name:asset.name,start:Math.min(...script.segments.filter(s=>selectedIds.includes(s.id)).map(s=>s.start)),inPoint:0,outPoint:asset.metadata.narration?.duration||scene.end-scene.start,volume:100,muted:false,layer:Math.max(1,...clips.map(c=>c.layer))+1} as Clip);
 }
 data.clips=clips;data.assets=descriptions;
}
