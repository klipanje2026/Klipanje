import {StudioIcon} from './StudioIcon/StudioIcon';
import {useState} from 'react';
import {StyleDropdown} from './LanguageDropdown/LanguageDropdown';
import {NarrationTags} from './NarrationTags';

export type NarrationVoice={id:string;name:string;previewUrl?:string;available?:boolean;reason?:string;gender?:string;language?:string;description?:string};
const isBalkan=(v:NarrationVoice)=>['bs','hr','sr','sl','sq','mk','bg','el','ro'].includes(v.language||'')||/balkan/i.test(v.name);
export function LocalVoiceSelection({model,onModel,voices,voice,onVoice,onLoad,onInsert,tone}:{tone:string;model:string;onModel:(value:string)=>void;voices:NarrationVoice[];voice:string;onVoice:(value:string)=>void;onLoad:()=>void;onInsert:(tag:string)=>void}){
 const [group,setGroup]=useState<'balkan'|'other'>('balkan');
 const chosen=voices.find(v=>v.id===voice);
 const activeGroup=chosen?(isBalkan(chosen)?'balkan':'other'):group;
 const filtered=voices.filter(v=>isBalkan(v)===(activeGroup==='balkan'));
 return <section className="local-voice-selection compact-voice-selection">
  <header><h3>Glas naratora</h3><button type="button" onClick={onLoad} title="Osvježi glasove" aria-label="Osvježi glasove"><StudioIcon name="reset"/></button></header>
  <StyleDropdown label="Model naracije" value={model} onChange={e=>onModel(e.target.value)}><option value="eleven_flash_v2_5">Flash v2.5 · brza naracija</option><option value="eleven_v4_turbo">V4 Turbo · izražajna naracija</option></StyleDropdown>
  <div className="voice-group-switch" aria-label="Grupa glasova">{(['balkan','other'] as const).map(value=><button key={value} type="button" aria-pressed={activeGroup===value} onClick={()=>{setGroup(value);onVoice('');}}>{value==='balkan'?'Balkanski':'Ostali'}</button>)}</div>
  <StyleDropdown label="Glas" value={voice} onChange={e=>onVoice(e.target.value)}><option value="">{voices.length?'Odaberi glas':'Prvo učitaj glasove'}</option>{filtered.map(v=><option key={v.id} value={v.id} disabled={v.available===false}>{v.name}</option>)}</StyleDropdown>
  {voices.length>0&&!filtered.length&&<small>Nema glasova u ovoj grupi na tvom računu.</small>}
  {chosen?.available===false&&<small role="alert">{chosen.reason}</small>}
  {model==='eleven_v4_turbo'&&<NarrationTags value={tone.replace(/^\[|\]$/g,'')} onInsert={onInsert}/>}

 </section>;
}
