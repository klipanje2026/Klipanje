import {useEffect,useRef,useState} from 'react';
import type {CaptionSettings} from '../config/captions/types';
import {DEFAULT_CAPTION_SETTINGS} from '../config/captions/presets';
import {animateCaptionEffect,captionSpecialEffects} from '../lib/caption-transform';
import {CaptionEffectSection} from './CaptionEffectSection';
import {CaptionRange} from './CaptionRange';
import {SettingsPopover} from './SettingsPopover';
import {ColorPicker} from './ColorPicker/ColorPicker';
type Effect=typeof captionSpecialEffects[number][0];
function Preview({effect,playing}:{effect:Effect;playing:boolean}){
 const ref=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{const canvas=ref.current;if(!canvas)return;let frame=0;
 const paint=(time=0)=>{const ctx=canvas.getContext('2d');if(!ctx)return;const color=getComputedStyle(canvas).color;ctx.clearRect(0,0,240,130);
 animateCaptionEffect(ctx,{...DEFAULT_CAPTION_SETTINGS,specialEffect:effect,specialEffectColor:color,specialEffectStrength:65},time/1000,layer=>{layer.font='600 48px Arial';layer.textAlign='center';layer.textBaseline='middle';layer.fillStyle=color;layer.fillText('Tekst',120,65);return {x:50,y:50,width:55,height:40,rotation:0,segmentId:'preview',words:[]};});
 if(playing)frame=requestAnimationFrame(paint);};paint(450);const observer=new MutationObserver(()=>{cancelAnimationFrame(frame);paint(450);});observer.observe(document.documentElement,{attributes:true});return()=>{cancelAnimationFrame(frame);observer.disconnect();};},[effect,playing]);
 return <canvas ref={ref} width={240} height={130} aria-hidden="true"/>;
}
export function CaptionSpecialEffects({settings:s,patch}:{settings:CaptionSettings;patch:(value:Partial<CaptionSettings>)=>void}){
 const [hover,setHover]=useState(''),last=useRef<Effect>(s.specialEffect&&s.specialEffect!=='none'?s.specialEffect:'glitch');
 const enabled=!!s.specialEffect&&s.specialEffect!=='none';
 return <div className="caption-light-effects caption-line-editor"><CaptionEffectSection id="animated-effects" title="Animirani efekti" enabled={enabled} onChange={on=>patch({specialEffect:on?last.current:'none'})}>
 <div className="caption-effect-choices" role="group" aria-label="Animirani specijalni efekti">{captionSpecialEffects.map(([id,label])=><button type="button" key={id} aria-label={label} aria-pressed={s.specialEffect===id} onPointerEnter={()=>setHover(id)} onPointerLeave={()=>setHover('')} onFocus={()=>setHover(id)} onBlur={()=>setHover('')} onClick={()=>{last.current=id;patch({specialEffect:s.specialEffect===id?'none':id});}}><Preview effect={id} playing={hover===id||s.specialEffect===id}/><span>{label}</span><i aria-hidden="true">{s.specialEffect===id?'✓':''}</i></button>)}</div>
 <div className="caption-light-fields">
 <label><span>Boja efekta</span><ColorPicker value={s.specialEffectColor||s.highlightColor} onChange={e=>patch({specialEffectColor:e.target.value})} onReset={()=>patch({specialEffectColor:undefined})}/></label>
 {([['specialEffectStrength','Jačina',0,100,50,1],['specialEffectSpeed','Brzina',.2,3,1,.1]] as const).map(([key,label,min,max,fallback,step])=><SettingsPopover key={key} label={label} value={String(s[key]??fallback)}><label className="caption-popover-range"><span>{label} <b>{s[key]??fallback}</b></span><CaptionRange settingKey={key} resetValue={fallback} aria-label={label} min={min} max={max} step={step} value={s[key]??fallback} onChange={e=>patch({[key]:Number(e.target.value)})}/></label></SettingsPopover>)}
 </div>

 <small>Pokreni video za animaciju. Pređi preko primjera za pregled.</small>
 </CaptionEffectSection></div>;
}

/** Directional lighting is independent of the animated effect selection. */
export function CaptionSurfaceLighting({settings:s,patch}:{settings:CaptionSettings;patch:(value:Partial<CaptionSettings>)=>void}){
 const last=useRef(s.surfaceStrength||65);
 const enabled=(s.surfaceStrength??0)>0;
 return <div className="caption-light-effects caption-line-editor"><CaptionEffectSection id="surface-lighting" title="Svjetlo i rubovi slova" enabled={enabled} onChange={on=>{if(!on&&s.surfaceStrength)last.current=s.surfaceStrength;patch({surfaceStrength:on?last.current:0});}}>
 <div className="caption-light-fields">{([['surfaceStrength','Jačina osvjetljenja',0,100,65,1],['surfaceLightAngle','Smjer svjetla',-180,180,-45,5],['surfaceBevel','Širina ruba',0,100,35,1],['surfaceHighlight','Svijetli rub',0,100,90,1],['surfaceShadow','Tamni rub',0,100,80,1]] as const).map(([key,label,min,max,fallback,step])=><SettingsPopover key={key} label={label} value={String(s[key]??fallback)}><label className="caption-popover-range"><span>{label} <b>{s[key]??fallback}</b></span><CaptionRange settingKey={key} resetValue={fallback} aria-label={label} min={min} max={max} step={step} value={s[key]??fallback} onChange={e=>patch({[key]:Number(e.target.value)})}/></label></SettingsPopover>)}</div>
 </CaptionEffectSection></div>;
}
