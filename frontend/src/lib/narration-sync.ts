import type {Segment,CaptionWord} from '../config/captions/presets';
import {shiftSegment} from './local-timeline';
export const narrationText=(text:string,keep=true)=>keep?text:text.replace(/["„“”«»‹›]/g,'');
export type NarrationTiming={segmentIds:string[];text:string;words:CaptionWord[];duration:number;sync:boolean;placement:'scene'|'append'|'manual'};
export type MediaTiming={segmentIds?:string[];narration?:NarrationTiming};
const mediaTiming=new WeakMap<File,MediaTiming>();
export function rememberMediaTiming(file:File,value:MediaTiming){mediaTiming.set(file,value);}
export function getMediaTiming(file:File){return mediaTiming.get(file);}
export function fitCaptionsToAudio(segments:Segment[],ids:string[],start:number,duration:number):Segment[]{
 const targets=segments.filter(s=>ids.includes(s.id)||!!s.sourceSceneId&&ids.includes(s.sourceSceneId));
 if(!targets.length||duration<=0)return segments;
 const from=Math.min(...targets.map(s=>s.start)),end=Math.max(...targets.map(s=>s.end)),scale=duration/Math.max(.01,end-from),targetIds=new Set(targets.map(s=>s.id));
 const time=(value:number)=>start+(value-from)*scale,delta=start+duration-end;
 return segments.map(s=>targetIds.has(s.id)?{...s,start:time(s.start),end:time(s.end),words:s.words?.map(w=>({...w,start:time(w.start),end:time(w.end)}))}:s.role!=='title'&&s.start>=end?shiftSegment(s,delta):s);
}
export function alignmentWords(alignment:unknown):CaptionWord[]{
 const a=alignment as {characters?:string[];character_start_times_seconds?:number[];character_end_times_seconds?:number[]}|null;
 if(!Array.isArray(a?.characters)||!Array.isArray(a?.character_start_times_seconds)||!Array.isArray(a?.character_end_times_seconds))return [];
 const result:CaptionWord[]=[];let word:CaptionWord|undefined;
 for(let i=0;i<a.characters.length;i++){const text=a.characters[i],start=a.character_start_times_seconds[i],end=a.character_end_times_seconds[i];
  if(typeof text!=='string'||!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<start)return [];
  if(/\s/.test(text)){if(word){result.push(word);word=undefined;}}else if(word){word.text+=text;word.end=end;}else word={text,start,end};
 }
 if(word)result.push(word);return result;
}
export function fitNarration(segments:Segment[],timing:NarrationTiming,start:number):Segment[]{
 const ids=new Set(timing.segmentIds),targets=segments.filter(s=>(ids.has(s.id)||!!s.sourceSceneId&&ids.has(s.sourceSceneId))).sort((a,b)=>a.start-b.start);
 if(!timing.sync||!targets.length)return segments;
 const sourceWords=targets.flatMap(s=>s.text.trim().split(/\s+/).filter(Boolean));
 const words=timing.words.length===sourceWords.length?timing.words:sourceWords.map((text,i,all)=>({text,start:timing.duration*i/all.length,end:timing.duration*(i+1)/all.length}));
 const weights=targets.map(s=>Math.max(1,s.text.trim().split(/\s+/).length)),total=weights.reduce((a,b)=>a+b,0);
 const changes=new Map<string,Segment>();let count=0,weight=0;
 targets.forEach((s,i)=>{weight+=weights[i];const next=i===targets.length-1?words.length:Math.round(words.length*weight/total);const own=words.slice(count,next);const from=i===0?start:start+(own[0]?.start??timing.duration*weight/total);const end=i===targets.length-1?start+timing.duration:start+(words[next]?.start??timing.duration);
  changes.set(s.id,{...s,timingSource:timing.words.length?'narration':'estimate',start:from,end:Math.max(from+.01,end),text:s.text,words:s.text.trim().split(/\s+/).filter(Boolean).map((text,j,all)=>{const aligned=own.length===all.length?own[j]:undefined;return {text,start:aligned?start+aligned.start:from+(Math.max(from+.01,end)-from)*j/all.length,end:aligned?start+aligned.end:from+(Math.max(from+.01,end)-from)*(j+1)/all.length};})});count=next;
 });
 const oldEnd=targets[targets.length-1].end,delta=start+timing.duration-oldEnd;
 return segments.map(s=>changes.get(s.id)||(!(ids.has(s.id)||!!s.sourceSceneId&&ids.has(s.sourceSceneId))&&s.role!=='title'&&s.start>=oldEnd?shiftSegment(s,delta):s));
}
