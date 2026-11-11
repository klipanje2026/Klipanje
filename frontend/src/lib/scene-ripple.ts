import {allowsAudioOverlap} from './independent-audio';
import type {Segment} from '../config/captions/presets';
import {shiftSegment} from './local-timeline';
type SceneClip={id:string;type:string;audioRole?:string;allowOverlap?:boolean;layer:number;linksDetached?:boolean;groupId?:string;captionId?:string;segmentIds?:string[];narrationSegmentIds?:string[];start:number;inPoint:number;outPoint:number};
const links=(c:SceneClip)=>[...c.segmentIds||[],...c.narrationSegmentIds||[],...c.captionId?[c.captionId]:[]];
/** Move each bundle exactly once, from the drag-start snapshot. Background audio stays put. */
function applyOffsets<T extends SceneClip>(clips:T[],segments:Segment[],offsets:Map<string,number>){
 const sceneOffsets=new Map<string,number>(),groups=new Map<string,number>();
 for(const c of clips){const delta=offsets.get(c.id);if(delta===undefined)continue;for(const id of links(c))if(!sceneOffsets.has(id))sceneOffsets.set(id,delta);if(c.groupId&&!groups.has(c.groupId))groups.set(c.groupId,delta);}
 return {clips:clips.map(c=>{if(allowsAudioOverlap(c))return c;const delta=offsets.get(c.id)??(c.groupId?groups.get(c.groupId):undefined)??links(c).map(id=>sceneOffsets.get(id)).find(d=>d!==undefined)??0;return delta?{...c,start:Math.max(0,c.start+delta)}:c;}),segments:segments.map(s=>{const delta=sceneOffsets.get(s.id)??sceneOffsets.get(s.sourceSceneId||'')??0;return delta?shiftSegment(s,delta):s;})};
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
const collisionLane=(c:SceneClip)=>c.type==='video'?'video:'+c.layer:'audio:'+(c.audioRole||c.layer);
/** Move only the edited clip to the nearest free interval. An exempt sound is never an obstacle. */
export function freeClipStart<T extends SceneClip>(clips:T[],id:string,start:number){
 const chosen=clips.find(c=>c.id===id);if(!chosen)return start;
 const requested=Math.max(0,start);if(allowsAudioOverlap(chosen))return requested;
 const length=chosen.outPoint-chosen.inPoint;
 const peers=clips.filter(c=>c.id!==id&&!allowsAudioOverlap(c)&&collisionLane(c)===collisionLane(chosen)).sort((a,b)=>a.start-b.start);
 const candidates:number[]=[];let end=0;
 for(const c of peers){if(c.start-end>=length-.00001)candidates.push(Math.max(end,Math.min(requested,c.start-length)));end=Math.max(end,c.start+c.outPoint-c.inPoint);}
 candidates.push(Math.max(end,requested));
 return candidates.reduce((best,n)=>Math.abs(n-requested)<Math.abs(best-requested)?n:best);
}
/** Pack connected bundles by lane while preserving their authored relative timing. */
export function separateSceneOverlaps<T extends SceneClip>(clips:T[],segments:Segment[],gap=0){
 const active=clips.filter(c=>!allowsAudioOverlap(c)),parent=new Map(active.map(c=>[c.id,c.id]));
 const root=(id:string):string=>{const p=parent.get(id)!;if(p===id)return id;const r=root(p);parent.set(id,r);return r;};
 const owner=new Map<string,string>();
 for(const c of active)for(const key of [...(c.groupId?['group:'+c.groupId]:[]),...links(c).map(id=>'caption:'+id)]){const other=owner.get(key);if(other)parent.set(root(c.id),root(other));else owner.set(key,c.id);}
 const bundles=new Map<string,T[]>();for(const c of active){const key=root(c.id);bundles.set(key,[...bundles.get(key)||[],c]);}
 const ends=new Map<string,number>(),offsets=new Map<string,number>();
 for(const bundle of [...bundles.values()].sort((a,b)=>Math.min(...a.map(c=>c.start))-Math.min(...b.map(c=>c.start)))){
  const local=new Map<string,number>(),internalEnds=new Map<string,number>();
  for(const c of [...bundle].sort((a,b)=>a.start-b.start)){const key=collisionLane(c),at=Math.max(c.start,internalEnds.get(key)??c.start);local.set(c.id,at);internalEnds.set(key,at+c.outPoint-c.inPoint+(c.type==='video'?Math.max(0,gap):0));}
  const delta=Math.max(0,...bundle.map(c=>(ends.get(collisionLane(c))??0)-local.get(c.id)!));
  for(const c of bundle){const at=local.get(c.id)!+delta;offsets.set(c.id,at-c.start);const key=collisionLane(c);ends.set(key,Math.max(ends.get(key)||0,at+c.outPoint-c.inPoint+(c.type==='video'?Math.max(0,gap):0)));}
 }
 const sceneOffsets=new Map<string,number>();
 for(const c of [...clips].sort((a,b)=>Number(a.type==='audio')-Number(b.type==='audio')))for(const id of links(c))sceneOffsets.set(id,offsets.get(c.id)||0);
 return {clips:clips.map(c=>offsets.get(c.id)?{...c,start:c.start+offsets.get(c.id)!}:c),segments:segments.map(s=>{const delta=sceneOffsets.get(s.id)??sceneOffsets.get(s.sourceSceneId||'')??0;return delta?shiftSegment(s,delta):s;})};
}

/** Carry a timing edit through following clips without shifting already-synchronised links twice. */
export function rippleTimingEdit<T extends SceneClip>(before:T[],after:T[],oldSegments:Segment[],segments:Segment[],ripple:boolean,noOverlap:boolean,gap=0,scope:'lane'|'all'='all'){
 let clips=after;
 const changed=[...before].sort((a,b)=>a.start-b.start).find(old=>{const next=after.find(c=>c.id===old.id);return next&&Math.abs(next.start+next.outPoint-next.inPoint-old.start-old.outPoint+old.inPoint)>.00001;});
 const changedCaption=!changed?[...oldSegments].sort((a,b)=>a.start-b.start).find(old=>{const next=segments.find(s=>s.id===old.id);return next&&Math.abs(next.end-old.end)>.00001;}):undefined;
 if(!changed&&!changedCaption&&!after.some(c=>!before.some(old=>old.id===c.id)))return {clips:after,segments};
 if(ripple&&!changed?.allowOverlap){
  const next=changed?after.find(c=>c.id===changed.id):undefined;
  const threshold=changed?changed.start+changed.outPoint-changed.inPoint:changedCaption?.end;
  const delta=changed&&next?next.start+next.outPoint-next.inPoint-threshold!:changedCaption?(segments.find(s=>s.id===changedCaption.id)!.end-changedCaption.end):0;
  if(threshold!==undefined&&delta){
   clips=clips.map(c=>{const old=before.find(o=>o.id===c.id);return !allowsAudioOverlap(c)&&old&&old.id!==changed?.id&&(scope==='all'||!!changed&&collisionLane(c)===collisionLane(changed))&&old.start>=threshold-.00001&&c.start===old.start?{...c,start:Math.max(0,c.start+delta)}:c;});
   segments=scope==='lane'&&changed?segments:segments.map(s=>{const old=oldSegments.find(o=>o.id===s.id);return old&&old.id!==changedCaption?.id&&old.start>=threshold-.00001&&s.start===old.start?shiftSegment(s,delta):s;});
  }
 }
 if(scope==='lane'&&changed){if(!noOverlap)return {clips,segments};const fixed=separateSceneOverlaps(clips.filter(c=>collisionLane(c)===collisionLane(changed)).map(c=>({...c,groupId:undefined,captionId:undefined,segmentIds:undefined,narrationSegmentIds:undefined})),[],gap);return {clips:clips.map(c=>{const r=fixed.clips.find(r=>r.id===c.id);return r&&r.start!==c.start?{...c,start:r.start}:c;}),segments};}
 return noOverlap?separateSceneOverlaps(clips,segments,gap):{clips,segments};
}
