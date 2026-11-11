import type {Segment} from '../config/captions/presets';
import {shiftSegment} from './local-timeline';
import {separateSceneOverlaps} from './scene-ripple';
type Clip={id:string;type:string;audioRole?:string;layer:number;start:number;inPoint:number;outPoint:number;allowOverlap?:boolean;groupId?:string;captionId?:string;segmentIds?:string[];narrationSegmentIds?:string[]};
type Timed={id:string;kind:string;start:number;end:number;allowOverlap?:boolean};
const ids=(c:Clip)=>[...c.segmentIds||[],...c.narrationSegmentIds||[],...c.captionId?[c.captionId]:[]];
const lane=(c:Clip)=>c.type==='video'?'video:'+c.layer:'audio:'+(c.audioRole||c.layer);
/** Evaluate each pointer position from the original snapshot, never from the last drag frame. */
export function moveTimelineClip<T extends Clip>(clips:T[],segments:Segment[],id:string,start:number,ripple:boolean,noOverlap:boolean,gap=0,scope:'lane'|'all'='all'){
 const chosen=clips.find(c=>c.id===id);if(!chosen||!Number.isFinite(start))return {clips,segments,delta:0};
 const members=new Set([id]),scenes=new Set(ids(chosen)),groups=new Set(chosen.groupId?[chosen.groupId]:[]);
 let expanded=scope==='all';while(expanded){expanded=false;for(const c of clips)if(!c.allowOverlap&&!members.has(c.id)&&(!!c.groupId&&groups.has(c.groupId)||ids(c).some(s=>scenes.has(s)))){members.add(c.id);ids(c).forEach(s=>scenes.add(s));if(c.groupId)groups.add(c.groupId);expanded=true;}}
 const min=Math.min(...clips.filter(c=>members.has(c.id)).map(c=>c.start));
 let delta=Math.max(-min,start-chosen.start);
 if(noOverlap&&!chosen.allowOverlap){for(const c of clips.filter(c=>members.has(c.id)&&!c.allowOverlap)){
  const end=Math.max(0,...clips.filter(p=>!members.has(p.id)&&!p.allowOverlap&&lane(p)===lane(c)&&p.start<c.start-.00001).map(p=>p.start+p.outPoint-p.inPoint+(c.type==='video'?gap:0)));
  delta=Math.max(delta,end-c.start);
 }}
 const offsets=new Map<string,number>();
 for(const c of clips)if(members.has(c.id)||ripple&&!chosen.allowOverlap&&!c.allowOverlap&&c.start>chosen.start+.00001&&(scope==='all'||lane(c)===lane(chosen)))offsets.set(c.id,delta);
 const captionOffsets=new Map<string,number>(),protectedCaptions=new Set(clips.filter(c=>c.allowOverlap&&!members.has(c.id)).flatMap(ids));
 for(const c of clips)if(offsets.has(c.id))for(const s of ids(c))captionOffsets.set(s,delta);
 const next=clips.map(c=>offsets.has(c.id)?{...c,start:Math.max(0,c.start+delta)}:c);
 const captions=scope==='lane'?segments:segments.map(s=>{if(protectedCaptions.has(s.id)||protectedCaptions.has(s.sourceSceneId||''))return s;const d=captionOffsets.get(s.id)??captionOffsets.get(s.sourceSceneId||'')??(ripple&&!chosen.allowOverlap&&s.start>chosen.start+.00001?delta:0);return d?shiftSegment(s,d):s;});
 const repaired=noOverlap&&!chosen.allowOverlap?separateSceneOverlaps(scope==='lane'?next.filter(c=>lane(c)===lane(chosen)).map(c=>({...c,groupId:undefined,captionId:undefined,segmentIds:undefined,narrationSegmentIds:undefined})):next,scope==='lane'?[]:captions,gap):null;
 const result=repaired?scope==='lane'?{clips:next.map(c=>{const r=repaired.clips.find(r=>r.id===c.id);return r&&r.start!==c.start?{...c,start:r.start}:c;}),segments:captions}:repaired:{clips:next,segments:captions};
 return {...result,delta};
}
const overlayLane=(o:Timed)=>o.kind==='lightning'||o.kind==='sunlight'?'effects':o.kind==='sleep'||o.kind==='clock'?'animations':'decorations';
export function repairOverlayOverlaps<T extends Timed>(items:T[]):T[]{
 const starts=new Map<string,number>();
 for(const key of new Set(items.map(overlayLane))){let end=0;for(const o of items.filter(o=>!o.allowOverlap&&overlayLane(o)===key).sort((a,b)=>a.start-b.start)){const at=Math.max(end,o.start);starts.set(o.id,at);end=at+o.end-o.start;}}
 return items.map(o=>starts.has(o.id)&&starts.get(o.id)!>o.start?{...o,start:starts.get(o.id)!,end:o.end+starts.get(o.id)!-o.start}:o);
}
export function editOverlayTiming<T extends Timed>(before:T[],after:T[],ripple:boolean,noOverlap:boolean,scope:'lane'|'all'='lane'):T[]{
 const old=before.find(o=>{const n=after.find(n=>n.id===o.id);return n&&(n.start!==o.start||n.end!==o.end);});
 if(!old&&!after.some(n=>!before.some(o=>o.id===n.id)))return after;
 const next=old&&after.find(n=>n.id===old.id),delta=old&&next?next.end-old.end:0;
 if(next?.allowOverlap)return after;
 const shifted=after.map(o=>old&&next&&!next.allowOverlap&&ripple&&!o.allowOverlap&&o.id!==old.id&&(scope==='all'||overlayLane(o)===overlayLane(old))&&o.start>old.start+.00001?{...o,start:Math.max(0,o.start+delta),end:Math.max(0,o.start+delta)+o.end-o.start}:o);
 if(!noOverlap)return shifted;
 const target=old||after.find(o=>!before.some(p=>p.id===o.id));
 if(scope==='lane'&&target){const repaired=repairOverlayOverlaps(shifted.filter(o=>overlayLane(o)===overlayLane(target)));return shifted.map(o=>repaired.find(r=>r.id===o.id)||o);}
 return repairOverlayOverlaps(shifted);
}
export function rippleOverlays<T extends Timed>(items:T[],threshold:number,delta:number):T[]{return items.map(o=>!o.allowOverlap&&o.start>threshold+.00001?{...o,start:Math.max(0,o.start+delta),end:Math.max(0,o.start+delta)+o.end-o.start}:o);}

/** Global ripple from an overlay edit; lane mode never calls this. */
export function rippleFromOverlay<C extends Clip,O extends Timed>(before:O[],after:O[],clips:C[],segments:Segment[]){
 const old=before.find(o=>{const n=after.find(n=>n.id===o.id);return n&&(n.start!==o.start||n.end!==o.end);}),next=old&&after.find(o=>o.id===old.id);
 if(!old||!next||next.allowOverlap)return {clips,segments};
 const delta=next.end-old.end,protectedIds=new Set(clips.filter(c=>c.allowOverlap).flatMap(ids));
 return {clips:clips.map(c=>!c.allowOverlap&&c.start>old.start+.00001?{...c,start:Math.max(0,c.start+delta)}:c),segments:segments.map(s=>!protectedIds.has(s.id)&&!protectedIds.has(s.sourceSceneId||'')&&s.start>old.start+.00001?shiftSegment(s,Math.max(-s.start,delta)):s)};
}
