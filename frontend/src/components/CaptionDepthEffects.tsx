import {useEffect,useRef,useState} from 'react';
import {DEFAULT_CAPTION_SETTINGS} from '../config/captions/presets';
import type {CaptionSettings} from '../config/captions/types';
import {depthMaterials,depthEffects,renderCaptionDepth,captionDepthPalette} from '../lib/caption-transform';
import {ColorPicker} from './ColorPicker/ColorPicker';
import {CaptionRange} from './CaptionRange';
import {SettingsPopover} from './SettingsPopover';
function Preview({material,mode}:{material:CaptionSettings['depthMaterial'];mode:CaptionSettings['depthMode']}){
 const ref=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{const canvas=ref.current;if(!canvas)return;const paint=()=>{const c=canvas.getContext('2d');if(!c)return;const color=getComputedStyle(canvas).color;c.clearRect(0,0,240,130);renderCaptionDepth(c,{...DEFAULT_CAPTION_SETTINGS,textColor:color,depthMode:mode||'extrude',depthMaterial:material},.7,ctx=>{ctx.font='700 48px Arial';ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('Tekst',120,60);return {x:50,y:46,width:60,height:42,rotation:0,segmentId:'sample',words:[]};});};paint();const observer=new MutationObserver(paint);observer.observe(document.documentElement,{attributes:true});return()=>observer.disconnect();},[material,mode]);
 return <canvas ref={ref} width={240} height={130} aria-hidden="true"/>;
}
export function CaptionDepthEffects({settings:s,patch}:{settings:CaptionSettings;patch:(s:Partial<CaptionSettings>)=>void}){
 const [group,setGroup]=useState<'materials'|'effects'>('materials'),last=useRef<NonNullable<CaptionSettings['depthMode']>>(s.depthMode&&s.depthMode!=='none'?s.depthMode:'extrude');
 const palette=captionDepthPalette(s);
 const enabled=!!s.depthMode&&s.depthMode!=='none';
 const edit=(value:Partial<CaptionSettings>)=>patch({depthMode:enabled?s.depthMode:last.current,...value});
 return <div className="caption-line-editor caption-light-effects caption-depth-effects"><header className="caption-depth-heading"><span>3D izgled</span><input type="checkbox" aria-label="Uključi 3D izgled" checked={enabled} onChange={e=>patch({depthMode:e.target.checked?last.current:'none'})}/></header>
 <div className="caption-texture-categories"><button type="button" aria-pressed={group==='materials'} onClick={()=>setGroup('materials')}>3D materijali</button><button type="button" aria-pressed={group==='effects'} onClick={()=>setGroup('effects')}>3D efekti</button></div>
 <div className="caption-effect-choices" role="group" aria-label={group==='materials'?'3D materijali':'3D efekti'}>{group==='materials'?depthMaterials.map(([id,label])=><button type="button" key={id} aria-pressed={(s.depthMaterial||'plastic')===id} onClick={()=>patch({depthMaterial:id,depthMode:!s.depthMode||['none','glass','metallic'].includes(s.depthMode)?'extrude':s.depthMode})}><Preview material={id} mode="extrude"/><span>{label}</span></button>):depthEffects.map(([id,label])=><button type="button" key={id} aria-pressed={s.depthMode===id} onClick={()=>{last.current=id;patch({depthMode:id});}}><Preview material={s.depthMaterial} mode={id}/><span>{label}</span></button>)}</div>
 <div className="caption-light-fields">{([['depthFaceColor','Boja površine',palette.base],['depthSideColor','Boja dubine',palette.side],['depthLightColor','Boja svjetla',palette.light]] as const).map(([key,label,fallback])=><label key={key}><span>{label}</span><ColorPicker value={s[key]||fallback} onChange={e=>edit({[key]:e.target.value})} onReset={()=>edit({[key]:undefined})}/></label>)}</div>
 <div className="caption-light-fields">{([['depthSize','Dubina',0,40,12,1],['depthAngle','Smjer dubine',-180,180,135,5],['depthReflection','Refleksija',0,100,65,1],['surfaceBevel','Širina bevel ruba',0,100,35,1],['depthLightStrength','Jačina svjetla',0,150,85,1],['depthLightAngle','Smjer svjetla',-180,180,-45,5],['depthTiltX','Nagib kamere X',-60,60,0,1],['depthTiltY','Nagib kamere Y',-60,60,0,1],['depthShadow','Sjena u prostoru',0,100,25,1],['depthShadowSoftness','Mekoća sjene',0,100,40,1],['depthRoughness','Hrapavost površine',0,100,25,1],['depthFocus','Zamućenje fokusa',0,10,0,.2],['depthMotion','Lagani pokret',0,100,0,1]] as const).map(([key,label,min,max,fallback,step])=><SettingsPopover key={key} label={label} value={String(s[key]??fallback)}><label className="caption-popover-range"><span>{label} <b>{s[key]??fallback}</b></span><CaptionRange settingKey={key} resetValue={fallback} min={min} max={max} step={step} value={s[key]??fallback} onChange={e=>edit({[key]:Number(e.target.value)})}/></label></SettingsPopover>)}</div>

 </div>;
}
