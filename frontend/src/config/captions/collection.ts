import {studioDefinitions,studioMetadata,studioSamples,isStudioStyle} from './studio-collection';
import {handoffDefinitions} from './handoff-collection';
import {motionDefinitions,isMotionStyle} from './motion-collection';
import type {CaptionTemplate,CaptionSettings} from './types';

export const collectionDefinitions=[
 ['collectionHyperMarks','hyper-marks','HYPER POP MARKS','900 80px Bungee',2,736/560],
 ['collectionHyperPop','hyper-pop','HYPER POP','900 80px Bungee',2,736/560],
 ['collectionJuiceJam','juice-jam','JUICE JAM','900 80px Bungee',2,736/560],
 ['collectionPrismBloom','prism-bloom','PRISM BLOOM','italic 144px "DM Serif Display"',2,736/480],
 ['collectionInkRiot','ink-riot','INK RIOT','160px Knewave',2,736/480],
 ['collectionForged','forged','FORGED','112px Bungee',2,736/460],
 ['collectionAtelierNoir','atelier-noir','ATELIER NOIR','700 400px Cinzel',2,736/500],
 ['collectionRealityRift','reality-rift','REALITY RIFT','400 400px "Rammetto One"',2,736/560],
 ['collectionTitaniumEdge','titanium-edge','TITANIUM EDGE','800 80px "Barlow Condensed"',2,736/560],
 ['collectionMagmaCore','magma-core','MAGMA CORE','200px Bungee',2,736/500],
 ['collectionAbyssalPearl','abyssal-pearl','ABYSSAL PEARL','200px "Dela Gothic One"',2,736/500],
 ['collectionPaperSculpt','paper-sculpt','PAPER SCULPT','200px "Bowlby One SC"',2,736/500],
 ['collectionVelvetPulse','velvet-pulse','VELVET PULSE','160px "Lilita One"',2,736/480],
 ['collectionPorcelainFlow','porcelain-flow','PORCELAIN FLOW','160px Rakkas',2,736/485],
 ['collectionLaserTrace','laser-trace','LASER TRACE','700 110px Orbitron',2,736/470],
 ['collectionFusionCaps','fusion-caps','FUSION CAPS','180px "Archivo Black"',3,16/9],
 ['collectionDepth','depth','3D DEPTH','800 54px "Barlow Condensed"',0,736/360],
 ['collectionKaraoke','karaoke','KARAOKE','700 42px "DM Sans"',0,736/360],
 ['collectionCinema','cinema','CINEMA','600 41px "Playfair Display"',0,736/360],
 ['collectionNeon','neon','NEON','700 54px "Barlow Condensed"',0,736/360],
 ['collectionPopPunch','pop-punch','POP PUNCH','900 52px "Barlow Condensed"',0,736/360],
 ['collectionGlass','glass','GLASS','500 33px "DM Sans"',0,736/360],
 ...motionDefinitions,
 ...handoffDefinitions,
 ...studioDefinitions,
] as const;
export type CollectionStyleKey=typeof collectionDefinitions[number][0];
export const isCollectionStyle=(style:string):style is CollectionStyleKey=>collectionDefinitions.some(d=>d[0]===style);
export const collectionDefinition=(style:string)=>collectionDefinitions.find(d=>d[0]===style);
const accents=['#d9ff61','#c0ed58','#e6c87b','#c884ff','#e8ff5c','#c3fbff'];
export const collectionTemplates:CaptionTemplate[]=collectionDefinitions.map(([key,id,name,font,,],index)=>({
 key,name,category:'Dinamični',sample:studioSamples[key]||'Tvoje riječi stvaraju nove svjetove.',portrait:key==='collectionLaserTrace'?1:index%7,
 preset:{...(isStudioStyle(key)?{x:50,y:70}:{}),fontFamily:font.replace(/^(?:italic\s+)?(?:\d+\s+)?\d+px\s+/,''),fontScale:100,fontWeight:900,
  textColor:'#ffffff',highlightColor:accents[index-16]??'#ff3eaa',outlineWidth:0,backgroundOpacity:0,
  wordMode:'template',animation:'none',reveal:'none',behindPerson:false,
  collectionPalette:isStudioStyle(key)?studioMetadata[id].palettes[0].value:id==='prism-bloom'?'amber':id==='juice-jam'?'juice':'candy',collectionFont:id==='juice-jam'?'bubble':'comic',collectionMark:'auto',collectionMaterial:'ice',
  collectionSpeed:1,collectionDepth:isStudioStyle(key)?undefined:id==='forged'?28:id==='abyssal-pearl'?1.35:1,collectionPower:isStudioStyle(key)?undefined:1,
  collectionDetail:1,collectionDecorations:true,collectionBackdrop:false,...(id.startsWith('motion-')?{collectionColors:'{}'}:{})},
}));
export const collectionLabel=(style:string)=>isStudioStyle(style)?'Studio kolekcija':isMotionStyle(style)?'Kolekcija 02':'Kolekcija 01';
export type CollectionControl={key:keyof CaptionSettings;label:string;min:number;max:number;step:number;initial:number};
export function collectionControls(style:string):CollectionControl[]{
 const range=(key:keyof CaptionSettings,label:string,min:number,max:number,step:number,initial=1)=>({key,label,min,max,step,initial});
 const controls=[range('collectionSpeed','Brzina animacije',.5,1.5,.1)];
 if(['collectionHyperMarks','collectionHyperPop','collectionJuiceJam','collectionAtelierNoir','collectionRealityRift','collectionTitaniumEdge','collectionPaperSculpt','collectionMagmaCore','collectionAbyssalPearl','collectionDepth'].includes(style))controls.push(range('collectionDepth','Dubina slojeva',.5,1.8,.1,style==='collectionAbyssalPearl'?1.35:1));
 if(style==='collectionForged')controls.push(range('collectionDepth','Dubina metala',12,38,1,28));
 if(['collectionHyperMarks','collectionHyperPop','collectionJuiceJam','collectionRealityRift','collectionTitaniumEdge','collectionFusionCaps'].includes(style))controls.push(range('collectionPower','Jačina efekata',style==='collectionFusionCaps'?.5:.45,style==='collectionFusionCaps'?1.5:1.7,.05));
 const label:Record<string,string>={collectionPrismBloom:'Svjetlo u kristalu',collectionMagmaCore:'Toplina lave',collectionAbyssalPearl:'Biser i odsjaji',collectionVelvetPulse:'Elastičnost',collectionPorcelainFlow:'Sjaj glazure',collectionLaserTrace:'Sjaj lasera'};
 if(label[style])controls.push(range('collectionDetail',label[style],.4,1.5,.1));
 return controls;
}
