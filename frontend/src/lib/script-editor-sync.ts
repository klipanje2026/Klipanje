import type {Script,Interval} from './production';
import type {VideoCaptions} from './video-captions';
export function editorIntervals(data:Record<string,unknown>,script:Script):Interval[]{
 const doc=(data.captions as Record<string,VideoCaptions>|undefined)?.__script;
 if(!doc)return script.segments;
 return doc.segments.filter(s=>s.role!=='title').sort((a,b)=>a.start-b.start).map(s=>({id:s.id,text:s.text,start:s.start,end:s.end,prompt:script.segments.find(old=>old.id===s.id)?.prompt}));
}
