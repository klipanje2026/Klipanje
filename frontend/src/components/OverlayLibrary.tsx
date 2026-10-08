import {formatSeconds} from '../lib/format-seconds';
import {basicText,textTemplates,textEffects} from '../lib/text-presets';
import {TextDesignControls} from './TextDesignControls';
import {OverlayPresetPreview} from './OverlayPresetPreview';
import {useState} from 'react';
import {overlayPresets,type Overlay,type OverlayPreset} from '../lib/video-overlays';
export function OverlayLibrary({mode,items,selected,onSelect,onAdd,onChange,onRemove,onDuplicate,onOrder,duration,disabled,view='catalog'}:{view?:'catalog'|'inspector';mode:'text'|'elements';items:Overlay[];selected:string;onSelect:(id:string)=>void;onAdd:(preset:OverlayPreset)=>void;onChange:(value:Overlay)=>void;onRemove:()=>void;onDuplicate:()=>void;onOrder:(direction:number)=>void;duration:number;disabled:boolean}){
 const [category,setCategory]=useState<string|null>(null);
 const [textTab,setTextTab]=useState<'templates'|'effects'>('templates');
 const presets=mode==='text'?(textTab==='templates'?textTemplates:textEffects):overlayPresets.filter(p=>!['Naslovi','Oznake'].includes(p.category));
 const current=view==='inspector'?items.find(i=>i.id===selected):undefined;
 const update=(patch:Partial<Overlay>)=>{if(current)onChange({...current,...patch});};
 return <div className={`overlay-library overlay-library-${mode}`}>
 {view==='catalog'&&<>
 {mode==='text'&&<><div className="text-library-tabs"><button aria-pressed={textTab==='templates'} onClick={()=>{setTextTab('templates');setCategory(null);}}>Text templates</button><button aria-pressed={textTab==='effects'} onClick={()=>{setTextTab('effects');setCategory(null);}}>Text effects</button></div><div className="text-basic-actions">{basicText.map(p=><button key={p.id} disabled={disabled} onClick={()=>onAdd(p)}>{p.name}</button>)}</div></>}
 {category&&<button className="overlay-back" onClick={()=>setCategory(null)}>← Sve kategorije</button>}
 {[...new Set(presets.map(p=>p.category))].filter(c=>!category||c===category).map(c=><section key={c}><header><strong>{c}</strong>{!category&&<button onClick={()=>setCategory(c)}>Prikaži sve →</button>}</header><div className="overlay-preset-grid">{presets.filter(p=>p.category===c).slice(0,category?undefined:mode==='text'?4:5).map(p=><button key={p.id} disabled={disabled} onClick={()=>onAdd(p)} aria-label={`Dodaj: ${p.name}`} title={`Dodaj: ${p.name}`}>{mode==='text'?<OverlayPresetPreview preset={p}/>:<span style={{color:p.value.color,fontSize:p.value.kind==='text'?16:32}}>{p.symbol}</span>}</button>)}</div></section>)}
 </>}

 {current&&<><div className="overlay-edit-header"><strong>{current.kind==='text'?'Basic':'Uredi element'}</strong><button aria-label="Zatvori uređivanje" onClick={()=>onSelect('')}>×</button></div><fieldset disabled={disabled} className="overlay-properties"><legend>Uredi odabrano</legend>
 {current.kind==='text'&&<TextDesignControls key={current.id} item={current} onChange={onChange}/>}
 <details className="text-style-details" open={current.kind!=='text'}><summary>Trajanje i sloj</summary><div className="overlay-property-grid">{current.kind!=='text'&&<label>Boja<input type="color" value={current.color} onChange={e=>update({color:e.target.value})}/></label>}
 <label>Od (s)<input type="number" min={0} max={current.end-.1} step={.1} value={formatSeconds(current.start)} onChange={e=>update({start:Math.max(0,Math.min(current.end-.1,Number(e.target.value)))})}/></label><label>Do (s)<input type="number" min={current.start+.1} max={duration} step={.1} value={formatSeconds(current.end)} onChange={e=>update({end:Math.min(duration,Math.max(current.start+.1,Number(e.target.value)))})}/></label>
 {current.kind!=='text'&&(['x','y','width','height','rotation','opacity'] as const).map(key=><label key={key}>{({x:'Lijevo / desno',y:'Gore / dolje',width:'Širina',height:'Visina',rotation:'Rotacija',opacity:'Vidljivost'})[key]}<input type="range" min={key==='rotation'?-180:key==='width'||key==='height'?5:0} max={key==='rotation'?180:100} value={current[key]} onChange={e=>update({[key]:Number(e.target.value)})}/></label>)}</div>
 <div className="overlay-actions"><button onClick={()=>onOrder(-1)}>Iza</button><button onClick={()=>onOrder(1)}>Ispred</button><button onClick={onDuplicate}>Dupliciraj</button><button onClick={onRemove}>Obriši</button></div>
 </details></fieldset></>}
 </div>;
}
