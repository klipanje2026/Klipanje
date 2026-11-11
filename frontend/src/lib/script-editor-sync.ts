import type {Script,Interval} from './production';
import type {VideoCaptions} from './video-captions';
export function editorIntervals(data:Record<string,unknown>,script:Script):Interval[]{
 const doc=(data.captions as Record<string,VideoCaptions>|undefined)?.__script;
 if(!doc)return script.segments;
 return doc.segments.filter(s=>s.role!=='title').sort((a,b)=>a.start-b.start).map(s=>({id:s.id,text:s.text,start:s.start,end:s.end,prompt:script.segments.find(old=>old.id===s.id)?.prompt}));
}

/** Script intervals stay ordered; authored timeline overlaps remain in storyboard.data. */
export function sourceIntervals(intervals:Interval[],previous:Interval[]):Interval[]{
 const unchangedIds=intervals.length===previous.length&&intervals.every((s,i)=>s.id===previous[i]?.id);
 if(unchangedIds)return intervals.map((s,i)=>({...s,start:previous[i].start,end:previous[i].end}));
 let cursor=0;
 return intervals.map(s=>{const start=Math.max(cursor,s.start),end=start+Math.max(.1,s.end-s.start);cursor=end;return {...s,start,end};});
}
