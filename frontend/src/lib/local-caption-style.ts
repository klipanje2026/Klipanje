import type {VideoCaptions} from './video-captions';
import type {Segment,CaptionSettings,StyleKey} from '../config/captions/presets';
export function captionScopeIds(segments:Segment[],scope:string){
 if(scope==='all')return segments.map(s=>s.id);
 return segments.filter(s=>scope.startsWith('family:')?(s.sourceSceneId||s.id)===scope.slice(7):s.id===scope).map(s=>s.id);
}
export function localCaptionLook(doc:VideoCaptions,segment?:Segment){
 const own=segment&&((segment.separateStyle===false?undefined:segment.detachedStyle)||segment.laneStyle);
 return {style:own?.style||doc.activeStyle,settings:{...(own?.settings||doc.captionSettings),...segment?.position}};
}
export function patchLocalCaptionStyle(doc:VideoCaptions,scope:string,patch:Partial<CaptionSettings>):VideoCaptions{
 const ids=new Set(captionScopeIds(doc.segments,scope));
 return {...doc,captionSettings:scope==='all'?{...doc.captionSettings,...patch}:doc.captionSettings,segments:doc.segments.map(s=>{
  if(!ids.has(s.id))return s;
  const own=localCaptionLook(doc,s);
  return {...s,separateStyle:true,detachedStyle:{style:own.style,settings:{...own.settings,...patch}},
   position:patch.x!==undefined||patch.y!==undefined?{x:patch.x??own.settings.x,y:patch.y??own.settings.y}:s.position};
 })};
}
export function setLocalCaptionStyle(doc:VideoCaptions,scope:string,style:StyleKey,settings:CaptionSettings):VideoCaptions{
 const ids=new Set(captionScopeIds(doc.segments,scope));
 return {...doc,...(scope==='all'?{activeStyle:style,captionSettings:settings}:{}),segments:doc.segments.map(s=>ids.has(s.id)?{...s,separateStyle:true,inheritedStyle:undefined,laneStyle:undefined,detachedStyle:{style,settings:{...settings,...s.position}},wordStyles:undefined}:s)};
}
