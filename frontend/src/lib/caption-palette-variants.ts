import {ordinaryColorVariants,colorKeys} from '../config/captions/ordinary-palettes';
import {styleLibraryCategory} from '../config/captions/style-library';
import {isTestStyle,ordinaryStyleFamily,ordinaryStyleFamilies} from '../config/captions/test-styles';
import type {CaptionSettings,CaptionTemplate,StyleKey} from '../config/captions/types';
import {templates,DEFAULT_CAPTION_SETTINGS} from '../config/captions/presets';
import {neonRiotTemplates,isNeonRiotStyle} from '../config/captions/neon-riot-variants';
import {aiPalettes,aiPalettePatch,hasAiPalettes} from '../config/captions/ai-palettes';
import {PrismPalettes} from './collection/prism-palettes.mjs';
import {HyperPalettes} from './collection/hyper-palettes.mjs';
import {studioMetadata} from '../config/captions/studio-collection';
import {collectionDefinition} from '../config/captions/collection';
export function captionPaletteVariants(style:StyleKey):{id:string;label:string;template:CaptionTemplate;patch:Partial<CaptionSettings>}[]{
 const base=templates.find(t=>t.key===style);if(!base)return [];
 const family=ordinaryStyleFamily(style),members=templates.filter(t=>ordinaryStyleFamilies[t.key]===family);
 // These families share typography and motion; their named choices only recolor them.
 if(['focus','karaoke','glow','cinema'].includes(family)){
  const colors=ordinaryColorVariants(base,DEFAULT_CAPTION_SETTINGS);
  return [colors[0],...members.map(t=>{const settings={...DEFAULT_CAPTION_SETTINGS,...t.preset};const patch:Partial<CaptionSettings>={collectionPalette:'basic-family-'+t.key};for(const key of colorKeys)patch[key]=settings[key];return {id:base.key+'-basic-family-'+t.key,label:t.name.split(' · ').slice(1).join(' · ')||t.name,template:base,patch};}),...colors.slice(1)];
 }
 if(members.length){const original=templates.find(t=>t.key===family)!;const keys=new Set(members.flatMap(t=>Object.keys(t.preset??{})));keys.add('y');return [...[original,...members].map((t,index)=>{const patch={...Object.fromEntries([...keys].map(key=>[key,DEFAULT_CAPTION_SETTINGS[key as keyof CaptionSettings]])),...t.preset,collectionPalette:'basic-original'};return {id:t.key,label:index===0?'Original':t.name.includes(' · ')?t.name.split(' · ').slice(1).join(' · '):t.name,template:t,patch};}),...ordinaryColorVariants(base,DEFAULT_CAPTION_SETTINGS).slice(1)];}
 const definition=collectionDefinition(style),meta=definition&&studioMetadata[definition[1]];
 if(meta)return meta.palettes.map(p=>({id:p.value,label:p.label,template:{...base,preset:{...base.preset,collectionPalette:p.value}},patch:{collectionPalette:p.value}}));
  if(['collectionCrystalFlux','collectionSilkTorsion'].includes(style))return ['collectionCrystalFlux','collectionSilkTorsion'].flatMap(key=>{const t=templates.find(t=>t.key===key)!;return aiPalettes.slice(0,5).map(p=>{const patch=aiPalettePatch(key,p.id);return {id:key+'-'+p.id,label:t.name+' · '+p.name,template:{...t,preset:{...t.preset,...patch}},patch};});});
  if(isNeonRiotStyle(style))return neonRiotTemplates.map(t=>({id:t.key,label:t.name.replace(/^Neon Riot · /,''),template:t,patch:t.preset??{}}));
  if(['collectionHyperPop','collectionJuiceJam'].includes(style))return Object.entries(HyperPalettes).filter(([id])=>['juice','berry','lagoon','ruby','sunset','candy','acid','cosmic','ocean','arctic'].includes(id)).map(([id,palette])=>({id,label:palette.label,template:{...base,name:palette.label,preset:{...base.preset,collectionPalette:id,...(['collectionHyperPop','collectionJuiceJam'].includes(style)?{collectionFont:id==='juice'?'bubble':'comic'}:{})}},patch:{collectionPalette:id,...(['collectionHyperPop','collectionJuiceJam'].includes(style)?{collectionFont:id==='juice'?'bubble':'comic'}:{})}}));
  if(style==='collectionPrismBloom')return Object.entries(PrismPalettes).map(([id,palette])=>({id,label:palette.label,template:{...base,name:palette.label,preset:{...base.preset,collectionPalette:id,...(['collectionHyperPop','collectionJuiceJam'].includes(style)?{collectionFont:id==='juice'?'bubble':'comic'}:{})}},patch:{collectionPalette:id,...(['collectionHyperPop','collectionJuiceJam'].includes(style)?{collectionFont:id==='juice'?'bubble':'comic'}:{})}}));
  if(hasAiPalettes(style))return aiPalettes.map(p=>{const patch=aiPalettePatch(style,p.id,base.preset);return {id:'tone-'+p.id,label:p.name,template:{...base,name:p.name,preset:{...base.preset,...patch}},patch};});
  if(style==='collectionForged')return Object.entries({gold:'Zlatna',silver:'Srebrna',ice:'Ledena',violet:'Ljubičasta',ruby:'Crvena',emerald:'Zelena',copper:'Bakrena',pink:'Ružičasta'}).map(([id,label])=>({id,label,template:{...base,name:label,preset:{...base.preset,collectionMaterial:id}},patch:{collectionMaterial:id}}));
  if(isTestStyle(style)||['Standard','Clean','Viral','Test'].includes(styleLibraryCategory(base)))return ordinaryColorVariants(base,DEFAULT_CAPTION_SETTINGS);
  return [];
}
