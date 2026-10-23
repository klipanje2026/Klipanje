import type {Script} from './production';
import type {VideoCaptions} from './video-captions';
import {narrationText} from './narration-sync';
import {clipsFollowCaptions} from './local-timeline';
export const scriptSourceKey=(script:Pick<Script,'segments'>)=>JSON.stringify(script.segments.map(s=>[s.id,narrationText(s.text),s.start,s.end]));
export const scriptTextKey=(segments:{id:string;text:string}[])=>JSON.stringify(segments.map(s=>[s.id,narrationText(s.text)]));
export const scriptChoices=(script:Script)=>Object.fromEntries(script.segments.map(s=>[s.id,script.photo_settings.narrationPlan?.scenes[s.id]?.assetId||'']));
export function syncScriptDocument(data:Record<string,unknown>,script:Script){
 const docs=(data.captions||{}) as Record<string,VideoCaptions>,doc=docs.__script;
 const prior=(data.scriptSync as {sourceKey?:string}|undefined)?.sourceKey;
 const legacy=doc?scriptSourceKey({segments:doc.segments.filter(s=>s.role!=='title')}):'';
 if((prior||legacy)===scriptSourceKey(script))return data;
 // Preserve media links when re-splitting assigns fresh IDs to unchanged text.
 const normal=(text:string)=>narrationText(text).toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
 const aliases=new Map<string,string>();
 for(const old of doc?.segments||[]){if(script.segments.some(s=>s.id===old.id))continue;const matches=script.segments.filter(s=>normal(s.text)===normal(old.text)&&normal(s.text));if(matches.length===1&&(doc?.segments||[]).filter(s=>normal(s.text)===normal(old.text)).length===1)aliases.set(old.id,matches[0].id);}
 const priorSegments=(doc?.segments||[]).map(s=>({...s,id:aliases.get(s.id)||s.id,sourceSceneId:aliases.get(s.sourceSceneId||'')||s.sourceSceneId}));
 const segments:VideoCaptions['segments']=script.segments.map(s=>{
  const old=priorSegments.find(o=>o.id===s.id),text=narrationText(s.text,script.photo_settings.keepQuotes!==false);
  const tokens=text.split(/\s+/).filter(Boolean),span=s.end-s.start;
  const words=old?.text===text&&old.words?.length?old.words.map(w=>({...w,start:s.start+(w.start-old.start)*span/Math.max(.001,old.end-old.start),end:s.start+(w.end-old.start)*span/Math.max(.001,old.end-old.start)})):tokens.map((text,i)=>({text,start:s.start+span*i/tokens.length,end:s.start+span*(i+1)/tokens.length}));
  return {...old,...s,text,words,sourceSceneId:old?.sourceSceneId||s.id};
 });
 type Clip={id:string;start:number;inPoint:number;outPoint:number;captionId?:string;segmentIds?:string[];narrationSegmentIds?:string[]};
 segments.push(...(doc?.segments.filter(s=>s.role==='title')||[]));
 const linked=((data.clips||[]) as Clip[]).map(c=>({...c,captionId:aliases.get(c.captionId||'')||c.captionId,segmentIds:c.segmentIds?.map(id=>aliases.get(id)||id),narrationSegmentIds:c.narrationSegmentIds?.map(id=>aliases.get(id)||id)}));
 const clips=clipsFollowCaptions(linked,priorSegments,segments);
 return {...data,clips,captions:{...docs,__script:{...doc,segments}}};
}
