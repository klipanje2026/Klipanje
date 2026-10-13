import type {Segment,CaptionSettings} from '../config/captions/presets';
// Parts are a visual layout of one timed caption, never extra timeline clips.
export function splitVisualPart(segment:Segment,afterWord:number):Segment {
 const length=segment.text.trim().split(/\s+/).length;
 if(afterWord<=0||afterWord>=length)return segment;
 const parts=segment.visualParts?.length?segment.visualParts:[{id:crypto.randomUUID(),from:0,to:length,position:segment.position||{x:25,y:75}}];
 return {...segment,visualParts:parts.flatMap(p=>afterWord>p.from&&afterWord<p.to?[{...p,to:afterWord},{...p,id:crypto.randomUUID(),from:afterWord,position:segment.visualParts?.length?{x:p.position?.x??75,y:Math.max(5,(p.position?.y??75)-15)}:{x:75,y:p.position?.y??75}}]:[p])};
}
/** Word-relative boundaries also support a fraction inside a word (legacy integer ranges still work). */
export function visualBoundaryAtCursor(text:string,cursor:number):number {
 const tokens=[...text.matchAll(/\S+/gu)];
 for(let i=0;i<tokens.length;i++){
  const token=tokens[i],start=token.index!;
  if(cursor<=start)return i;
  if(cursor<start+token[0].length){let offset=cursor-start;
   // Never cut a UTF-16 surrogate pair in half.
   if(offset>0&&/[\uD800-\uDBFF]/.test(token[0][offset-1])&&/[\uDC00-\uDFFF]/.test(token[0][offset]))offset++;
   return i+offset/token[0].length;
  }
 }
 return tokens.length;
}
export function toggleVisualPartAtCursor(segment:Segment,cursor:number):Segment {
 const boundary=visualBoundaryAtCursor(segment.text,cursor),parts=segment.visualParts;
 const index=parts?.findIndex((p,i)=>i<parts.length-1&&Math.abs(p.to-boundary)<1e-8)??-1;
 if(parts&&index>=0){const joined=[...parts.slice(0,index),{...parts[index],to:parts[index+1].to},...parts.slice(index+2)];return {...segment,visualParts:joined.length>1?joined:undefined};}
 return splitVisualPart(segment,boundary);
}
export function expandVisualParts(segment:Segment):Segment[]{
 const tokens=segment.text.trim().split(/\s+/);
 if(!segment.visualParts?.length)return [segment];
 const timing=segment.words?.length===tokens.length?segment.words:tokens.map((text,i)=>({text,start:segment.start+(segment.end-segment.start)*i/tokens.length,end:segment.start+(segment.end-segment.start)*(i+1)/tokens.length}));
 return segment.visualParts.filter(p=>p.from<tokens.length&&p.to>p.from).map(p=>{
  const words=tokens.flatMap((text,i)=>{const from=Math.max(0,p.from-i),to=Math.min(1,p.to-i);if(to<=from)return [];
   const piece=text.slice(Math.round(from*text.length),Math.round(to*text.length));if(!piece)return [];
   const word=timing[i];return [{text:piece,start:word.start+(word.end-word.start)*from,end:word.start+(word.end-word.start)*to}];});
  return {...segment,visualParts:undefined,renderPartId:p.id,text:words.map(w=>w.text).join(' '),words,
   position:p.position||segment.position,separateStyle:p.detachedStyle?true:segment.separateStyle,detachedStyle:p.detachedStyle||segment.detachedStyle,wordOffsets:undefined,wordStyles:undefined};
 });
}
export function patchVisualPart(segment:Segment,id:string,settings:CaptionSettings,style:NonNullable<Segment['detachedStyle']>['style']):Segment {
 return {...segment,visualParts:segment.visualParts?.map(p=>p.id===id?{...p,position:{x:settings.x,y:settings.y},detachedStyle:{style,settings}}:p)};
}
