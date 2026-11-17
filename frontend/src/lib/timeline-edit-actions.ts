import type {Segment} from '../config/captions/presets';
import {splitCaptionAt} from './caption-timing';
import {shiftSegment} from './local-timeline';

type Clip={layer?:number;audioRole?:string;allowOverlap?:boolean;id:string;assetId:string;type:string;start:number;inPoint:number;outPoint:number;groupId?:string;timelineGroupId?:string;captionId?:string;segmentIds?:string[];narrationSegmentIds?:string[];preserveLinkedTiming?:boolean;linksDetached?:boolean};
const refs=(c:Clip)=>[...c.segmentIds||[],...c.narrationSegmentIds||[],...c.captionId?[c.captionId]:[]];
export function groupTimelineSelection<T extends Clip>(clips:T[],segments:Segment[],clipIds:string[],captionIds:string[],imageAssets:Set<string>,groupId:string){
 const media=clips.filter(c=>clipIds.includes(c.id)),text=segments.filter(s=>captionIds.includes(s.id));
 if(media.length+text.length<2)return {clips,segments};
 const start=Math.min(...media.map(c=>c.start),...text.map(s=>s.start));
 const end=Math.max(...media.map(c=>c.start+c.outPoint-c.inPoint),...text.map(s=>s.end));
 const images=media.filter(c=>imageAssets.has(c.assetId));
 return {clips:clips.map(c=>clipIds.includes(c.id)?{...c,timelineGroupId:groupId,groupId:undefined,captionId:undefined,segmentIds:undefined,narrationSegmentIds:undefined,linksDetached:true,preserveLinkedTiming:true,...images.length===1&&images[0].id===c.id?{start,outPoint:c.inPoint+end-start}:{}}:{...c,captionId:captionIds.includes(c.captionId||'')?undefined:c.captionId,segmentIds:c.segmentIds?.filter(id=>!captionIds.includes(id)),narrationSegmentIds:c.narrationSegmentIds?.filter(id=>!captionIds.includes(id))}),
 segments:segments.map(s=>!captionIds.includes(s.id)?s:{...s,timelineGroupId:groupId,independentTiming:true,...text.length===1?{start,end,words:s.words?.map(w=>({...w,start:start+(w.start-s.start)*(end-start)/Math.max(.001,s.end-s.start),end:start+(w.end-s.start)*(end-start)/Math.max(.001,s.end-s.start)}))}:{}})};
}
export function dissolveTimelineGroup<T extends Clip>(clips:T[],segments:Segment[],groupId?:string){
 return {clips:clips.map(c=>c.timelineGroupId&&(!groupId||c.timelineGroupId===groupId)?{...c,timelineGroupId:undefined}:c),segments:segments.map(s=>s.timelineGroupId&&(!groupId||s.timelineGroupId===groupId)?{...s,timelineGroupId:undefined}:s)};
}
/** Move a group as one unit. Lane ripple concerns only followers on the grabbed lane. */
export function moveTimelineGroup<T extends Clip>(clips:T[],segments:Segment[],groupId:string,delta:number,options:{ripple?:boolean;noOverlap?:boolean;gap?:number;scope?:'lane'|'all';clipId?:string;captionId?:string}={}){
 const lane=(c:Clip)=>c.type==='video'?'video:'+(c.layer||0):'audio:'+(c.audioRole||c.layer||0);
 const nodes=[...clips.map(c=>({id:c.id,key:c.timelineGroupId||'clip:'+c.id,lane:lane(c),start:c.start,end:c.start+c.outPoint-c.inPoint,exempt:!!c.allowOverlap})),...segments.map(s=>({id:s.id,key:s.timelineGroupId||'caption:'+s.id,lane:'caption:'+(s.lane||0),start:s.start,end:s.end,exempt:false}))];
 const members=nodes.filter(n=>n.key===groupId);if(!members.length||!Number.isFinite(delta))return {clips,segments,delta:0};
 const grabbed=nodes.find(n=>n.id===(options.clipId||options.captionId))||members[0];
 const offsets=new Map<string,number>();
 let d=Math.max(-Math.min(...members.map(n=>n.start)),delta);
 if(options.noOverlap)for(const n of members.filter(n=>!n.exempt))for(const previous of nodes.filter(p=>p.key!==groupId&&!p.exempt&&p.lane===n.lane&&p.start<n.start))d=Math.max(d,previous.end+(n.lane.startsWith('video:')?(options.gap||0):0)-n.start);
 offsets.set(groupId,d);
 if(options.ripple&&!grabbed.exempt)for(const n of nodes)if(n.key!==groupId&&!n.exempt&&n.start>grabbed.start+.00001&&(options.scope==='all'||n.lane===grabbed.lane))offsets.set(n.key,Math.max(d,-Math.min(...nodes.filter(m=>m.key===n.key).map(m=>m.start))));
 if(options.noOverlap){
  // Original lane order prevents a forward drag jumping behind its followers.
  // Repeat propagation for groups which span several lanes; internal offsets stay intact.
  for(let pass=0;pass<nodes.length;pass++){let changed=false;
   for(const key of new Set(nodes.filter(n=>!n.exempt).map(n=>n.lane))){const ordered=nodes.filter(n=>!n.exempt&&n.lane===key).sort((a,b)=>a.start-b.start);
    for(let j=0;j<ordered.length;j++)for(let i=0;i<j;i++){const left=ordered[i],right=ordered[j];if(left.key===right.key||!offsets.has(left.key)&&!offsets.has(right.key))continue;
     const needed=left.end+(offsets.get(left.key)||0)+(key.startsWith('video:')?(options.gap||0):0)-right.start;
     if(needed>(offsets.get(right.key)||0)+.00001){offsets.set(right.key,needed);changed=true;}
    }
   }if(!changed)break;if(pass===nodes.length-1)return {clips,segments,delta:0,conflict:true};
  }
 }
 return {clips:clips.map(c=>{const offset=offsets.get(c.timelineGroupId||'clip:'+c.id)||0;return offset?{...c,start:c.start+offset}:c;}),segments:segments.map(s=>{const offset=offsets.get(s.timelineGroupId||'caption:'+s.id)||0;return offset?shiftSegment(s,offset):s;}),delta:offsets.get(groupId)||0};
}
/** Detach one element only: keep all unrelated connections and all positions. */
export function detachTimelineElement<T extends Clip>(clips:T[],segments:Segment[],clipId?:string,captionId?:string){
 return {clips:clips.map(c=>c.id===clipId?{...c,timelineGroupId:undefined,groupId:undefined,captionId:undefined,segmentIds:undefined,narrationSegmentIds:undefined,linksDetached:true,preserveLinkedTiming:true}:captionId?{...c,captionId:c.captionId===captionId?undefined:c.captionId,segmentIds:c.segmentIds?.filter(id=>id!==captionId),narrationSegmentIds:c.narrationSegmentIds?.filter(id=>id!==captionId)}:c),segments:segments.map(s=>s.id===captionId?{...s,timelineGroupId:undefined,independentTiming:true}:s)};
}
/** One transaction, each source cut at its own offset; never apply another clip's source time. */
export function splitTimelineAt<T extends Clip>(clips:T[],segments:Segment[],time:number,newId=()=>crypto.randomUUID()){
 let captions=segments;
 const origins=new Map(segments.map(s=>[s.id,s.id]));
 for(const s of segments)if(s.start+.01<time&&s.end-.01>time){
  const prior=captions;captions=splitCaptionAt(captions,s.id,time);
  if(captions===prior)captions=captions.flatMap(c=>c.id!==s.id?[c]:[{...c,end:time,words:c.words?.map(w=>({...w,end:Math.min(w.end,time)})).filter(w=>w.start<w.end)},{...c,id:newId(),sourceSceneId:c.sourceSceneId||c.id,start:time,words:c.words?.map(w=>({...w,start:Math.max(w.start,time)})).filter(w=>w.start<w.end)}]);
  for(const c of captions)if(!prior.some(p=>p.id===c.id))origins.set(c.id,s.id);
 }
 const rightIds=new Set(captions.filter(s=>!segments.some(old=>old.id===s.id)).map(s=>s.id));
 const crossed=clips.filter(c=>time>c.start+.099&&time<c.start+c.outPoint-c.inPoint-.099);
 const affectedGroups=new Set([...crossed.flatMap(c=>[c.groupId,c.timelineGroupId]),...segments.filter(s=>s.start<time&&s.end>time).map(s=>s.timelineGroupId)].filter(Boolean));
 const sideGroups=new Map<string,string>();
 const rightGroup=(id:string|undefined)=>{if(!id)return undefined;if(!affectedGroups.has(id))return id;if(!sideGroups.has(id))sideGroups.set(id,newId());return sideGroups.get(id);};
 const out=clips.flatMap(c=>{
  if(time<=c.start+.099||time>=c.start+c.outPoint-c.inPoint-.099){if(c.start>=time&&(affectedGroups.has(c.groupId)||affectedGroups.has(c.timelineGroupId)))return [{...c,groupId:rightGroup(c.groupId),timelineGroupId:rightGroup(c.timelineGroupId)}];return [c];}
  const at=c.inPoint+time-c.start;
  const keep=(s:Segment,right:boolean)=>refs(c).includes(origins.get(s.id)||s.id)?right?s.end>time:s.start<time:false;
  const links=(right:boolean)=>({captionId:undefined,segmentIds:c.segmentIds||c.captionId?captions.filter(s=>keep(s,right)).map(s=>s.id):undefined,narrationSegmentIds:c.narrationSegmentIds?captions.filter(s=>keep(s,right)).map(s=>s.id):undefined,preserveLinkedTiming:true});
  return [{...c,...links(false),outPoint:at},{...c,...links(true),id:newId(),start:time,inPoint:at,groupId:rightGroup(c.groupId),timelineGroupId:rightGroup(c.timelineGroupId)}];
 });
 return {clips:out,segments:captions.map(s=>(rightIds.has(s.id)||s.start>=time)&&s.timelineGroupId?{...s,timelineGroupId:rightGroup(s.timelineGroupId)}:s)};
}
