import type {Segment} from '../config/captions/presets';
import {shiftSegment} from './local-timeline';
type Clip={id:string;type:string;layer:number;audioRole?:string;allowOverlap?:boolean;start:number;inPoint:number;outPoint:number;groupId?:string;captionId?:string;segmentIds?:string[];narrationSegmentIds?:string[]};
type Overlay={id:string;kind:string;start:number;end:number;allowOverlap?:boolean};
export function adjustTimelineGap<C extends Clip,O extends Overlay>(clips:C[],segments:Segment[],overlays:O[],selection:{clipId?:string;captionId?:string;overlayId?:string},action:'add'|'step'|'close',scope:'lane'|'all'='lane'){
 const rows=[...clips.map(c=>({key:'c:'+c.id,lane:c.type==='video'?'v:'+c.layer:'a:'+(c.audioRole||c.layer),start:c.start,end:c.start+c.outPoint-c.inPoint,exempt:!!c.allowOverlap,links:[...(c.groupId?['g:'+c.groupId]:[]),...(c.segmentIds||[]).map(id=>'s:'+id),...(c.narrationSegmentIds||[]).map(id=>'s:'+id),...(c.captionId?['s:'+c.captionId]:[])]})),...segments.map(s=>({key:'s:'+s.id,lane:'s:'+(s.role||'')+':'+(s.lane||0),start:s.start,end:s.end,exempt:false,links:s.sourceSceneId?['s:'+s.sourceSceneId]:[]})),...overlays.map(o=>({key:'o:'+o.id,lane:['lightning','sunlight'].includes(o.kind)?'effects':['sleep','clock'].includes(o.kind)?'animations':'decorations',start:o.start,end:o.end,exempt:!!o.allowOverlap,links:[]}))];
 const unchanged={clips,segments,overlays,delta:0};
 const chosen=rows.find(r=>r.key===(selection.clipId?'c:'+selection.clipId:selection.captionId?'s:'+selection.captionId:'o:'+selection.overlayId));if(!chosen)return unchanged;
 const parents=new Map<string,string>();const root=(id:string):string=>{const p=parents.get(id);if(!p){parents.set(id,id);return id;}if(p===id)return id;const r=root(p);parents.set(id,r);return r;};
 if(scope==='all')for(const r of rows.filter(r=>!r.exempt))for(const link of r.links)parents.set(root(r.key),root(link));
 const anchor=rows.filter(r=>root(r.key)===root(chosen.key)),end=Math.max(...anchor.map(r=>r.end));
 const next=rows.filter(r=>!r.exempt&&r.lane===chosen.lane&&root(r.key)!==root(chosen.key)&&r.start>=chosen.start-.00001).sort((a,b)=>a.start-b.start)[0];if(!next)return unchanged;
 const moving=new Set(rows.filter(r=>!r.exempt&&r.start>=next.start-.00001&&root(r.key)!==root(chosen.key)&&(scope==='all'||r.lane===chosen.lane)).map(r=>root(r.key)));
 const affected=rows.filter(r=>!r.exempt&&moving.has(root(r.key)));const available=Math.max(0,Math.min(next.start-end,Math.min(...affected.map(r=>r.start))-end));
 const delta=action==='add'?.1:action==='step'?-Math.min(.1,available):-available;if(Math.abs(delta)<.00001)return unchanged;
 const selected=new Set(affected.map(r=>r.key));const at=(n:number)=>Math.round((n+delta)*1e9)/1e9;
 return {delta,clips:clips.map(c=>selected.has('c:'+c.id)?{...c,start:at(c.start)}:c),segments:segments.map(s=>selected.has('s:'+s.id)?shiftSegment(s,delta):s),overlays:overlays.map(o=>selected.has('o:'+o.id)?{...o,start:at(o.start),end:at(o.end)}:o)};
}
