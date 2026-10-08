import {isInkMixStyle,inkMixVariants} from '../config/captions/ink-mix-family';
import {isRiplineStyle,riplineVariants} from '../config/captions/ripline-family';
import {templates} from '../config/captions/presets';
import {LanguageDropdown} from './LanguageDropdown/LanguageDropdown';
import {useEffect,useState,type SetStateAction} from 'react';
import type {CaptionSettings,StyleKey,CaptionTemplate} from '../config/captions/types';
import {collectionDefinition} from '../config/captions/collection';
import {studioMetadata} from '../config/captions/studio-collection';
import {prepareCollectionStyle,collectionCaptionError} from '../lib/collection-captions';
import {CaptionRange} from './CaptionRange';
import './StudioStyleControls.scss';

export function StudioStyleControls({style,settings,onChange,onSelect}:{onSelect?:(template:CaptionTemplate)=>void;style:StyleKey;settings:CaptionSettings;onChange:(action:SetStateAction<CaptionSettings>)=>void}){
 const [error,setError]=useState('');
 useEffect(()=>{let active=true;setError('');void prepareCollectionStyle(style).catch(cause=>{if(active)setError(cause instanceof Error?cause.message:'Stil nije učitan.');});const timer=setInterval(()=>{if(active)setError(collectionCaptionError(style)||'');},1500);return()=>{active=false;clearInterval(timer);};},[style]);
 const definition=collectionDefinition(style),meta=definition&&studioMetadata[definition[1]];
 if(!definition||!meta)return null;
 const patch=(key:keyof CaptionSettings,value:string|number)=>onChange(previous=>({...previous,[key]:value}));
 const range=(key:keyof CaptionSettings,label:string,min:number,max:number,step:number,initial:number)=><label className="caption-popover-range" key={key}><span>{label}<b>{Number(settings[key]??initial)}</b></span><CaptionRange settingKey={key} resetValue={initial} aria-label={label} min={min} max={max} step={step} value={Number(settings[key]??initial)} onChange={event=>patch(key,Number(event.target.value))}/></label>;
 const selected=meta.palettes.find(p=>p.value===settings.collectionPalette)?.value??meta.palettes[0].value;
 const fineFontControl=['collectionStudioLuxuryWood','collectionStudioLuxuryGlass'].includes(style);
 const three=meta.mode==='title'&&meta.family!=='ricochet'||['powerCaptions','lustreCut','megaCaptions','liquidImpact','luxuryThemes','meadowType'].includes(meta.family);
 return <section className="studio-library-controls">

  {error&&<p role="alert">{error}</p>}
  {isRiplineStyle(style)&&<LanguageDropdown label="Ripline varijanta" value={style} disabled={!onSelect} options={[...riplineVariants]} onChange={key=>{const next=templates.find(t=>t.key===key);if(next)onSelect?.(next);}}/>}
  {isInkMixStyle(style)&&<LanguageDropdown label="Ink Mix · verzija" value={style} disabled={!onSelect} options={[...inkMixVariants]} onChange={key=>{const next=templates.find(t=>t.key===key);if(next)onSelect?.({...next,preset:{...next.preset,fontScale:settings.fontScale,fontSizePx:settings.fontSizePx,x:settings.x,y:settings.y,rotation:settings.rotation}});}}/>}
  <h3>Paleta</h3>
  <div className="studio-native-palettes" aria-label="Originalne palete">{meta.palettes.map(p=><button type="button" key={p.value} className={selected===p.value?'active':''} aria-pressed={selected===p.value} onClick={()=>patch('collectionPalette',p.value)}><span className="studio-palette-colors" aria-hidden="true">{p.colors.length?p.colors.map((color,i)=><i key={i} style={{background:color}}/>):<i style={{background:({reference:'#deded5',smoke:'#27323b',champagne:'#ae7949',glacier:'#90bbc9'} as Record<string,string>)[p.value]||'#90a5bb'}}/>}</span><span>{p.label}</span></button>)}</div>
  <div className="studio-native-ranges">
   {range('fontScale','Veličina titla (%)',10,400,1,100)}
   {range('fontSizePx','Veličina fonta (px)',fineFontControl?50:24,fineFontControl?150:200,1,100)}
   {range('collectionSpeed','Brzina animacije',.5,1.5,.05,1)}
   {meta.mode!=='glass'&&range('collectionPower','Jačina pokreta',0,1.5,.05,1)}
   {three&&range('collectionDepth','Dubina slova',.5,1.5,.05,meta.family==='liquidImpact'?1.15:1)}
   {(meta.mode==='title'||['powerCaptions','lustreCut','cutFinish','crystalGlass'].includes(meta.family))&&range('collectionShine','Odsjaj',0,1.5,.05,1)}
   {meta.mode!=='glass'&&!['portraitCaptions','quietWorlds','businessStack','meadowType'].includes(meta.family)&&range('collectionTexture','Tekstura',0,1.5,.05,meta.mode==='title'?.45:1)}
   {(meta.mode==='title'||['formCaptions','chromaCaptions','motionCaptions','kineticCaptions','amplifyCaptions','powerCaptions','quietWorlds','meadowType'].includes(meta.family))&&range('collectionEffects','Dodatni detalji',0,1.4,.05,1)}
   {meta.mode==='glass'&&range('collectionBlur','Zamućenje stakla',0,60,1,30)}
   {range('rotation','Rotacija',-180,180,1,0)}
  </div>
 </section>;
}
