import {useEffect,useRef,useState} from 'react';
import {type Asset,type Script} from '../lib/production';
import {StudioIcon} from './StudioIcon/StudioIcon';

export function assetInMontage(asset:Asset,script:Script){
 const files=script.storyboard.files as {key:string;id:string}[]|undefined;
 const data=script.storyboard.data as {clips?:{assetId:string}[]}|undefined;
 return Array.isArray(files)&&files.some(f=>f.id===asset.id&&Array.isArray(data?.clips)&&data.clips.some(c=>c.assetId===f.key));
}
export function assetScriptIds(asset:Asset,scripts:Script[]){
 return scripts.filter(s=>s.id===asset.metadata.scriptId||Array.isArray(s.storyboard.files)&&s.storyboard.files.some((f:{id?:string})=>f.id===asset.id)).map(s=>s.id);
}
export function ProjectMediaBrowser({assets,scripts,kind,onPreview,onOpenEditor}:{assets:Asset[];scripts:Script[];kind:'photos'|'videos'|'narrations'|'sounds';onPreview:(asset:Asset)=>void;onOpenEditor:(script:Script)=>void}){
 const [query,setQuery]=useState(''),[scriptId,setScriptId]=useState(''),[editorOnly,setEditorOnly]=useState(false);
 const media=assets.filter(a=>!a.metadata.archived&&(kind==='photos'?a.contentType.startsWith('image/'):kind==='videos'?a.contentType.startsWith('video/'):a.contentType.startsWith('audio/')&&(kind==='sounds'?['sound','music'].includes(a.metadata.audioRole||''):!['sound','music'].includes(a.metadata.audioRole||''))));
 const shown=media.filter(a=>(!scriptId||assetScriptIds(a,scripts).includes(scriptId))&&(!editorOnly||scripts.some(s=>(!scriptId||s.id===scriptId)&&assetInMontage(a,s)))&&`${a.name} ${a.metadata.voiceName||''} ${a.metadata.narration?.text||''} ${a.metadata.prompt||''}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
 return <div className="project-media-browser"><div className="project-library-filters"><label>Pretraga<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Naziv, glas ili tekst…"/></label><label>Skripta<select value={scriptId} onChange={e=>setScriptId(e.target.value)}><option value="">Cijeli projekat</option>{scripts.map(s=><option key={s.id} value={s.id}>{s.title}</option>)}</select></label><label className="project-library-check"><input type="checkbox" checked={editorOnly} onChange={e=>setEditorOnly(e.target.checked)}/>U spremljenom editoru</label></div><p>{shown.length} / {media.length} datoteka</p>
 <div className={`project-media-grid ${kind==='narrations'||kind==='sounds'?'audio':''}`}>{shown.map(a=>{const linked=assetScriptIds(a,scripts);return <article key={a.id} className="project-media-card">{a.contentType.startsWith('image/')?<button className="project-media-open" onClick={()=>onPreview(a)} aria-label={`Pregled: ${a.name}`}><img src={a.url} alt={a.name} loading="lazy"/></button>:a.contentType.startsWith('video/')?<><ProjectVideo asset={a}/><button onClick={()=>onPreview(a)}>Otvori veći pregled</button></>:<audio controls preload="none" src={a.url} aria-label={a.name}/>}<strong>{a.name}</strong><small>{(a.size/1e6).toFixed(2)} MB · {linked.length?linked.map(id=>scripts.find(s=>s.id===id)?.title).join(', '):'Projektni medij'}</small>{a.metadata.narration?.text&&<p>{a.metadata.narration.text}</p>}<div className="project-media-meta"><span>{a.metadata.model?'Generisano':a.metadata.purpose==='reference'?'Referenca':'Sačuvano u projektu'}</span><a href={a.url} download={a.name} title="Preuzmi" aria-label={`Preuzmi ${a.name}`}><StudioIcon name="download"/></a></div></article>;})}</div>
 {!shown.length&&<p>Nema medija za odabrani prikaz.</p>}
 {kind==='videos'&&<section className="project-saved-montages"><h3>Spremljene montaže</h3>{scripts.filter(s=>s.storyboard.editor==='edita'&&(!scriptId||s.id===scriptId)).map(s=><div key={s.id}><strong>{String(s.storyboard.title||s.title)}</strong><button onClick={()=>onOpenEditor(s)}>Otvori u editoru</button></div>)}</section>}
 </div>;
}

function ProjectVideo({asset}:{asset:Asset}){
 const ref=useRef<HTMLVideoElement>(null),[visible,setVisible]=useState(false),[failed,setFailed]=useState(false);
 useEffect(()=>{const node=ref.current;if(!node)return;const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){setVisible(true);observer.disconnect();}},{rootMargin:'150px'});observer.observe(node);return()=>observer.disconnect();},[]);
 return <><video ref={ref} controls preload={visible?'metadata':'none'} src={visible?asset.url:undefined} aria-label={asset.name} onLoadedMetadata={e=>{const v=e.currentTarget;if(v.currentTime===0&&Number.isFinite(v.duration))v.currentTime=Math.min(.1,v.duration/2);}} onError={()=>setFailed(true)}/>{failed&&<small>Pregled nije dostupan. Pokušaj preuzimanje datoteke.</small>}</>;
}
