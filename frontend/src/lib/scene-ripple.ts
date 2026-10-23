import type {Segment} from '../config/captions/presets';
import {shiftSegment} from './local-timeline';
type SceneClip={id:string;type:string;layer:number;groupId?:string;captionId?:string;segmentIds?:string[];narrationSegmentIds?:string[];start:number;inPoint:number;outPoint:number};
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
 for(const layer of new Set(clips.filter(c=>c.type==='video').map(c=>c.layer))){let end=0;for(const c of clips.filter(c=>c.type==='video'&&c.layer===layer).sort((a,b)=>a.start-b.start)){const start=Math.max(end,c.start);if(start>c.start+.00001)offsets.set(c.id,start-c.start);end=start+c.outPoint-c.inPoint;}}
 return applyOffsets(clips,segments,offsets);
}
