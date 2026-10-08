import type {CaptionSettings,Segment,StyleKey} from '../config/captions/types';
/** One preset appearance for the chosen captions and their titles, without word overrides. */
export function applyPresetCaptionStyle(segments:Segment[],ids:string[],style:StyleKey,settings:CaptionSettings,preservePosition=true,individual=false):Segment[]{
 const selected=new Set(ids),sources=segments.filter(s=>selected.has(s.id)&&s.role!=='title');
 return segments.map(s=>{
  const related=s.role==='title'&&(s.sourceCaptionId?selected.has(s.sourceCaptionId):sources.some(source=>s.start>=source.start&&s.start<source.end));
  if(!selected.has(s.id)&&!related)return s;
  const next=s.role==='title'?{...settings,position:'top' as const,x:s.position?.x??s.detachedStyle?.settings.x??50,y:s.position?.y??s.detachedStyle?.settings.y??28}:settings;
  return {...s,wordStyles:undefined,keywordWord:undefined,hiddenTitleWords:undefined,position:preservePosition?s.position:undefined,
   ...(s.role==='title'?{titleStyle:style,titleOverrides:{...next},detachedStyle:{style,settings:next}}:{...((individual||s.detachedStyle)?{separateStyle:true,detachedStyle:{style,settings:next}}:{}),laneStyle:{style,settings:next}})};
 });
}
