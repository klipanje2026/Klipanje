import type {Segment,CaptionSettings,StyleKey} from '../config/captions/types';
const small=new Set('i a u na je se da za od do sa s što sta šta to ovo ono mi ti ja on ona it the a an is to of and in'.split(' '));
/** Stable text-derived suggestions; a saved choice always wins, including explicit removal. */
export function captionWordRoles(segment:Segment,settings?:CaptionSettings){
 const words=segment.text.trim().split(/\s+/).filter(Boolean);
 const ranked=words.map((text,index)=>({index,score:small.has(text.toLocaleLowerCase('bs'))?0:text.replace(/[^\p{L}\p{N}]/gu,'').length})).sort((a,b)=>b.score-a.score||a.index-b.index);
 const valid=(index:number|null|undefined,fallback:number)=>index===null?-1:index!==undefined&&index>=0&&index<words.length?index:fallback;
 const manual=Object.keys(segment.wordStyles??{}).map(Number).find(index=>index>=0&&index<words.length);
 const keyword=valid(segment.keywordWord,manual??(settings?.emphasisWord!==undefined&&settings.emphasisWord>=0?Math.min(words.length-1,settings.emphasisWord):ranked[0]?.index??-1));
 const title=valid(segment.headingWord,ranked[0]?.index??-1);
 return {keyword,title};
}

export const ownCaptionLayout=(style:StyleKey)=>['premiumOrangeV4','metallicCompactV2','dynamicGlass'].includes(style);
export const ignoresCaptionTitles=(style:StyleKey)=>style.startsWith('collection')||style==='orbitSignal'||style==='velvetScript'||style==='inkImpact'||style==='prismFold'||style.startsWith('neonRiot')||ownCaptionLayout(style)||['prismWords','trackingStack','curvyBackdrop'].includes(style);
export function captionRenderSegment(segment:Segment,style:StyleKey):Segment{
 if(ownCaptionLayout(style)||style==='prismWords')return {...segment,wordStyles:undefined,keywordWord:undefined,headingWord:undefined,hiddenTitleWords:undefined,suppressSuggestions:false};
 if(style==='curvyBackdrop')return {...segment,hiddenTitleWords:undefined,keywordWord:segment.headingWord??segment.keywordWord};
 if(style==='trackingStack')return {...segment,hiddenTitleWords:undefined,wordStyles:undefined,keywordWord:undefined};
 if(['testSerif','smokeSerif','captionsScript','goldMesh'].includes(style))return {...segment,wordStyles:undefined,keywordWord:undefined};
 return segment;
}

export function captionNeedsPerson(style:StyleKey,settings:CaptionSettings,segments:Segment[]=[]):boolean{
 return ownCaptionLayout(style)||!!settings.behindPerson||!!settings.secondaryStyle?.behindPerson||!!settings.titleAppearance?.behindPerson||segments.some(s=>{const own=s.detachedStyle||s.laneStyle;return !!own&&(ownCaptionLayout(own.style)||!!own.settings.behindPerson||!!own.settings.secondaryStyle?.behindPerson);});
}
