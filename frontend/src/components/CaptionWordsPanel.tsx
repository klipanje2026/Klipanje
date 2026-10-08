import {captionWordRoles} from '../lib/caption-word-roles';
import {useRef,useState,useEffect} from 'react';
import type {CaptionSettings,Segment,StyleKey} from '../config/captions/presets';
import {captionStyleOwner,captionTitle,replaceCaptionTitle,replaceScopedCaptionSuggestions,keywordPreset,titleSettingsForStyle} from '../lib/caption-selection';
type Token={source:string;index:number;text:string;kind?:'title'|'word';id?:string;suggested?:boolean};
export function CaptionWordsPanel({segments,selectedId,scope,style,settings,onChange}:{segments:Segment[];selectedId?:string;scope:string;style:StyleKey;settings:CaptionSettings;onChange:(segments:Segment[])=>void}){
 const [newTitle,setNewTitle]=useState('');
 const [page,setPage]=useState(0),[chosen,setChosen]=useState<Token|null>(null);const dragging=useRef<Token|null>(null),handled=useRef(false);
 useEffect(()=>{setChosen(null);setPage(0);dragging.current=null;},[scope,selectedId]);
 const owner=captionStyleOwner(segments,segments.find(s=>s.id===selectedId));
 const sources=segments.filter(s=>s.role!=='title'&&(scope==='scene'?s.id===owner?.id:scope.startsWith('group:')?s.group?.id===scope.slice(6):scope==='all'||!s.group));
 const tokens=sources.flatMap(s=>s.text.trim().split(/\s+/).map((text,index)=>({source:s.id,index,text})));
 const pages=scope==='all'?Math.max(1,Math.ceil(tokens.length/12)):1,current=Math.min(page,pages-1),visible=scope==='all'?tokens.slice(current*12,(current+1)*12):tokens;
 const titles:Token[]=segments.filter(s=>s.role==='title'&&(sources.some(p=>p.id===s.sourceCaptionId)||s.id===selectedId||(!s.sourceCaptionId&&scope==='all'))).map(s=>({source:s.sourceCaptionId!,index:s.sourceWord??0,text:s.text,kind:'title' as const,id:s.id}));
 const keywords:Token[]=sources.flatMap(s=>Object.entries(s.wordStyles||{}).map(([index,w])=>({source:s.id,index:Number(index),text:w.text,kind:'word' as const})));
 for(const source of sources){const words=source.text.trim().split(/\s+/),roles=captionWordRoles(source,(source.detachedStyle||source.laneStyle)?.settings||settings);
  if(((source.detachedStyle||source.laneStyle)?.style||style)!=='goldMesh'&&roles.title>=0&&!titles.some(t=>t.source===source.id))titles.push({source:source.id,index:roles.title,text:words[roles.title],kind:'title',suggested:true});
  if(roles.keyword>=0&&!keywords.some(t=>t.source===source.id))keywords.push({source:source.id,index:roles.keyword,text:words[roles.keyword],kind:'word',suggested:true});
 }
 function remove(token:Token){if(token.suggested){onChange(segments.map(s=>s.id===token.source?{...s,[token.kind==='title'?'headingWord':'keywordWord']:null}:s));setChosen(null);return;}onChange(token.kind==='title'?segments.filter(s=>s.id!==token.id).map(s=>s.id===token.source?{...s,headingWord:null}:s):segments.map(s=>{if(s.id!==token.source)return s;const words={...s.wordStyles};delete words[token.index];return {...s,wordStyles:words,keywordWord:null};}));setChosen(null);}
 function add(kind:'title'|'word',token:Token|null){if(!token||!sources.some(s=>s.id===token.source))return;const source=segments.find(s=>s.id===token.source);if(!source)return;const preset=source.detachedStyle||source.laneStyle||{style,settings};
  let next=replaceScopedCaptionSuggestions(segments,source,scope,kind);
  if(kind==='title'){next=replaceCaptionTitle(next,source,captionTitle(source,token.index,preset.style,preset.settings,1)).map(s=>s.id===source.id?{...s,headingWord:token.index}:s);}
  else next=next.map(s=>s.id===source.id?{...s,keywordWord:token.index,wordStyles:{...s.wordStyles,[token.index]:{text:token.text,...keywordPreset(preset.style,preset.settings)}}}:s);
  onChange(next);setChosen(null);
 }
 function addStandaloneTitle(){
  const text=newTitle.trim(),source=sources.find(s=>s.id===owner?.id)||sources[0];if(!text)return;
  const title:Segment={id:crypto.randomUUID(),text,role:'title',standaloneTitle:!source,manualTitleLayout:true,lane:1,sourceCaptionId:source?.id,start:source?.start??0,end:source?.end??3,detachedStyle:{style,settings:titleSettingsForStyle(style,settings)}};
  onChange(source?replaceCaptionTitle(replaceScopedCaptionSuggestions(segments,source,scope,'title'),source,title):[...segments,title]);setNewTitle('');
 }
 const chip=(token:Token)=><button type="button" draggable key={`${token.source}:${token.kind||'plain'}:${token.id||token.index}`} title={token.suggested?'Predloženo za ovaj titl — možeš zamijeniti ili ukloniti':token.kind?'Prevuci izvan kontejnera za uklanjanje':token.text} aria-pressed={chosen?.source===token.source&&chosen.index===token.index&&chosen.kind===token.kind} onClick={()=>setChosen(token)} onDragStart={e=>{dragging.current=token;handled.current=false;e.dataTransfer.setData('text/plain',token.text);e.dataTransfer.effectAllowed='move';}} onDragEnd={e=>{if(token.kind&&!handled.current){const rect=e.currentTarget.closest('.settings-word-bucket')?.getBoundingClientRect();if(rect&&(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom))remove(token);}dragging.current=null;}}>{token.text}</button>;
 return <details className="settings-words-panel"><summary>Dodaj naslove i bitne riječi</summary><div className="settings-word-options"><div className="settings-word-grid" aria-label="Riječi odabranog opsega" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();handled.current=true;if(dragging.current?.kind)remove(dragging.current);}}>{visible.map(chip)}</div>{pages>1&&<nav aria-label="Stranice riječi"><button type="button" disabled={current===0} onClick={()=>setPage(current-1)}>‹</button><span>{current+1} / {pages}</span><button type="button" disabled={current===pages-1} onClick={()=>setPage(current+1)}>›</button></nav>}<div className="settings-word-buckets">{(['title','word'] as const).map(kind=><section key={kind}><header><span>{kind==='title'?'Naslovi':'Bitne riječi'}</span><button type="button" disabled={!chosen} aria-label={chosen?.kind===kind?'Ukloni odabranu riječ':kind==='title'?'Dodaj odabranu riječ u naslove':'Dodaj odabranu bitnu riječ'} onClick={()=>chosen?.kind===kind?remove(chosen):add(kind,chosen)}>{chosen?.kind===kind?'−':'+'}</button></header><div className="settings-word-bucket" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();handled.current=true;add(kind,dragging.current);}}>{(kind==='title'?titles:keywords).map(chip)}</div></section>)}</div><div className="settings-add-title"><input aria-label="Dodaj naslov" placeholder="Dodaj naslov" value={newTitle} onChange={e=>setNewTitle(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addStandaloneTitle();}}}/><button type="button" disabled={!newTitle.trim()} onClick={addStandaloneTitle}>Dodaj</button></div></div></details>;
}
