import type {VideoCaptions} from './video-captions';
import {localCaptionLook} from './local-caption-style';

export function addMissingScriptCaptions(current:VideoCaptions,incoming:VideoCaptions):VideoCaptions{
 const existing=current.segments.filter(segment=>segment.role!=='title');
 const known=new Set(existing.flatMap(segment=>[segment.id,segment.sourceSceneId||segment.id]));
 const normalize=(text:string)=>text.replace(/\s+/g,' ').trim();
 // A merged subtitle can cover several original intervals.
 for(const segment of existing){
  const index=incoming.segments.findIndex(item=>item.id===(segment.sourceSceneId||segment.id));
  if(index<0)continue;
  let combined='';
  const ids:string[]=[];
  for(const source of incoming.segments.slice(index)){
   combined=normalize(combined+' '+source.text);
   ids.push(source.id);
   if(combined===normalize(segment.text)){ids.forEach(id=>known.add(id));break;}
   if(combined.length>=normalize(segment.text).length)break;
  }
 }
 const segments=[...current.segments];
 let anchorEnd=0,sourceEnd=0;
 let preceding=existing[0];
 for(const source of incoming.segments){
  if(known.has(source.id)){
   const family=existing.filter(item=>item.id===source.id||item.sourceSceneId===source.id);
   if(family.length){
    preceding=family[family.length-1];
    anchorEnd=Math.max(...family.map(item=>item.end));
    sourceEnd=source.end;
   }
   continue;
  }
  const gap=Math.max(0,source.start-sourceEnd);
  const start=Math.max(source.start,anchorEnd+gap,...segments.filter(item=>item.role!=='title').map(item=>item.end));
  const duration=Math.max(.1,source.end-source.start);
  const delta=start-source.start;
  const look=localCaptionLook(current,preceding);
  const added={...source,start,end:start+duration,separateStyle:true,detachedStyle:{style:look.style,settings:{...look.settings}},words:source.words?.map(word=>({...word,start:word.start+delta,end:word.end+delta}))};
  segments.push(added);
  preceding=added;
  anchorEnd=added.end;
  sourceEnd=source.end;
  known.add(source.id);
 }
 return segments.length===current.segments.length?current:{...current,segments};
}
