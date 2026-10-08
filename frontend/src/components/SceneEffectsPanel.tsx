import {formatSeconds} from '../lib/format-seconds';
import {useState} from 'react';
import {sceneFilters,sceneTransitions,filterCss,type SceneEffects} from '../lib/scene-effects';
export function SceneEffectsPanel({mode,clip,disabled,onChange,onPreview,time}:{mode:'filters'|'transitions';clip?:SceneEffects&{name:string;start:number;inPoint:number;outPoint:number};disabled:boolean;onChange:(patch:SceneEffects)=>void;onPreview:(time:number)=>void;time:number}){
 const [category,setCategory]=useState<string|null>(null);const presets=mode==='filters'?sceneFilters:sceneTransitions;
 const length=clip?clip.outPoint-clip.inPoint:0;const current=mode==='filters'?clip?.filter:clip?.transition;
 const start=clip?.filter?Math.max(clip.inPoint,clip.filter.start):clip?.inPoint||0;
 return <div className={`scene-effects-library ${mode}`}>
 <p>{clip?`Scena: ${clip.name}`:'Odaberi video scenu na vremenskoj liniji.'}</p>
 {clip&&current&&<div className="scene-effect-settings">
 <strong>{presets.find(p=>p.id===current.id)?.name}</strong><button onClick={()=>onChange(mode==='filters'?{filter:undefined}:{transition:undefined})} disabled={disabled}>Ukloni</button>
 {mode==='filters'&&clip.filter&&<><label>Početak u sceni (s)<input aria-label="Početak filtera" type="number" min={0} max={Math.max(0,length-.1)} step={.1} value={formatSeconds(start-clip.inPoint)} onChange={e=>{const s=clip.inPoint+Math.max(0,Math.min(length-.1,+e.target.value));onChange({filter:{...clip.filter!,start:s,end:Math.min(clip.outPoint,s+Math.max(.1,clip.filter!.end-start))}});}}/></label><label>Jačina · {clip.filter.strength}%<input aria-label="Jačina filtera" type="range" min={0} max={100} value={clip.filter.strength} onChange={e=>onChange({filter:{...clip.filter!,strength:+e.target.value}})}/></label></>}
 <label>Trajanje (s)<input aria-label="Trajanje efekta" disabled={disabled} type="number" step={.1} min={.1} max={mode==='filters'?clip.outPoint-start:length} value={formatSeconds(mode==='filters'?Math.max(.1,Math.min(clip.outPoint,clip.filter!.end)-start):Math.min(length,clip.transition!.duration))} onChange={e=>{const value=Math.max(.1,Math.min(mode==='filters'?clip.outPoint-start:length,+e.target.value));onChange(mode==='filters'?{filter:{...clip.filter!,end:start+value}}:{transition:{...clip.transition!,duration:value}});}}/></label>
 <button onClick={()=>onPreview(clip.start+(mode==='filters'?start-clip.inPoint:0))}>Pregledaj</button>
 {mode==='filters'&&<button onClick={()=>onChange({filter:{...clip.filter!,start:clip.inPoint,end:clip.outPoint}})}>Cijela scena</button>}
 </div>}
 {category&&<button className="overlay-back" onClick={()=>setCategory(null)}>← Sve kategorije</button>}
 {[...new Set(presets.map(p=>p.category))].filter(c=>!category||category===c).map(c=><section key={c}><header><strong>{c}</strong>{!category&&<button onClick={()=>setCategory(c)}>Prikaži sve →</button>}</header><div className="scene-effect-grid">{presets.filter(p=>p.category===c).map(p=><button disabled={!clip||disabled} key={p.id} aria-label={`Dodaj ${mode==='filters'?'filter':'prijelaz'}: ${p.name}`} aria-pressed={current?.id===p.id} onClick={()=>{if(!clip)return;const s=clip.inPoint+Math.max(0,Math.min(length-.1,time-clip.start));onChange(mode==='filters'?{filter:{id:p.id,start:s,end:Math.min(clip.outPoint,s+2),strength:100}}:{transition:{id:p.id,duration:Math.min(.6,length)}});onPreview(mode==='filters'?clip.start+s-clip.inPoint:clip.start);}}><span className={`scene-effect-sample transition-${mode==='transitions'?p.id:'none'}`} style={{filter:mode==='filters'?filterCss({id:p.id,start:0,end:1,strength:100},0):undefined}}><i/><b/></span><small>{p.name}</small></button>)}</div></section>)}
 {mode==='transitions'&&<small>Prijelaz otkriva odabranu scenu preko sloja ispod ili crne podloge. Počinje na početku scene.</small>}
 </div>;
}
