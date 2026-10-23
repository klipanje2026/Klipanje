import type {Segment} from '../config/captions/presets';
import {shiftSegment} from './local-timeline';
type SceneClip={id:string;type:string;audioRole?:string;layer:number;groupId?:string;captionId?:string;segmentIds?:string[];narrationSegmentIds?:string[];start:number;inPoint:number;outPoint:number};
const links=(c:SceneClip)=>[...c.segmentIds||[],...c.narrationSegmentIds||[],...c.captionId?[c.captionId]:[]];
/** Move each bundle exactly once, from the drag-start snapshot. Background audio stays put. */
function applyOffsets<T extends SceneClip>(clips:T[],segments:Segment[],offsets:Map<string,number>){
 const sceneOffsets=new Map<string,number>(),groups=new Map<string,number>();
 for(const c of clips){const delta=offsets.get(c.id);if(delta===undefined)continue;for(const id of links(c))if(!sceneOffsets.has(id))sceneOffsets.set(id,delta);if(c.groupId&&!groups.has(c.groupId))groups.set(c.groupId,delta);}
 return {clips:clips.map(c=>{const delta=offsets.get(c.id)??(c.groupId?groups.get(c.groupId):undefined)??links(c).map(id=>sceneOffsets.get(id)).find(d=>d!==undefined)??0;return delta?{...c,start:Math.max(0,c.start+delta)}:c;}),segments:segments.map(s=>{const delta=sceneOffsets.get(s.id)??sceneOffsets.get(s.sourceSceneId||'')??0;return delta?shiftSegment(s,delta):s;})};
}
export function moveSceneRipple<T extends SceneClip>(clips:T[],segments:Segment[],id:string,start:number){
 const chosen=clips.find(c=>c.id===id);if(!chosen||chosen.type!=='video'||!Number.isFinite(start))return {clips,segments};
 const lane=clips.filter(c=>c.type==='video'&&c.layer===chosen.layer).sort((a,b)=>a.start-b.start),index=lane.findIndex(c=>c.id===id);
 const lower=index?lane[index-1].start+lane[index-1].outPoint-lane[index-1].inPoint:0;
 const delta=Math.max(lower,start)-chosen.start,offsets=new Map<string,number>();
 let end=lower;
 for(const c of lane.slice(index)){const next=Math.max(end,c.start+delta);offsets.set(c.id,next-c.start);end=next+c.outPoint-c.inPoint;}
 return applyOffsets(clips,segments,offsets);
}
export function separateSceneOverlaps<T extends SceneClip>(clips:T[],segments:Segment[]){
 const offsets=new Map<string,number>();
 const lane=(c:T)=>c.type==='video'?'video:'+c.layer:'audio:'+(c.audioRole||c.layer);
 for(const key of new Set(clips.map(lane))){let end=0;for(const c of clips.filter(c=>lane(c)===key).sort((a,b)=>a.start-b.start)){const start=Math.max(end,c.start);if(start>c.start+.00001)offsets.set(c.id,start-c.start);end=start+c.outPoint-c.inPoint;}}
 return applyOffsets(clips,segments,offsets);
}

/** Carry a timing edit through following clips without shifting already-synchronised links twice. */
export function rippleTimingEdit<T extends SceneClip>(before:T[],after:T[],oldSegments:Segment[],segments:Segment[],ripple:boolean,noOverlap:boolean){
 let clips=after;
 const changed=[...before].sort((a,b)=>a.start-b.start).find(old=>{const next=after.find(c=>c.id===old.id);return next&&Math.abs(next.start+next.outPoint-next.inPoint-old.start-old.outPoint+old.inPoint)>.00001;});
 const changedCaption=!changed?[...oldSegments].sort((a,b)=>a.start-b.start).find(old=>{const next=segments.find(s=>s.id===old.id);return next&&Math.abs(next.end-old.end)>.00001;}):undefined;
 if(!changed&&!changedCaption&&!after.some(c=>!before.some(old=>old.id===c.id)))return {clips:after,segments};
 if(ripple){
  const next=changed?after.find(c=>c.id===changed.id):undefined;
  const threshold=changed?changed.start+changed.outPoint-changed.inPoint:changedCaption?.end;
  const delta=changed&&next?next.start+next.outPoint-next.inPoint-threshold!:changedCaption?(segments.find(s=>s.id===changedCaption.id)!.end-changedCaption.end):0;
  if(threshold!==undefined&&delta){
   clips=clips.map(c=>{const old=before.find(o=>o.id===c.id);return old&&old.id!==changed?.id&&old.start>=threshold-.00001&&c.start===old.start?{...c,start:Math.max(0,c.start+delta)}:c;});
   segments=segments.map(s=>{const old=oldSegments.find(o=>o.id===s.id);return old&&old.id!==changedCaption?.id&&old.start>=threshold-.00001&&s.start===old.start?shiftSegment(s,delta):s;});
  }
 }
 return noOverlap?separateSceneOverlaps(clips,segments):{clips,segments};
}
