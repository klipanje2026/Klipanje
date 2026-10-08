import type {SetStateAction} from 'react';
import type {CaptionSettings,CaptionTemplate,StyleKey} from '../config/captions/types';
import {captionPaletteVariants} from '../lib/caption-palette-variants';
export function OrdinaryPaletteChoices({style,settings,onSelect,onChange}:{style:StyleKey;settings:CaptionSettings;onSelect?:(template:CaptionTemplate)=>void;onChange?:(action:SetStateAction<CaptionSettings>)=>void}){
 const variants=captionPaletteVariants(style);
 if(!variants.some(v=>v.patch.collectionPalette?.startsWith('basic-')))return null;
 const selected=settings.collectionPalette?.startsWith('basic-')?settings.collectionPalette:'basic-original';
 return <section className="ordinary-palette-section"><h3>Palete i varijacije</h3><div className="ai-palette-choices">
  {variants.map(v=>{const p=v.patch,active=v.template.key===style&&p.collectionPalette===selected;
   const background=(p.backgroundOpacity??v.template.preset?.backgroundOpacity??settings.backgroundOpacity)>0;
   return <button type="button" key={v.id} className={active?'active':''} aria-pressed={active} onClick={()=>{
    if(v.id.includes('-basic-')&&v.template.key===style&&onChange)onChange(previous=>({...previous,...p}));
    else onSelect?.({...v.template,preset:{...p,fontScale:settings.fontScale,fontSizePx:settings.fontSizePx,x:settings.x,y:settings.y,rotation:settings.rotation}});
   }}><span className="ai-palette-colors" aria-hidden="true">{[p.textColor??'#ffffff',p.highlightColor??p.textColor??'#ffffff',background?p.backgroundColor:p.outlineColor??p.glowColor??'#172130',p.outerOutlineColor??p.backgroundColor2??p.highlightColor??'#172130'].map((color,i)=><i key={i} style={{background:color}}/>)}</span><span>{v.label}</span></button>;
  })}
 </div></section>;
}
