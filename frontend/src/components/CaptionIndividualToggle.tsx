import type {Segment,StyleKey,CaptionSettings} from '../config/captions/presets';
export function CaptionIndividualToggle({segment,style,settings,onChange}:{segment:Segment;style:StyleKey;settings:CaptionSettings;onChange:(segment:Segment)=>void}){
 const enabled=!!segment.detachedStyle&&segment.separateStyle!==false;
 return <label className="caption-individual-toggle"><span>Pojedinačni stilovi</span><input type="checkbox" role="switch" checked={enabled} onChange={e=>onChange({...segment,separateStyle:e.target.checked,detachedStyle:segment.detachedStyle||{style,settings:{...settings}}})}/><span className="caption-individual-switch" aria-hidden="true"/></label>;
}
