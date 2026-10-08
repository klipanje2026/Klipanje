import {CaptionRange} from './CaptionRange';
import {StudioIcon} from './StudioIcon/StudioIcon';
import {SettingsPopover} from './SettingsPopover';
import './CaptionDisplayControls.scss';
import type {ReactNode} from 'react';
import type {CaptionSettings} from '../config/captions/types';
export function CaptionDisplayControls({settings:s,patch}:{settings:CaptionSettings;patch:(s:Partial<CaptionSettings>)=>void}){
 const ranges=[['displayScale','Scale · veličina cjeline',25,250,100,5],['rotation','Rotate · rotacija',-180,180,0,1],['displaySkew','Skew · nagib',-45,45,0,1],['displayWarp','Warp · valovitost',-100,100,0,5],['displayBend','Bend · savijanje',-100,100,0,5],['displayArc','Arc · luk',-100,100,0,5],['displayDistort','Distort · deformacija',-100,100,0,5],['displayPerspective','Perspective · perspektiva',-80,80,0,5],['displayStretch','Stretch · rastezanje',100,250,100,5],['displayCompress','Compress · sabijanje',25,100,100,5],['letterSpacing','Letter spacing · razmak slova',-10,25,0,1],['wordSpacing','Word spacing · razmak riječi',-20,100,0,1],['lineHeight','Line height · razmak redova',.6,3,1.27,.05],['tracking','Tracking · razmak cijelog teksta',-10,25,0,1]] as const;

 const slider=(key:keyof CaptionSettings,label:string,min:number,max:number,fallback:number,step=1,icon?:ReactNode)=><SettingsPopover key={key} label={label} value={String(s[key]??fallback)} icon={icon}><label className="caption-popover-range"><span>{label} <b>{String(s[key]??fallback)}</b></span><CaptionRange settingKey={key} resetValue={fallback} aria-label={label} type="range" min={min} max={max} step={step} value={Number(s[key]??fallback)} onChange={e=>patch({[key]:Number(e.target.value)})}/></label></SettingsPopover>;
 const control=(key:keyof CaptionSettings,label:string,min:number,max:number,fallback:number,step=1)=><label key={key} className="caption-popover-range"><span>{label} <b>{String(s[key]??fallback)}</b></span><CaptionRange settingKey={key} resetValue={fallback} aria-label={label} min={min} max={max} step={step} value={Number(s[key]??fallback)} onChange={e=>patch({[key]:Number(e.target.value)})}/></label>;
 const count=(key:'displayWordCount'|'wordsPerLine',label:string,max:number)=><div className="caption-count-choice"><span>{label}</span><div role="group" aria-label={label}>{[0,...Array.from({length:max},(_,i)=>i+1),-1].map(n=><button key={n} type="button" aria-pressed={(s[key]??0)===n} onClick={()=>patch({[key]:n||undefined})}>{n===0?'Zadano':n===-1?'Prilagođeno':n}</button>)}</div></div>;
 return <div className="caption-basics-card caption-display-controls">
 {count('displayWordCount','Riječi u prikazu',4)}{count('wordsPerLine','Riječi u redu',4)}
 <div className="display-grid three">
 {slider('displayCompress','Compress',25,100,100)}{slider('displayStretch','Stretch',100,250,100)}
 <SettingsPopover label="Poravnanje" icon={<StudioIcon name="alignCenter"/>}><div className="caption-alignment-boxes" role="group" aria-label="Vodoravno poravnanje">{(['left','center','right','justify'] as const).map((v,i)=><button type="button" key={v} title={['Lijevo','Sredina','Desno','Obostrano'][i]} aria-label={['Lijevo','Sredina','Desno','Obostrano'][i]} aria-pressed={s.alignment===v} onClick={()=>patch({alignment:v})}>{v==='justify'?<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 5h18M3 10h18M3 15h18M3 20h18"/></svg>:<StudioIcon name={v==='left'?'alignLeft':v==='right'?'alignRight':'alignCenter'}/>}</button>)}</div></SettingsPopover>
 </div>
 <div className="display-grid three caption-display-advanced">
 <SettingsPopover label="Transformacije" icon={<StudioIcon name="frame"/>}>{ranges.slice(0,3).map(([key,label,min,max,fallback,step])=>control(key,label,min,max,fallback,step))}</SettingsPopover>
 <SettingsPopover label="Razmaci" icon={<StudioIcon name="alignCenter"/>}>
 <label className="caption-popover-range"><span>Kerning · razmak parova slova</span><CaptionRange resetValue={1} aria-label="Kerning" min={0} max={2} step={1} value={s.kerning==='none'?0:s.kerning==='normal'?2:1} onChange={e=>patch({kerning:(['none','auto','normal'] as const)[Number(e.target.value)]})}/></label>
 {control('tracking','Tracking · razmak cijelog teksta',-10,25,0)}{control('letterSpacing','Razmak slova',-10,25,0)}{control('wordSpacing','Razmak riječi',-20,100,0)}{control('lineHeight','Visina reda',.6,3,1.27,.05)}
 </SettingsPopover>
 <SettingsPopover label="Deformacije" icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 4 20 7 17 21 6 17Z"/></svg>}>{ranges.slice(3,8).map(([key,label,min,max,fallback,step])=>control(key,label,min,max,fallback,step))}</SettingsPopover>
 </div>
 </div>;
}
