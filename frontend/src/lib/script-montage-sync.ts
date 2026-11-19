import {localCaptionLook} from './local-caption-style';
import type {Script} from './production';
import type {VideoCaptions} from './video-captions';
import {narrationText} from './narration-sync';
import {clipsFollowCaptions} from './local-timeline';
export const scriptSourceKey=(script:Pick<Script,'segments'>)=>JSON.stringify(script.segments.map(s=>[s.id,narrationText(s.text),s.start,s.end]));
export const scriptTextKey=(segments:{id:string;text:string}[])=>JSON.stringify(segments.map(s=>[s.id,narrationText(s.text)]));
export const scriptChoices=(script:Script)=>Object.fromEntries(script.segments.map(s=>[s.id,script.photo_settings.narrationPlan?.scenes[s.id]?.assetId||'']));
export function syncScriptDocument(data:Record<string,unknown>,script:Script){
 // A preeditor montage is an authored selection, not a mirror of every source interval.
 if(data.preeditor)return data;
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


// Apply upstream changes to the saved edit. Only captions belonging to a changed
// interval are updated. Split captions share the replacement text in their order.
export function reconcileSavedCaptions(data:Record<string,unknown>,script:Script,force=false){
 const docs=data.captions as Record<string,VideoCaptions>|undefined;
 const doc=docs?.__script;
 const key=(data.scriptSync as {sourceKey?:string}|undefined)?.sourceKey;
 if(!force&&key===scriptSourceKey(script))return data;
 if(!doc){const synced=syncScriptDocument({...data,scriptSync:undefined,preeditor:undefined},script);return {...synced,preeditor:data.preeditor};}
 type Row=[string,string,number,number];
 const previous=new Map<string,Row>();
 if(key){for(const row of JSON.parse(key) as Row[])previous.set(row[0],row);}
 const source=new Map(script.segments.map(s=>[s.id,s]));
 const sceneId=(s:VideoCaptions['segments'][number])=>s.sourceSceneId||s.id;
 // Re-dividing unchanged text can give it a new ID. Transfer only unique
 // matches, so repeated dialogue never attaches a clip to the wrong scene.
 const aliases=new Map<string,string>();
 for(const [id,row] of previous){
  if(source.has(id))continue;
  const candidates=script.segments.filter(s=>!previous.has(s.id)&&s.text.trim()===row[1].trim());
  if(candidates.length===1&&[...previous.values()].filter(v=>v[1].trim()===row[1].trim()).length===1)aliases.set(id,candidates[0].id);
 }
 for(const [id,next] of aliases)previous.set(next,previous.get(id)!);
 const priorSegments=doc.segments.map(s=>{
  const next=s.role!=='title'&&aliases.get(sceneId(s));
  return next?{...s,id:aliases.get(s.id)||s.id,sourceSceneId:next}:s;
 });
 const segments=priorSegments.filter(s=>s.role==='title'||!previous.has(sceneId(s))||source.has(sceneId(s)));
 for(const scene of script.segments){
  const old=previous.get(scene.id);
  const text=narrationText(scene.text,script.photo_settings.keepQuotes!==false).replace(/\*[^*]*\*/gs,'').trim();
  const family=segments.filter(s=>s.role!=='title'&&sceneId(s)===scene.id).sort((a,b)=>a.start-b.start);
  if(!family.length){
   if(text&&(force||!old)){
    const preceding=segments.filter(s=>s.role!=='title'&&s.start<=scene.start).sort((a,b)=>b.start-a.start)[0];
    const style=localCaptionLook(doc,preceding);
    segments.push({...scene,text,sourceSceneId:scene.id,separateStyle:true,detachedStyle:style,words:captionWords(text,scene.start,scene.end)});
   }
   continue;
  }
  const textChanged=(force||!old||old[1]!==scene.text)&&family.map(s=>s.text).join(' ')!==text;
  const timingChanged=old&&(old[2]!==scene.start||old[3]!==scene.end);
  if(!textChanged&&!timingChanged)continue;
  const tokens=text.split(/\s+/).filter(Boolean);
  const weights=family.map(s=>Math.max(1,s.text.trim().split(/\s+/).length));
  const total=weights.reduce((a,b)=>a+b,0);
  let used=0,weight=0;
  for(const [i,caption] of family.entries()){
   weight+=weights[i];
   const endWord=Math.round(tokens.length*weight/total);
   const value=textChanged?tokens.slice(used,endWord).join(' '):caption.text;
   used=endWord;
   const remap=(t:number)=>old&&timingChanged&&!caption.independentTiming?
     Math.max(0,scene.start+(family[0].start-old[2])+(t-family[0].start)*(scene.end-scene.start)/Math.max(.001,old[3]-old[2])):t;
   const start=remap(caption.start),end=Math.max(start+.001,remap(caption.end));
   segments[segments.indexOf(caption)]={...caption,text:value,start,end,words:textChanged?captionWords(value,start,end):caption.words?.map(w=>({...w,start:remap(w.start),end:remap(w.end)}))};
  }
 }
 const linked=((data.clips||[]) as Parameters<typeof clipsFollowCaptions>[0]).map(c=>aliases.size?{...c,captionId:aliases.get(c.captionId||'')||c.captionId,segmentIds:c.segmentIds?.map(id=>aliases.get(id)||id),narrationSegmentIds:c.narrationSegmentIds?.map(id=>aliases.get(id)||id)}:c);
 const clips=clipsFollowCaptions(linked,priorSegments,segments);
 return {...data,clips,captions:{...docs,__script:{...doc,segments:segments.sort((a,b)=>a.start-b.start)}}};
}
function captionWords(text:string,start:number,end:number){
 const words=text.split(/\s+/).filter(Boolean);
 return words.map((text,i)=>({text,start:start+(end-start)*i/words.length,end:start+(end-start)*(i+1)/words.length}));
}
