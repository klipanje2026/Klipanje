import {isCollectionStyle} from './collection';
import {isStudioStyle} from './studio-collection';
import type {CaptionSettings} from './types';
export const aiPalettes=[
 {id:'original',name:'Original',hue:0,face:'#fff4df',accent:'#ffd34e',second:'#ff6e49'},
 {id:'ocean',name:'Ocean',hue:170,face:'#eafaff',accent:'#42d9ef',second:'#5075ff'},
 {id:'rose',name:'Rose',hue:290,face:'#fff0f8',accent:'#ff75b8',second:'#ac65ef'},
 {id:'emerald',name:'Emerald',hue:95,face:'#edfff3',accent:'#4ae3a1',second:'#b5ef63'},
 {id:'violet',name:'Violet',hue:235,face:'#f6efff',accent:'#b780ff',second:'#788dff'},
 {id:'amber',name:'Amber',hue:20,face:'#fff5d9',accent:'#ffc45d',second:'#ef8251'}
];
export const hasAiPalettes=(style:string)=>(isCollectionStyle(style)&&!isStudioStyle(style)&&!style.startsWith('collectionHandoff')&&!['collectionHyperPop','collectionJuiceJam','collectionPrismBloom','collectionForged'].includes(style))||['orbitSignal','velvetScript','prismFold','inkImpact'].includes(style);
export function aiPalettePatch(style:string,id:string,original:Partial<CaptionSettings>={}):Partial<CaptionSettings>{
 const p=aiPalettes.find(p=>p.id===id)??aiPalettes[0];
 if(style.startsWith('collection'))return {collectionPalette:'tone-'+id};
 const keys=style==='orbitSignal'?['textColor','highlightColor','orbitColor2']:style==='velvetScript'?['textColor','highlightColor','velvetShadowColor']:style==='inkImpact'?['textColor','highlightColor','inkColor2','inkBrushTextColor']:['textColor','highlightColor','foldColor2'];
 if(id==='original')return {...Object.fromEntries(keys.map(key=>[key,original[key as keyof CaptionSettings]])),collectionPalette:'tone-original'};
 if(style==='orbitSignal')return {collectionPalette:'tone-'+id,textColor:p.face,highlightColor:p.accent,orbitColor2:p.second};
 if(style==='velvetScript')return {collectionPalette:'tone-'+id,textColor:p.face,highlightColor:p.accent,velvetShadowColor:p.second};
 return style==='inkImpact'?{collectionPalette:'tone-'+id,textColor:p.face,highlightColor:p.accent,inkColor2:p.second,inkBrushTextColor:'#171920'}:{collectionPalette:'tone-'+id,textColor:p.face,highlightColor:p.accent,foldColor2:p.second};
}
export function aiPaletteFilter(style:string,palette:string|undefined){
 if(!palette?.startsWith('tone-')||palette==='tone-original')return 'none';
 const p=aiPalettes.find(p=>'tone-'+p.id===palette);if(!p)return 'none';
 const neutral=['collectionTitaniumEdge','collectionMosaicCurrent','collectionStrata','collectionAbyssalPearl','collectionPaperSculpt','collectionAtelierNoir','collectionPorcelainFlow'].includes(style);
 return `${neutral?'sepia(.7) saturate(1.8) ':''}hue-rotate(${p.hue}deg)`;
}
