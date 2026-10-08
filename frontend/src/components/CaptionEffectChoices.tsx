import {SettingsPopover} from './SettingsPopover';
import {CaptionRange} from './CaptionRange';
import {CaptionEffectSection} from './CaptionEffectSection';
import {useEffect,useRef} from 'react';
import {DEFAULT_CAPTION_SETTINGS} from '../config/captions/presets';
import type {CaptionSettings} from '../config/captions/types';
import {drawCaptionOutlines,drawTextUnderline} from '../lib/text-surface';
import {ColorPicker} from './ColorPicker/ColorPicker';
import './CaptionEffectChoices.scss';

const lines=[['solid','Puna'],['double','Dvostruka'],['dashed','Isprekidana'],['dotted','Tačkasta'],['marker','Marker'],['pencil','Olovka'],['script','Captions Script']] as const;
const outlines=[['solid','Puni'],['double','Dvostruki'],['dashed','Isprekidani'],['dotted','Tačkasti'],['neon','Neon'],['glow','Sjaj']] as const;
function Sample({kind,mode}:{kind:string;mode:'outline'|'underline'|'strike'}){
 const ref=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  const element=ref.current;if(!element)return;
  const paint=()=>{const ctx=element.getContext('2d');if(!ctx)return;const color=getComputedStyle(element).color;
   ctx.clearRect(0,0,240,100);ctx.font='400 56px Arial';ctx.textBaseline='middle';ctx.textAlign='center';ctx.fillStyle=color;
   const settings={...DEFAULT_CAPTION_SETTINGS,outlineWidth:1.5,outlineColor:color,outlineStyle:kind as CaptionSettings['outlineStyle'],textUnderline:mode==='underline',textStrike:mode==='strike',textUnderlineStyle:kind as CaptionSettings['textUnderlineStyle'],textStrikeStyle:kind as CaptionSettings['textStrikeStyle']};
   if(mode==='outline')drawCaptionOutlines(ctx,'Aa',120,50,56,settings);
   else {ctx.save();ctx.globalAlpha=1;ctx.fillText('Aa',120,44);ctx.restore();drawTextUnderline(ctx,'Aa',120,44,56,settings);}
  };paint();const observer=new MutationObserver(paint);observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme','data-palette','style']});return()=>observer.disconnect();
 },[kind,mode]);
 return <canvas ref={ref} width={240} height={100} aria-hidden="true"/>;
}
export function CaptionEffectChoices({mode,value,onChange}:{mode:'outline'|'underline'|'strike';value:string;onChange:(value:string)=>void}){
 return <div className="caption-effect-choices" role="group" aria-label={mode==='outline'?'Vrsta okvira':'Vrsta linije'}>{(mode==='outline'?outlines:lines).map(([id,label])=><button type="button" key={id} title={label} aria-label={label} aria-pressed={value===id} onClick={()=>onChange(id)}><Sample kind={id} mode={mode}/><span>{label}</span><i aria-hidden="true">{value===id?'✓':''}</i></button>)}</div>;
}
export function CaptionLineEditor({settings,patch,strike=false}:{settings:CaptionSettings;patch:(value:Partial<CaptionSettings>)=>void;strike?:boolean}){
 const enabled=strike?'textStrike':'textUnderline',style=strike?'textStrikeStyle':'textUnderlineStyle',color=strike?'textStrikeColor':'textUnderlineColor',offset=strike?'textStrikeOffset':'textUnderlineOffset',width=strike?'textStrikeWidth':'textUnderlineWidth',skew=strike?'textStrikeSkew':'textUnderlineSkew';
 return <div className="caption-line-editor">
  <CaptionEffectSection id={strike?'strike':'underline'} title={strike?'Efekti precrtavanja':'Efekti podvlačenja'} enabled={!!settings[enabled]} onChange={value=>patch({[enabled]:value})}>
  <span className="caption-effect-label">Vrsta linije</span>
  <CaptionEffectChoices mode={strike?'strike':'underline'} value={settings[enabled]?(settings[style]??'solid'):''} onChange={value=>patch({[style]:value,[enabled]:true})}/>
  {settings[style]==='script'&&<div className="caption-background-scopes" role="group" aria-label="Oblik Script linije">{([['full','Puna linija'],['right','Kraće · zavoj desno']] as const).map(([id,label])=><button key={id} type="button" aria-pressed={(settings.scriptLineMode??'full')===id} onClick={()=>patch({scriptLineMode:id})}>{label}</button>)}</div>}
  <div className="caption-line-fields">
   <label><span>Boja linije</span><ColorPicker onReset={()=>patch({[color]:undefined})} value={settings[color]??settings.textColor} onChange={event=>patch({[color]:event.target.value})}/></label>
   <SettingsPopover label={strike?"Položaj linije":"Razmak od teksta"} value={String(settings[offset]??(strike?0:6))}><label className="caption-popover-range"><span>{strike?'Položaj linije':'Razmak od teksta'}</span><CaptionRange settingKey={offset} resetValue={strike?0:6} aria-label={strike?'Položaj linije':'Razmak od teksta'} type="range" min="-30" max="40" step="1" value={settings[offset]??(strike?0:6)} onChange={event=>patch({[offset]:Math.max(-30,Math.min(40,Number(event.target.value)))})}/><small>% visine slova</small></label></SettingsPopover>
   <SettingsPopover label="Debljina linije" value={String(settings[width]??4.5)}><label className="caption-popover-range"><span>Debljina linije</span><CaptionRange settingKey={width} resetValue={4.5} aria-label="Debljina linije" type="range" min="1" max="15" step=".5" value={settings[width]??4.5} onChange={event=>patch({[width]:Math.max(1,Math.min(15,Number(event.target.value)))})}/><small>% visine slova</small></label></SettingsPopover>
  </div>
  <div className="caption-line-extra-row"><label className="caption-line-color-follow"><span>Prati boju teksta</span><input type="checkbox" checked={!settings[color]} onChange={event=>patch({[color]:event.target.checked?undefined:settings.textColor})}/></label><label><span>Nagib linije</span><span>{settings[skew]??0}°</span><CaptionRange settingKey={skew} resetValue={0} aria-label="Nagib linije" type="range" min="-20" max="20" step="1" value={settings[skew]??0} onChange={event=>patch({[skew]:Number(event.target.value)})}/></label></div>
 </CaptionEffectSection>
 </div>;
}
