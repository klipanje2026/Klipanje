import type {Segment} from '../config/captions/presets';
import {shiftSegment} from './local-timeline';
type SceneClip={id:string;type:string;groupId?:string;captionId?:string;segmentIds?:string[];narrationSegmentIds?:string[];start:number;inPoint:number;outPoint:number};
const ids=(c:SceneClip)=>[...c.segmentIds||[],...c.narrationSegmentIds||[],...c.captionId?[c.captionId]:[]];
export function swapSceneBundles<T extends SceneClip>(clips:T[],segments:Segment[],firstId:string,secondId:string){
 const a=clips.find(c=>c.id===firstId),b=clips.find(c=>c.id===secondId);if(!a||!b||a.id===b.id)return {clips,segments};
 const left=a.start<=b.start?a:b,right=left===a?b:a;
 const leftIds=new Set(ids(left)),rightIds=new Set(ids(right));
 if([...leftIds].some(id=>rightIds.has(id)))return {clips,segments};
 const leftLength=left.outPoint-left.inPoint,rightLength=right.outPoint-right.inPoint,delta=rightLength-leftLength;
 if(left.start+leftLength>right.start+.001)return {clips,segments};
 const family=(c:SceneClip,target:SceneClip,set:Set<string>)=>c.id===target.id||!!c.groupId&&c.groupId===target.groupId||ids(c).some(id=>set.has(id));
 const shiftFor=(start:number)=>start>=left.start+leftLength-.001&&start<right.start?delta:0;
 const leftDelta=right.start+delta-left.start,rightDelta=left.start-right.start;
 const nextSegments=segments.map(s=>shiftSegment(s,leftIds.has(s.id)||leftIds.has(s.sourceSceneId||'')?leftDelta:rightIds.has(s.id)||rightIds.has(s.sourceSceneId||'')?rightDelta:shiftFor(s.start)));
 const nextClips=clips.map(c=>{const offset=family(c,left,leftIds)?leftDelta:family(c,right,rightIds)?rightDelta:(c.type==='video'||ids(c).length?shiftFor(c.start):0);return offset?{...c,start:Math.max(0,c.start+offset)}:c;});
 return {clips:nextClips,segments:nextSegments};
}
