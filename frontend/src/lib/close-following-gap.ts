import type {Segment} from '../config/captions/presets';
import {shiftSegment} from './local-timeline';
type Clip={id:string;type:string;layer:number;audioRole?:string;start:number;inPoint:number;outPoint:number;groupId?:string;captionId?:string;segmentIds?:string[];narrationSegmentIds?:string[]};
type Overlay={start:number;end:number};
/** Close one gap, moving the whole following tail by one offset. Never rewrite durations. */
export function closeFollowingGap<C extends Clip,O extends Overlay>(clips:C[],segments:Segment[],overlays:O[],selection:{clipId?:string;captionId?:string}){
 const unchanged={clips,segments,overlays,gap:0};
 const parent=new Map<string,string>();
 const root=(key:string):string=>{const p=parent.get(key);if(!p){parent.set(key,key);return key;}if(p===key)return key;const r=root(p);parent.set(key,r);return r;};
 const union=(a:string,b:string)=>parent.set(root(a),root(b));
 const ck=(c:C)=>'clip:'+c.id,sk=(s:Segment)=>'caption:'+s.id;
 for(const c of clips){root(ck(c));if(c.groupId)union(ck(c),'group:'+c.groupId);for(const id of [...c.segmentIds||[],...c.narrationSegmentIds||[],...c.captionId?[c.captionId]:[]])union(ck(c),'caption:'+id);}
 for(const s of segments){root(sk(s));if(s.sourceSceneId)union(sk(s),'caption:'+s.sourceSceneId);}
 const chosen=clips.find(c=>c.id===selection.clipId),caption=segments.find(s=>s.id===selection.captionId);
 if(!chosen&&!caption)return unchanged;
 const anchor=root(chosen?ck(chosen):sk(caption!));
 const anchorClips=clips.filter(c=>root(ck(c))===anchor),anchorCaptions=segments.filter(s=>root(sk(s))===anchor);
 const end=Math.max(...anchorClips.map(c=>c.start+Math.max(.1,c.outPoint-c.inPoint)),...anchorCaptions.map(s=>s.end));
 const lane=(c:C)=>c.type==='video'?'video:'+c.layer:'audio:'+(c.audioRole||c.layer);
 const next=chosen?clips.filter(c=>root(ck(c))!==anchor&&lane(c)===lane(chosen)&&c.start>=chosen.start).sort((a,b)=>a.start-b.start)[0]:segments.filter(s=>root(sk(s))!==anchor&&s.role===caption!.role&&(s.lane||0)===(caption!.lane||0)&&s.start>=caption!.start).sort((a,b)=>a.start-b.start)[0];
 if(!next)return unchanged;
 const boundary=next.start;
 if(boundary<=end+.00001)return unchanged;
 const moving=new Set<string>();
 for(const c of clips)if(c.start>=boundary-.00001&&root(ck(c))!==anchor)moving.add(root(ck(c)));
 for(const s of segments)if(s.start>=boundary-.00001&&root(sk(s))!==anchor)moving.add(root(sk(s)));
 // A linked narration can start a little before its image; keep that offset and stay after the anchor.
 const earliest=Math.min(...clips.filter(c=>moving.has(root(ck(c)))).map(c=>c.start),...segments.filter(s=>moving.has(root(sk(s)))).map(s=>s.start));
 const gap=Math.min(boundary-end,earliest-end);
 if(!Number.isFinite(gap)||gap<=.00001)return unchanged;
 return {gap,clips:clips.map(c=>moving.has(root(ck(c)))?{...c,start:c.start-gap}:c),segments:segments.map(s=>moving.has(root(sk(s)))?shiftSegment(s,-gap):s),overlays:overlays.map(o=>o.start>=boundary-.00001?{...o,start:o.start-gap,end:o.end-gap}:o)};
}
