import type {Script,Interval} from './production';
import type {VideoCaptions} from './video-captions';
import {clipsFollowCaptions} from './local-timeline';
export function editorIntervals(data:Record<string,unknown>,script:Script):Interval[]{
 const doc=(data.captions as Record<string,VideoCaptions>|undefined)?.__script;
 if(!doc)return script.segments;
 return doc.segments.filter(s=>s.role!=='title').map(s=>({id:s.id,text:s.text,start:s.start,end:s.end,prompt:script.segments.find(old=>old.id===s.id)?.prompt}));
}
export function reconcileScriptEditor(data:Record<string,unknown>,script:Script):Record<string,unknown>{
 const docs=data.captions as Record<string,VideoCaptions>|undefined,doc=docs?.__script;if(!doc)return data;
 const segments=script.segments.map(s=>{
  const old=doc.segments.find(c=>c.id===s.id),same=old?.text===s.text;
  const duration=Math.max(.01,(old?.end||0)-(old?.start||0));
  return {...old,...s,sourceSceneId:s.id,words:same?old?.words?.map(w=>({...w,start:s.start+(w.start-old.start)/duration*(s.end-s.start),end:s.start+(w.end-old.start)/duration*(s.end-s.start)})):undefined,visualParts:same?old?.visualParts:undefined};
 });
 const titles=doc.segments.filter(s=>s.role==='title');
 return {...data,captions:{...docs,__script:{...doc,segments:[...segments,...titles]}},clips:clipsFollowCaptions((data.clips||[]) as Parameters<typeof clipsFollowCaptions>[0],doc.segments,segments)};
}
