import type { Segment } from '../config/captions/presets';

const shift = (segment: Segment, delta: number): Segment => ({ ...segment, start: segment.start + delta, end: segment.end + delta, words: segment.words?.map(word => ({ ...word, start: word.start + delta, end: word.end + delta })) });

export function moveCaption(segments: Segment[], id: string, start: number, duration: number): Segment[] {
  const index = segments.findIndex(segment => segment.id === id);
  if(index < 0 || !Number.isFinite(start)) return segments;
  const segment = segments[index], length = segment.end - segment.start;
  // A whole scene can move to any free gap, including past another scene.
  // Its independently positioned words remain part of this same segment.
  if(segment.role==='title')return dragCaption(segments,id,start,duration);
  const occupied = segments.filter(item => item.id !== id && item.role!=='title' && (item.lane||0)===(segment.lane||0)).sort((a,b) => a.start-b.start);
  const candidates: number[] = [];
  let cursor = 0;
  for (const item of [...occupied, { start: duration, end: duration }]) {
    if (item.start-cursor >= length-.000001) candidates.push(Math.max(cursor,Math.min(item.start-length,start)));
    cursor = Math.max(cursor,item.end);
  }
  if (!candidates.length) return segments;
  const next = candidates.reduce((best,value) => Math.abs(value-start)<Math.abs(best-start) ? value : best);
  return segments.map(item => item.id === id ? shift(item,next-segment.start) : item);
}

export function reorderCaptions(segments: Segment[], source: string, target: string): Segment[] {
  const from=segments.findIndex(segment=>segment.id===source), to=segments.findIndex(segment=>segment.id===target);
  if(from<0 || to<0 || from===to) return segments;
  const ordered=[...segments]; const [item]=ordered.splice(from,1); ordered.splice(to,0,item);
  let cursor=segments[0]?.start ?? 0;
  return ordered.map(segment=>{const next=shift(segment,cursor-segment.start);cursor=next.end;return next;});
}

/** Resize one caption, preserving gaps by shifting all following captions. */
export function resizeCaptionRipple(segments: Segment[], id: string, end: number, duration: number): Segment[] {
  const index = segments.findIndex(segment => segment.id === id);
  if (index < 0 || !Number.isFinite(end)) return segments;
  const selected = segments[index];
  const lastEnd = Math.max(...segments.slice(index).map(segment => segment.end));
  const delta = Math.max(selected.start + .1 - selected.end, Math.min(Math.max(0, duration - lastEnd), end - selected.end));
  const scale = (selected.end + delta - selected.start) / Math.max(.001, selected.end - selected.start);
  return segments.map((segment, i) => i < index ? segment : i === index ? {
    ...segment, end: segment.end + delta,
    words: segment.words?.map(word => ({ ...word, start: selected.start + (word.start - selected.start) * scale, end: selected.start + (word.end - selected.start) * scale })),
  } : { ...segment, start: segment.start + delta, end: segment.end + delta,
    words: segment.words?.map(word => ({ ...word, start: word.start + delta, end: word.end + delta })),
  });
}

export function trimCaption(segments: Segment[], id: string, edge: 'start' | 'end', value: number, duration: number): Segment[] {
  if (!Number.isFinite(value)) return segments;
  return segments.map(segment => {
    if(segment.id!==id) return segment;
    const others=segment.role==='title'?[]:segments.filter(item=>item.id!==id&&item.role!=='title'&&(item.lane||0)===(segment.lane||0));
    const lower=Math.max(0,...others.filter(item=>item.start<segment.start).map(item=>item.end));
    const upper=Math.min(duration,...others.filter(item=>item.end>segment.end).map(item=>item.start));
    const start=edge==='start'?Math.max(lower,Math.min(segment.end-.1,value)):segment.start;
    const end=edge==='end'?Math.min(upper,Math.max(start+.1,value)):segment.end;
    const scale=(end-start)/Math.max(.001,segment.end-segment.start);
    return {...segment,start,end,words:segment.words?.map(word=>({...word,start:start+(word.start-segment.start)*scale,end:start+(word.end-segment.start)*scale}))};
  });
}

/** Move only the selected caption to the pointer time, without snapping to gaps. */
export function dragCaption(segments:Segment[],id:string,start:number,duration:number):Segment[] {
 const item=segments.find(s=>s.id===id);if(!item||!Number.isFinite(start))return segments;
 const target=Math.max(0,Math.min(duration-(item.end-item.start),Math.round(start*10)/10));
 return segments.map(s=>s.id===id?shift(s,target-s.start):s);
}

/** Translate the whole subtitle track equally, preserving words, titles and animation timing. */
export function shiftAllCaptions(segments:Segment[],seconds:number,duration:number):{segments:Segment[];applied:number}{
 if(!segments.length||!Number.isFinite(seconds)||!Number.isFinite(duration)||duration<=0)return {segments,applied:0};
 const first=segments.reduce((a,s)=>Math.min(a,s.start,...(s.words||[]).map(w=>w.start)),Infinity);
 const last=segments.reduce((a,s)=>Math.max(a,s.end,...(s.words||[]).map(w=>w.end)),-Infinity);
 const applied=Math.max(Math.min(0,-first),Math.min(Math.max(0,duration-last),seconds));
 if(Math.abs(applied)<.000001)return {segments,applied:0};
 const at=(time:number)=>Math.round((time+applied)*1000000)/1000000;
 return {applied,segments:segments.map(s=>({...s,start:at(s.start),end:at(s.end),
  words:s.words?.map(w=>({...w,start:at(w.start),end:at(w.end)})),
  frameAnimationStart:s.frameAnimationStart===undefined?undefined:at(s.frameAnimationStart),
  frameAnimationEnd:s.frameAnimationEnd===undefined?undefined:at(s.frameAnimationEnd),
 }))};
}

export function splitCaptionAt(segments:Segment[],id:string,time:number):Segment[]{
 const item=segments.find(s=>s.id===id);if(!item||time<=item.start+.01||time>=item.end-.01)return segments;
 const tokens=item.text.trim().split(/\s+/);if(tokens.length<2)return segments;
 const words=item.words?.length===tokens.length?item.words:tokens.map((text,i)=>({text,start:item.start+(item.end-item.start)*i/tokens.length,end:item.start+(item.end-item.start)*(i+1)/tokens.length}));
 const count=words.filter(w=>w.start<time).length;
 if(count===0||count===tokens.length)return segments;
 const rightId=crypto.randomUUID();
 const part=(from:number,to:number,start:number,end:number,partId:string):Segment=>{
  const remap=<T,>(map:Record<number,T>|undefined)=>map?Object.fromEntries(Object.entries(map).filter(([key])=>Number(key)>=from&&Number(key)<to).map(([key,value])=>[Number(key)-from,value])):undefined;
  const index=(value:number|null|undefined)=>value!=null&&value>=from&&value<to?value-from:null;
  return {...item,id:partId,start,end,text:tokens.slice(from,to).join(' '),words:words.slice(from,to).map(w=>({...w,start:Math.max(start,w.start),end:Math.min(end,Math.max(start,w.end))})),wordStyles:remap(item.wordStyles),wordOffsets:remap(item.wordOffsets),keywordWord:index(item.keywordWord),headingWord:index(item.headingWord),hiddenTitleWords:item.hiddenTitleWords?.filter(i=>i>=from&&i<to).map(i=>i-from),frameAnimationStart:item.frameAnimationStart===undefined?undefined:Math.max(start,item.frameAnimationStart),frameAnimationEnd:item.frameAnimationEnd===undefined?undefined:Math.min(end,item.frameAnimationEnd)};
 };
 return segments.flatMap(s=>s.id===id?[part(0,count,item.start,time,id),part(count,tokens.length,time,item.end,rightId)]:s.sourceCaptionId===id&&s.sourceWord!==undefined&&s.sourceWord>=count?[{...s,sourceCaptionId:rightId,sourceWord:s.sourceWord-count}]:[s]);
}

/** Join adjacent captions on the same lane; the first caption owns the resulting style. */
export function nextCaptionToMerge(segments:Segment[],id:string):Segment|undefined {
 const first=segments.find(s=>s.id===id);if(!first)return;
 return segments.filter(s=>s.id!==id&&s.role===first.role&&(s.lane||0)===(first.lane||0)&&s.start>=first.end-.001).sort((a,b)=>a.start-b.start)[0];
}
export function mergeCaptionWithNext(segments:Segment[],id:string):Segment[] {
 const first=segments.find(s=>s.id===id),next=nextCaptionToMerge(segments,id);if(!first||!next)return segments;
 const tokens=(s:Segment)=>s.text.trim().split(/\s+/).filter(Boolean),offset=tokens(first).length;
 const words=(s:Segment)=>s.words?.length===tokens(s).length?s.words:tokens(s).map((text,i,all)=>({text,start:s.start+(s.end-s.start)*i/all.length,end:s.start+(s.end-s.start)*(i+1)/all.length}));
 const combine=<T,>(a:Record<number,T>|undefined,b:Record<number,T>|undefined)=>({...a,...Object.fromEntries(Object.entries(b||{}).map(([k,v])=>[Number(k)+offset,v]))});
 const merged:Segment={...first,end:next.end,text:[first.text.trim(),next.text.trim()].filter(Boolean).join(' '),words:[...words(first),...words(next)],wordStyles:combine(first.wordStyles,next.wordStyles),wordOffsets:combine(first.wordOffsets,next.wordOffsets),hiddenTitleWords:[...(first.hiddenTitleWords||[]),...(next.hiddenTitleWords||[]).map(i=>i+offset)],keywordWord:first.keywordWord??(next.keywordWord==null?null:next.keywordWord+offset),headingWord:first.headingWord??(next.headingWord==null?null:next.headingWord+offset),frameAnimationEnd:next.frameAnimationEnd??first.frameAnimationEnd};
 return segments.filter(s=>s.id!==next.id).map(s=>s.id===id?merged:s.sourceCaptionId===next.id?{...s,sourceCaptionId:id,sourceWord:s.sourceWord===undefined?undefined:s.sourceWord+offset}:s);
}
