import type {Segment} from '../config/captions/presets';
type LinkedMedia={type:string;segmentIds?:string[];narrationSegmentIds?:string[]};
/** Adjust an internal caption boundary without moving its shared media or the outer span. */
export function trimSharedCaption(segments:Segment[],clips:LinkedMedia[],id:string,edge:'start'|'end',value:number):Segment[]|null{
 const item=segments.find(s=>s.id===id);if(!item||!Number.isFinite(value))return null;
 const covers=(s:Segment,ids:string[])=>ids.includes(s.id)||!!s.sourceSceneId&&ids.includes(s.sourceSceneId);
 const groups=clips.map(c=>c.narrationSegmentIds||c.segmentIds||[]).filter(ids=>covers(item,ids));
 const group=groups.map(ids=>segments.filter(s=>covers(s,ids)&&s.role===item.role&&(s.lane||0)===(item.lane||0)).sort((a,b)=>a.start-b.start)).sort((a,b)=>b.length-a.length)[0];
 if(!group||group.length<2)return null;
 const index=group.findIndex(s=>s.id===id),other=group[index+(edge==='end'?1:-1)];if(!other)return null;
 const left=edge==='end'?item:other,right=edge==='end'?other:item;
 const boundary=Math.max(left.start+.1,Math.min(right.end-.1,value));
 const resize=(s:Segment,start:number,end:number)=>({...s,start,end,words:s.words?.map(w=>({...w,start:start+(w.start-s.start)*(end-start)/Math.max(.001,s.end-s.start),end:start+(w.end-s.start)*(end-start)/Math.max(.001,s.end-s.start)}))});
 return segments.map(s=>s.id===left.id?resize(s,s.start,boundary):s.id===right.id?resize(s,boundary,s.end):s);
}
