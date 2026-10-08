import type {SetStateAction} from 'react';
import type {CaptionSettings,StyleKey,CaptionTemplate} from '../config/captions/types';
import type {captionPaletteVariants} from '../lib/caption-palette-variants';
import {aiPaletteFilter} from '../config/captions/ai-palettes';
import {HyperPalettes} from '../lib/collection/hyper-palettes.mjs';
import {prismColors} from '../lib/collection/prism-palettes.mjs';

export function AiPaletteChoices({style,variants,settings,onChange,onSelect}:{style:StyleKey;variants:ReturnType<typeof captionPaletteVariants>;settings:CaptionSettings;onChange:(action:SetStateAction<CaptionSettings>)=>void;onSelect?:(template:CaptionTemplate)=>void}){
 const base=variants.find(v=>v.template.key===style)?.template.preset;
 const selected=style==='collectionForged'?(settings.collectionMaterial??base?.collectionMaterial??'ice'):(settings.collectionPalette??base?.collectionPalette??'tone-original');
 return <div className="ai-palette-choices" role="group" aria-label="Palete boja">
  {variants.map(variant=>{
   const patch=variant.patch,preset={...variant.template.preset,...patch},palette=patch.collectionPalette;
   const hyper=HyperPalettes[palette as keyof typeof HyperPalettes];
   const prism=prismColors(palette??'amber');
   let colors:string[];
   if(['collectionHyperPop','collectionJuiceJam'].includes(style)&&hyper)colors=[...hyper.colors,hyper.background[0]];
   else if(style==='collectionPrismBloom')colors=['#effcff','#80dbe9','#476989','#c4a9d9','#537ab7'].map(c=>prism[c]);
   else if(style==='collectionForged'){const metal=({gold:'#edbc53',silver:'#c1cedb',ice:'#a0ddff',violet:'#aa85ff',ruby:'#ee4e71',emerald:'#4cdaa6',copper:'#c98559',pink:'#ed99c7'} as Record<string,string>)[variant.id];colors=['#f7f7ff',metal,'#303544'];}
   else if(!style.startsWith('collection'))colors=[preset.textColor??'#fff4df',preset.highlightColor??'#ffd34e',preset.velvetShadowColor??preset.inkColor2??preset.foldColor2??'#ff6e49'];
   else colors=style==='collectionAbyssalPearl'?['#d7e1eb','#67bdcf','#879cd0','#443775','#152436']:style==='collectionLaserTrace'?['#d3ffff','#63ddec','#9b80f1','#ffedcf','#ae7950']:['#fff4df','#ffd34e','#ff6e49','#303544','#8795ab'];
   const active=variant.template.key===style&&(patch.collectionMaterial??palette??variant.id)===selected;
   return <button type="button" key={variant.id} className={active?'active':''} aria-pressed={active} onClick={()=>{if(variant.template.key!==style&&onSelect)onSelect({...variant.template,preset:{...preset,fontSizePx:settings.fontSizePx,fontScale:settings.fontScale,rotation:settings.rotation,x:settings.x,y:settings.y}});else onChange(previous=>({...previous,...patch}));}}>
    <span className="ai-palette-colors" style={{filter:style.startsWith('collection')?aiPaletteFilter(style,palette):undefined}} aria-hidden="true">{colors.map((color,index)=><i key={index} style={{background:color}}/>)}</span><span>{variant.label}</span>
   </button>;
  })}
 </div>;
}
