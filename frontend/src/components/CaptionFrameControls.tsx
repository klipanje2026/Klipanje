import type {CaptionSettings} from '../config/captions/types';
import {CaptionEffectSection} from './CaptionEffectSection';
import {CaptionRange} from './CaptionRange';
import {SettingsPopover} from './SettingsPopover';
import {ColorPicker} from './ColorPicker/ColorPicker';
export function CaptionFrameControls({settings:s,patch}:{settings:CaptionSettings;patch:(value:Partial<CaptionSettings>)=>void}){
 return <div className="caption-line-editor"><CaptionEffectSection id="video-frames" title="Okviri · Borders" enabled={!!s.captionFrame} onChange={on=>patch({captionFrame:on})}>
 <div className="caption-background-scopes" role="group" aria-label="Broj okvira">{[1,2,3].map(n=><button type="button" key={n} aria-pressed={(s.frameCount??3)===n} onClick={()=>patch({captionFrame:true,frameCount:n})}>{n===1?'Jedan okvir':n===2?'Dva okvira':'Tri okvira'}</button>)}</div>
 <label>Boja okvira<ColorPicker value={s.frameColor??s.highlightColor} onChange={e=>patch({frameColor:e.target.value})}/></label>
 <div className="caption-light-fields">{([['frameWidth','Debljina',.3,.1,2,.1],['frameInset','Uvučenost',0,0,25,1],['frameWave','Krivudanje',0,0,10,.5]] as const).map(([key,label,fallback,min,max,step])=><SettingsPopover key={key} label={label} value={String(s[key]??fallback)}><CaptionRange settingKey={key} resetValue={fallback} aria-label={label} min={min} max={max} step={step} value={s[key]??fallback} onChange={e=>patch({[key]:Number(e.target.value)})}/></SettingsPopover>)}</div>
 </CaptionEffectSection></div>;
}
