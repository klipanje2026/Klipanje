import type {Segment} from '../config/captions/presets';
import {mergeCaptionWithNext,nextCaptionToMerge} from './caption-timing';

export function snapTime(start:number,length:number,points:number[],threshold:number,enabled=true){
 let offset=0,guide:number|null=null,distance=threshold;
 if(enabled)for(const point of points)for(const edge of [start,start+length]){const d=Math.abs(point-edge);if(d<distance&&start+point-edge>=0){distance=d;offset=point-edge;guide=point;}}
 return {start:Math.max(0,start+offset),guide};
}
export function shiftSegment(s:Segment,delta:number):Segment{return {...s,start:s.start+delta,end:s.end+delta,words:s.words?.map(w=>({...w,start:w.start+delta,end:w.end+delta})),frameAnimationStart:s.frameAnimationStart===undefined?undefined:s.frameAnimationStart+delta,frameAnimationEnd:s.frameAnimationEnd===undefined?undefined:s.frameAnimationEnd+delta};}
export function rippleMove(segments:Segment[],id:string,start:number,_duration?:number){
 const selected=segments.find(s=>s.id===id);if(!selected||!Number.isFinite(start))return segments;
 const lane=segments.filter(s=>s.role===selected.role&&(s.lane||0)===(selected.lane||0)).sort((a,b)=>a.start-b.start);
 const index=lane.findIndex(s=>s.id===id),lower=index?lane[index-1].end:0;
 const delta=Math.max(lower,start)-selected.start,ids=new Set(lane.slice(index).map(s=>s.id));
 return segments.map(s=>ids.has(s.id)?shiftSegment(s,delta):s);
}
type LinkedClip={id:string;captionId?:string;segmentIds?:string[];sceneSlice?:{index:number;count:number};narrationSegmentIds?:string[];start:number;inPoint:number;outPoint:number};
export function clipsFollowCaptions<T extends LinkedClip>(clips:T[],before:Segment[],after:Segment[]):T[]{
 return clips.map(clip=>{
  if(clip.narrationSegmentIds?.length){const prior=before.find(s=>s.id===clip.narrationSegmentIds![0]),next=after.find(s=>s.id===clip.narrationSegmentIds![0]);return prior&&next&&prior.start!==next.start?{...clip,start:clip.start+next.start-prior.start}:clip;}
  if(!clip.captionId&&clip.segmentIds?.length){const targets=after.filter(s=>(clip.segmentIds!.includes(s.id)||!!s.sourceSceneId&&clip.segmentIds!.includes(s.sourceSceneId)));if(!targets.length)return clip;const start=Math.min(...targets.map(s=>s.start)),end=Math.max(...targets.map(s=>s.end));const count=clip.sceneSlice?.count||1,index=clip.sceneSlice?.index||0,length=(end-start)/count;return {...clip,start:start+length*index,outPoint:clip.inPoint+length};}
  if(!clip.captionId)return clip;const prior=before.find(s=>s.id===clip.captionId),next=after.find(s=>s.id===clip.captionId);
  if(!next)return {...clip,captionId:undefined};
  if(prior&&prior.start===next.start&&prior.end===next.end)return clip;
  return {...clip,start:next.start,outPoint:clip.inPoint+Math.max(.1,next.end-next.start)};
 });
}
export function captionsFollowClips<T extends LinkedClip>(before:T[],after:T[],segments:Segment[]):Segment[]{
 let next=segments;
 for(const clip of after){const prior=before.find(c=>c.id===clip.id);
  if(clip.narrationSegmentIds?.length&&prior&&clip.start!==prior.start){const ids=new Set(clip.narrationSegmentIds);next=next.map(s=>ids.has(s.id)?shiftSegment(s,clip.start-prior.start):s);continue;}
  if(!clip.captionId&&clip.segmentIds?.length&&prior){const id=clip.segmentIds[0];if(prior.start!==clip.start)next=rippleMove(next,id,clip.start);const last=next.find(s=>s.id===clip.segmentIds!.at(-1));const delta=(clip.outPoint-clip.inPoint)-(prior.outPoint-prior.inPoint);if(last&&delta){const end=Math.max(last.start+.1,last.end+delta),applied=end-last.end;next=next.map(s=>s.id===last.id?{...s,end}:s.role===last.role&&s.start>=last.end?shiftSegment(s,applied):s);}continue;}
  if(!clip.captionId)continue;if(!prior||prior.captionId!==clip.captionId)continue;
  if(prior.start!==clip.start)next=rippleMove(next,clip.captionId,clip.start);
  const delta=(clip.outPoint-clip.inPoint)-(prior.outPoint-prior.inPoint);
  if(Math.abs(delta)>.00001){const selected=next.find(s=>s.id===clip.captionId);if(!selected)continue;const end=Math.max(selected.start+.1,selected.end+delta),applied=end-selected.end;
   next=next.map(s=>s.id===selected.id?{...s,end,words:s.words?.map(w=>({...w,start:s.start+(w.start-s.start)*(end-s.start)/(s.end-s.start),end:s.start+(w.end-s.start)*(end-s.start)/(s.end-s.start)}))}:s.role===selected.role&&(s.lane||0)===(selected.lane||0)&&s.start>=selected.end?shiftSegment(s,applied):s);
  }
 }
 return next;
}
export const wordWeight=(text:string)=>Math.max(1,text.trim().split(/\s+/).filter(Boolean).length);
export function estimateSpeech(text:string){return Math.round(Math.max(.8,wordWeight(text)/3.2+(text.match(/[,;:]/g)?.length||0)*.1)*10)/10;}
export function mergeSpeechCaptions(segments:Segment[],id:string,range?:{start:number;end:number}){
 const first=segments.find(s=>s.id===id),second=nextCaptionToMerge(segments,id);if(!first||!second)return segments;
 const merged=mergeCaptionWithNext(segments,id),combined=merged.find(s=>s.id===id)!;
 const rate=range&&range.end>range.start?segments.filter(s=>s.role!=='title').reduce((sum,s)=>sum+wordWeight(s.text),0)/(range.end-range.start):0;
 const duration=Math.max(.2,rate?wordWeight(combined.text)/rate:estimateSpeech(combined.text)),end=first.start+duration,delta=end-second.end;
 const tokens=combined.text.trim().split(/\s+/).filter(Boolean);
 return merged.map(s=>s.id===id?{...s,end,words:tokens.map((text,i)=>({text,start:first.start+duration*i/tokens.length,end:first.start+duration*(i+1)/tokens.length}))}:s.role===first.role&&(s.lane||0)===(first.lane||0)&&s.start>=second.end?shiftSegment(s,delta):s);
}
export function narrationParts(text:string){
 const raw=text.match(/[^.!?\n]+(?:[.!?]+["”’»)]*|\n|$)/g)||[];
 const parts:string[]=[];
 for(const value of raw){const part=value.trim();if(!part)continue;
  if(parts.length&&(/^["”’»\s]+$/.test(part)||/^(?:["”’»]\s*)?(?:[\p{L}]+\s+)?(?:rekao|rekla|reče|upitao|upitala|odgovorio|odgovorila|šapnuo|šapnula|viknuo|viknula|dodao|dodala)\b/iu.test(part)))parts[parts.length-1]+=' '+part;
  else parts.push(part);
 }
 return parts;
}
export function fitCaptionSpeech(segments:Segment[],start:number,end:number){
 const speech=segments.filter(s=>s.role!=='title').sort((a,b)=>a.start-b.start),total=speech.reduce((sum,s)=>sum+wordWeight(s.text),0);
 if(!total||end<=start)return segments;
 let cursor=start;const next=new Map<string,Segment>();
 speech.forEach((s,i)=>{const finish=i===speech.length-1?end:cursor+(end-start)*wordWeight(s.text)/total,words=s.text.trim().split(/\s+/).filter(Boolean);next.set(s.id,{...s,start:cursor,end:finish,words:words.map((text,n)=>({text,start:cursor+(finish-cursor)*n/words.length,end:cursor+(finish-cursor)*(n+1)/words.length}))});cursor=finish;});
 return segments.map(s=>next.get(s.id)||s);
}
