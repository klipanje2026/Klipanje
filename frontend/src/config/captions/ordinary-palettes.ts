import type {CaptionSettings,CaptionTemplate} from './types';

const colors=[
 {id:'ocean',name:'Ocean / cobalt',face:'#e9faff',accent:'#36c9ff',second:'#3564ed',dark:'#102a48'},
 {id:'amber',name:'Amber / espresso',face:'#fff3d6',accent:'#ffbd38',second:'#f47a32',dark:'#382519'},
 {id:'rose',name:'Rose / plum',face:'#fff0f8',accent:'#ff65a7',second:'#aa5de0',dark:'#3b1e3c'},
 {id:'mint',name:'Mint / forest',face:'#eaffef',accent:'#55e5ab',second:'#13a5a2',dark:'#123b32'},
];
export const colorKeys=['textColor','highlightColor','backgroundColor','backgroundColor2','outlineColor','outerOutlineColor','outlineGlowColor','glowColor','shadowColor','shadowSecondColor','underlineColor','textUnderlineColor','textStrikeColor','backgroundBorderColor','backgroundGlowColor','backgroundDepthColor','frameColor','surfaceColor','textDepthColor','accentColor','accentColor2'] as const;

/** Color-only patches preserve the user's font, motion, dimensions and background shape. */
export function ordinaryColorVariants(base:CaptionTemplate,defaults:CaptionSettings){
 const settings={...defaults,...base.preset};
 const original:Partial<CaptionSettings>={collectionPalette:'basic-original'};
 for(const key of colorKeys)original[key]=settings[key];
 const luminous=/neon|glow/i.test(base.key);
 const variants=colors.map(p=>{
  const patch:Partial<CaptionSettings>={collectionPalette:'basic-'+p.id,textColor:luminous?p.accent:p.face,highlightColor:p.accent,
   backgroundColor:p.dark,backgroundColor2:p.second,outlineColor:p.dark,outerOutlineColor:p.second,
   outlineGlowColor:p.accent,glowColor:p.accent,shadowColor:p.dark,shadowSecondColor:p.second,
   underlineColor:p.accent,textUnderlineColor:p.accent,textStrikeColor:p.second,
   backgroundBorderColor:p.accent,backgroundGlowColor:p.accent,backgroundDepthColor:p.dark,
   frameColor:p.accent,surfaceColor:p.face,textDepthColor:p.dark,accentColor:p.accent,accentColor2:p.second};
  return {id:base.key+'-basic-'+p.id,label:p.name,template:base,patch};
 });
 return [{id:base.key+'-basic-original',label:'Original',template:base,patch:original},...variants];
}
