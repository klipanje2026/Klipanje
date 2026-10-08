import type {Segment,CaptionSettings,StyleKey} from '../config/captions/types';
export function CaptionWordLink({segment,index,style,settings,onChange}:{segment:Segment;index:number;style:StyleKey;settings:CaptionSettings;onChange:(segment:Segment)=>void}){
 const current=segment.wordStyles?.[index];
 return <><button type="button" aria-pressed={!!current?.linked} title="Spoji s ostatkom: riječ prati stil cijelog titla" onClick={()=>onChange({...segment,wordStyles:{...segment.wordStyles,[index]:{text:segment.text.trim().split(/\s+/)[index],style:current?.linked?style:current?.style||style,settings:current?.linked?settings:current?.settings||settings,linked:!current?.linked}}})}>Spoji s ostatkom</button><button type="button" aria-label="Vrati samo ovu riječ na zadano" title="Vrati samo ovu riječ na zadano" onClick={()=>{const words={...segment.wordStyles};delete words[index];onChange({...segment,wordStyles:words});}}>↶</button></>;
}
