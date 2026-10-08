import {useEffect,useRef} from 'react';
import {DEFAULT_CAPTION_SETTINGS} from '../config/captions/presets';
import {paintCaptionBackground} from '../lib/caption-background';
import {CaptionEffectSection} from './CaptionEffectSection';
import {CaptionRange} from './CaptionRange';
import {SettingsPopover} from './SettingsPopover';
import type {CaptionSettings} from '../config/captions/types';
import {ColorPicker} from './ColorPicker/ColorPicker';
const looks=[['solid','Puna boja'],['gradient','Gradijent'],['glass','Staklo'],['marker','Marker'],['outline','Samo okvir'],['raised','3D pločica'],['sketch','Sketch marker'],['paperCut','Papercut']] as const;
const textures=[['none','Bez teksture'],['paper','Papir'],['vintagePaper','Stari papir'],['marble','Mramor'],['granite','Granit'],['wood','Drvo'],['carbon','Karbon'],['fabric','Tkanina'],['gold','Zlato'],['chrome','Hrom'],['ice','Led'],['techGrid','Mreža']] as const;
function Preview({look,texture}:{look?:CaptionSettings['backgroundLook'];texture?:CaptionSettings['backgroundTexture']}){
 const ref=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{const canvas=ref.current;if(!canvas)return;const paint=()=>{const ctx=canvas.getContext('2d');if(!ctx)return;const css=getComputedStyle(canvas);ctx.clearRect(0,0,200,100);ctx.font='12px Arial';paintCaptionBackground(ctx,26,25,140,42,48,{...DEFAULT_CAPTION_SETTINGS,backgroundScope:'caption',backgroundOpacity:90,backgroundLook:look,backgroundTexture:texture,backgroundColor:css.getPropertyValue('--ui-accent-button').trim()||'#217f68',backgroundColor2:'#e9e5ce'},0);};paint();const observer=new MutationObserver(paint);observer.observe(document.documentElement,{attributes:true});return()=>observer.disconnect();},[look,texture]);
 return <canvas ref={ref} width={200} height={100} aria-hidden="true"/>;
}
export function CaptionLayoutControls({settings:s,patch,enabled=true}:{settings:CaptionSettings;patch:(value:Partial<CaptionSettings>)=>void;enabled?:boolean}){
 const edit=(value:Partial<CaptionSettings>)=>patch({backgroundScope:s.backgroundScope&&s.backgroundScope!=='none'?s.backgroundScope:'caption',...value});
 const scope=s.backgroundScope??(s.backgroundOpacity?'caption':'none');
 return <div className="caption-basics-card caption-layout-controls caption-line-editor caption-light-effects">{!enabled?<p>Ovaj stil ima vlastitu pozadinu. Osnovne pozadine dostupne su na stilovima sa standardnim rasporedom, poput Clean.</p>:<>
 <div className="caption-background-scopes" role="group" aria-label="Obuhvat pozadine">{([['none','Bez pozadine'],['caption','Cijeli titl'],['line','Svaki red'],['active','Aktivna riječ']] as const).map(([id,label])=><button type="button" key={id} aria-pressed={scope===id} onClick={()=>patch({backgroundScope:id,...(id!=='none'&&s.backgroundOpacity===0?{backgroundOpacity:80}:{})})}>{label}</button>)}</div>
 {scope!=='none'&&<>
 <div className="caption-background-scopes" role="group" aria-label="Pozadine iz stilova"><button type="button" onClick={()=>edit({backgroundScope:'line',backgroundLook:'solid',backgroundColor:'#101c18',backgroundOpacity:100,backgroundPaddingX:18,backgroundPaddingY:10,backgroundRadius:0})}>Terminal</button><button type="button" onClick={()=>edit({backgroundScope:'line',backgroundLook:'sketch',backgroundColor:'#333831',backgroundOpacity:85,backgroundPaddingX:17,backgroundPaddingY:0})}>Sketch</button><button type="button" onClick={()=>edit({backgroundScope:'line',backgroundLook:'paperCut',backgroundColor:'#ffffff',backgroundOpacity:100,backgroundBorderColor:'#17151d',backgroundBorderWidth:2})}>Papercut</button></div>
 <div className="caption-effect-choices" role="group" aria-label="Izgled pozadine">{looks.map(([id,label])=><button type="button" key={id} aria-pressed={(s.backgroundLook??'solid')===id} onClick={()=>edit({backgroundLook:id})}><Preview look={id}/><span>{label}</span></button>)}</div>
<div className="caption-layout-background"><div className="caption-outline-color"><span>Boja pozadine</span><ColorPicker settingKey="backgroundColor" value={s.backgroundColor} onChange={e=>patch({backgroundColor:e.target.value})}/></div><label className="caption-basic-range"><span>Prozirnost · opacity <b>{s.backgroundOpacity}%</b></span><CaptionRange settingKey="backgroundOpacity" resetValue={80} aria-label="Opacity pozadine" min={0} max={100} value={s.backgroundOpacity} onChange={e=>patch({backgroundOpacity:Number(e.target.value)})}/></label></div>
 <div className="caption-light-fields"><label><span>Druga boja</span><ColorPicker value={s.backgroundColor2??'#ffffff'} onReset={()=>edit({backgroundColor2:undefined})} onChange={e=>edit({backgroundColor2:e.target.value})}/></label><SettingsPopover label="Smjer gradijenta" value={String(s.backgroundAngle??90)+'°'}><CaptionRange settingKey="backgroundAngle" resetValue={90} aria-label="Smjer gradijenta" min={-180} max={180} value={s.backgroundAngle??90} onChange={e=>edit({backgroundAngle:Number(e.target.value)})}/></SettingsPopover></div>
 <div className="caption-light-fields">{([['backgroundPaddingX','Razmak lijevo/desno',18,80],['backgroundPaddingY','Razmak gore/dolje',10,60],['backgroundRadius','Zaobljenje',18,100]] as const).map(([key,label,fallback,max])=><SettingsPopover key={key} label={label} value={String(s[key]??fallback)+'%'}><label className="caption-popover-range"><span>{label}</span><CaptionRange settingKey={key} resetValue={fallback} aria-label={label} min={0} max={max} value={s[key]??fallback} onChange={e=>patch({[key]:Number(e.target.value)})}/><small>% veličine slova</small></label></SettingsPopover>)}</div>
 <CaptionEffectSection id="background-texture" title="Teksture pozadine" enabled={!!s.backgroundTexture&&s.backgroundTexture!=='none'} onChange={on=>edit({backgroundTexture:on?'paper':'none'})}>
 <div className="caption-effect-choices" role="group" aria-label="Tekstura pozadine">{textures.map(([id,label])=><button type="button" key={id} aria-pressed={(s.backgroundTexture??'none')===id} onClick={()=>edit({backgroundTexture:id})}><Preview texture={id}/><span>{label}</span></button>)}</div>
 <div className="caption-light-fields">{([['backgroundTextureScale','Veličina uzorka',100,25,300],['backgroundTextureAmount','Jačina teksture',70,0,100]] as const).map(([key,label,fallback,min,max])=><SettingsPopover key={key} label={label} value={String(s[key]??fallback)}><CaptionRange settingKey={key} resetValue={fallback} aria-label={label} min={min} max={max} value={s[key]??fallback} onChange={e=>edit({[key]:Number(e.target.value)})}/></SettingsPopover>)}</div>
 </CaptionEffectSection>
 {([['shadow','Sjena','backgroundShadow',45],['glow','Sjaj','backgroundGlow',35],['border','Okvir','backgroundBorderWidth',2],['depth','3D dubina','backgroundDepth',12]] as const).map(([id,title,key,fallback])=>{
 const defaults=key==='backgroundDepth'&&s.backgroundLook==='raised'?12:key==='backgroundBorderWidth'?(s.backgroundLook==='outline'?3:s.backgroundLook==='glass'?1:0):0;
 const value=s[key]??defaults;
 const colorKey=id==='glow'?'backgroundGlowColor':id==='border'?'backgroundBorderColor':id==='depth'?'backgroundDepthColor':null;
 return <CaptionEffectSection key={id} id={'background-'+id} title={title} enabled={value>0} onChange={on=>edit({[key]:on?fallback:0})}>
 {id==='border'&&<><div className="caption-background-scopes" role="group" aria-label="Vrsta okvira pozadine">{([['single','Jedan okvir'],['double','Dvostruki okvir'],['triple','Tri okvira']] as const).map(([value,label])=><button type="button" key={value} aria-pressed={(s.backgroundBorderStyle??'single')===value} onClick={()=>edit({backgroundBorderStyle:value})}>{label}</button>)}</div><SettingsPopover label="Krivudanje okvira" value={String(s.backgroundBorderWave??0)}><CaptionRange settingKey="backgroundBorderWave" resetValue={0} aria-label="Krivudanje okvira" min={0} max={20} value={s.backgroundBorderWave??0} onChange={e=>edit({backgroundBorderWave:Number(e.target.value)})}/></SettingsPopover></>}
 <div className="caption-light-fields">
 {colorKey&&<label><span>Boja</span><ColorPicker value={s[colorKey]??(id==='depth'?'#18242c':s.backgroundColor2??'#ffffff')} onReset={()=>edit({[colorKey]:undefined})} onChange={e=>edit({[colorKey]:e.target.value})}/></label>}
 <SettingsPopover label={id==='border'?'Debljina':id==='depth'?'Dubina':'Jačina'} value={String(value)}><CaptionRange settingKey={key} resetValue={fallback} aria-label={title} min={0} max={id==='border'?12:id==='depth'?40:100} value={value} onChange={e=>edit({[key]:Number(e.target.value)})}/></SettingsPopover>
 {id==='shadow'&&<SettingsPopover label="Mekoća sjene" value={String(s.backgroundShadowBlur??25)}><CaptionRange settingKey="backgroundShadowBlur" resetValue={25} aria-label="Mekoća sjene" min={0} max={100} value={s.backgroundShadowBlur??25} onChange={e=>edit({backgroundShadowBlur:Number(e.target.value)})}/></SettingsPopover>}
 </div></CaptionEffectSection>;
 })}
 </>}
 </>}</div>;
}
