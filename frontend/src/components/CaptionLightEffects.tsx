import {CaptionRange} from './CaptionRange';
import {SettingsPopover} from './SettingsPopover';
import {CaptionEffectSection} from './CaptionEffectSection';
import {LanguageDropdown} from './LanguageDropdown/LanguageDropdown';
import {useEffect,useRef,useState} from 'react';
import type {CaptionSettings} from '../config/captions/types';
import {DEFAULT_CAPTION_SETTINGS} from '../config/captions/presets';
import {paintCaptionLightEffects,captionShadowColor} from '../lib/caption-light-effects';
import {ColorPicker} from './ColorPicker/ColorPicker';
import './CaptionLightEffects.scss';

type Shadow=NonNullable<CaptionSettings['shadowMode']>;
type Glow=NonNullable<CaptionSettings['glowMode']>;
const shadows:[Shadow,string,Partial<CaptionSettings>][]=[
 ['drop','Drop Shadow',{shadowX:8,shadowY:12,shadowBlur:12}],
 ['long','Long Shadow',{shadowX:10,shadowY:10,shadowBlur:0,shadowLength:40}],
 ['inner','Inner Shadow',{shadowX:5,shadowY:5,shadowBlur:5}],
 ['soft','Soft Shadow',{shadowX:4,shadowY:8,shadowBlur:28}],
 ['hard','Hard Shadow',{shadowX:8,shadowY:10,shadowBlur:0}],
 ['colored','Colored Shadow',{shadowX:8,shadowY:12,shadowBlur:8}],
 ['multiple','Multiple Shadows',{shadowX:10,shadowY:8,shadowBlur:0}],
];
const glows:[Glow,string,Partial<CaptionSettings>][]=[
 ['outer','Outer Glow',{glowBlur:20}],['inner','Inner Glow',{glowBlur:6}],
 ['neon','Neon Glow',{glowBlur:16}],['rgb','RGB Glow',{glowBlur:10}],['pulsing','Pulsing Glow',{glowBlur:24,glowSpeed:1}],
];
function Preview({mode,group,playing}:{mode:Shadow|Glow;group:'shadow'|'glow';playing:boolean}){
 const ref=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  const canvas=ref.current;if(!canvas)return;let frame=0;
  const paint=(time=0)=>{
   const ctx=canvas.getContext('2d');if(!ctx)return;
   const color=getComputedStyle(canvas).color,face=getComputedStyle(canvas).getPropertyValue('--ui-text');
   const preset=(group==='shadow'?shadows:glows).find(([id])=>id===mode)?.[2];
   const settings={...DEFAULT_CAPTION_SETTINGS,...preset,shadowColor:mode==='colored'?(getComputedStyle(canvas).getPropertyValue('--track-audio').trim()||'#d49a45'):color,shadowSecondColor:'#ef6cae',glowColor:color,...(group==='shadow'?{shadowMode:mode as Shadow}:{glowMode:mode as Glow})};
   ctx.clearRect(0,0,240,130);ctx.font='600 60px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=face||color;
   paintCaptionLightEffects(ctx,'Aa',115,57,60,settings,time/1000,()=>ctx.fillText('Aa',115,57));
   if(playing&&mode==='pulsing')frame=requestAnimationFrame(paint);
  };paint();const observer=new MutationObserver(()=>{cancelAnimationFrame(frame);paint();});observer.observe(document.documentElement,{attributes:true});
  return()=>{cancelAnimationFrame(frame);observer.disconnect();};
 },[mode,group,playing]);
 return <canvas ref={ref} width={240} height={130} aria-hidden="true"/>;
}
function Numeric({label,value,min=0,max=100,step=1,onChange,resetValue=0,settingKey}:{label:string;value:number;min?:number;max?:number;step?:number;onChange:(value:number)=>void;resetValue?:number;settingKey?:keyof CaptionSettings}){
 return <SettingsPopover label={label} value={String(value)}><label className="caption-popover-range"><span>{label} <b>{value}</b></span><CaptionRange resetValue={resetValue} settingKey={settingKey} aria-label={label} type="range" min={min} max={max} step={step} value={value} onChange={event=>onChange(Math.max(min,Math.min(max,Number(event.target.value))))}/></label></SettingsPopover>;
}
export function CaptionLightEffects({settings:s,patch}:{settings:CaptionSettings;patch:(value:Partial<CaptionSettings>)=>void}){
 const [hover,setHover]=useState('');
 const shadowOn=!!s.shadowMode&&s.shadowMode!=='none',glowOn=!!s.glowMode&&s.glowMode!=='none';
 const pickShadow=(mode:Shadow)=>patch({shadowMode:s.shadowMode===mode?'none':mode,...shadows.find(([id])=>id===mode)?.[2],...(mode==='colored'?{shadowColor:s.shadowColor??captionShadowColor(s.textColor)}:{})});
 const pickGlow=(mode:Glow)=>patch({glowMode:s.glowMode===mode?'none':mode,...glows.find(([id])=>id===mode)?.[2]});
 const shadowPatch=(value:Partial<CaptionSettings>)=>patch({shadowMode:shadowOn?s.shadowMode:'drop',...value});
 const glowPatch=(value:Partial<CaptionSettings>)=>patch({glowMode:glowOn?s.glowMode:'outer',...value});
 return <div className="caption-light-effects caption-line-editor">
  <CaptionEffectSection id="shadow" title="Sjene" enabled={shadowOn} onChange={enabled=>patch({shadowMode:enabled?'drop':'none'})}>
  <div className="caption-effect-choices" role="group" aria-label="Vrsta sjene">{shadows.map(([id,label])=><button type="button" key={id} aria-label={label} aria-pressed={s.shadowMode===id} onClick={()=>pickShadow(id)}><Preview mode={id} group="shadow" playing={false}/><span>{label}</span><i aria-hidden="true">{s.shadowMode===id?'✓':''}</i></button>)}</div>
  <div className="caption-light-fields">
   <label><span>Boja sjene</span><ColorPicker onReset={()=>patch({shadowColor:undefined})} value={s.shadowColor??captionShadowColor(s.textColor)} onChange={event=>shadowPatch({shadowColor:event.target.value})}/></label>
   <Numeric label="Jačina (%)" settingKey="shadowOpacity" resetValue={65} value={s.shadowOpacity??65} onChange={shadowOpacity=>shadowPatch({shadowOpacity})}/>
   <Numeric label="Zamućenje" max={80} settingKey="shadowBlur" resetValue={Number(shadows.find(([id])=>id===s.shadowMode)?.[2].shadowBlur??12)} value={s.shadowBlur??12} onChange={shadowBlur=>shadowPatch({shadowBlur})}/>
   <Numeric label="Pomak lijevo/desno" min={-100} settingKey="shadowX" resetValue={Number(shadows.find(([id])=>id===s.shadowMode)?.[2].shadowX??8)} value={s.shadowX??8} onChange={shadowX=>shadowPatch({shadowX})}/>
   <Numeric label="Pomak gore/dolje" min={-100} settingKey="shadowY" resetValue={Number(shadows.find(([id])=>id===s.shadowMode)?.[2].shadowY??12)} value={s.shadowY??12} onChange={shadowY=>shadowPatch({shadowY})}/>
   {s.shadowMode==='long'&&<Numeric label="Dužina sjene" max={200} settingKey="shadowLength" resetValue={40} value={s.shadowLength??40} onChange={shadowLength=>shadowPatch({shadowLength})}/>}
   {s.shadowMode==='multiple'&&<label><span>Druga boja</span><ColorPicker onReset={()=>patch({shadowSecondColor:undefined})} value={s.shadowSecondColor??'#7b61ff'} onChange={event=>shadowPatch({shadowSecondColor:event.target.value})}/></label>}
  </div>
  {s.shadowMode==='multiple'&&<LanguageDropdown label="Pravac sjena" value={s.shadowDirection??'opposed'} options={[{value:'opposed',label:'Različiti pravci'},{value:'same',label:'Isti pravac'}]} onChange={value=>shadowPatch({shadowDirection:value as CaptionSettings['shadowDirection']})}/>}
  <small>Pomak, dužina i zamućenje su u % veličine slova. Minus pomiče lijevo ili gore.</small>

  </CaptionEffectSection><CaptionEffectSection id="glow" title="Sjaj" enabled={glowOn} onChange={enabled=>patch({glowMode:enabled?'outer':'none'})}>
  <div className="caption-effect-choices" role="group" aria-label="Vrsta sjaja">{glows.map(([id,label])=><button type="button" key={id} aria-label={label} aria-pressed={s.glowMode===id} onClick={()=>pickGlow(id)} onPointerEnter={()=>setHover(id)} onPointerLeave={()=>setHover('')} onFocus={()=>setHover(id)} onBlur={()=>setHover('')}><Preview mode={id} group="glow" playing={hover===id||s.glowMode===id}/><span>{label}</span><i aria-hidden="true">{s.glowMode===id?'✓':''}</i></button>)}</div>
  <div className="caption-light-fields">
   {s.glowMode!=='rgb'&&<label><span>Boja sjaja</span><ColorPicker onReset={()=>patch({glowColor:undefined})} value={s.glowColor??s.textColor} onChange={event=>glowPatch({glowColor:event.target.value})}/></label>}
   <Numeric label="Jačina (%)" settingKey="glowOpacity" resetValue={75} value={s.glowOpacity??75} onChange={glowOpacity=>glowPatch({glowOpacity})}/>
   <Numeric label="Širina sjaja" max={80} settingKey="glowBlur" resetValue={Number(glows.find(([id])=>id===s.glowMode)?.[2].glowBlur??20)} value={s.glowBlur??20} onChange={glowBlur=>glowPatch({glowBlur})}/>
   {s.glowMode==='pulsing'&&<Numeric label="Pulsiranja / s" min={.2} max={4} step={.1} settingKey="glowSpeed" resetValue={1} value={s.glowSpeed??1} onChange={glowSpeed=>glowPatch({glowSpeed})}/>}
  </div>

 </CaptionEffectSection>
 </div>;
}
export function CaptionBlurControl({settings,patch}:{settings:CaptionSettings;patch:(value:Partial<CaptionSettings>)=>void}){
 const [dragging,setDragging]=useState(false);
 const value=Math.max(0,Math.min(10,settings.textBlur??0));
 return <div className="caption-line-editor caption-blur-control"><CaptionEffectSection id="blur" title="Blur · zamućenje teksta" enabled={dragging||value>0} onChange={enabled=>{setDragging(false);patch({textBlur:enabled?6:0});}}><label className="caption-basic-range"><span>Jačina <b>{value}%</b></span><CaptionRange resetValue={0} type="range" min="0" max="10" step="1" value={value} onPointerDown={event=>{setDragging(true);event.currentTarget.setPointerCapture(event.pointerId);}} onPointerUp={()=>setDragging(false)} onPointerCancel={()=>setDragging(false)} onLostPointerCapture={()=>setDragging(false)} onBlur={()=>setDragging(false)} onChange={event=>patch({textBlur:Math.max(0,Math.min(10,Number(event.target.value)))})}/></label></CaptionEffectSection></div>;
}
