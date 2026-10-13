import type {Segment,CaptionSettings} from '../config/captions/presets';
// Parts are a visual layout of one timed caption, never extra timeline clips.
export function splitVisualPart(segment:Segment,afterWord:number):Segment {
 const length=segment.text.trim().split(/\s+/).length;
 if(afterWord<=0||afterWord>=length)return segment;
 const parts=segment.visualParts?.length?segment.visualParts:[{id:crypto.randomUUID(),from:0,to:length,position:segment.position||{x:25,y:75}}];
 return {...segment,visualParts:parts.flatMap(p=>afterWord>p.from&&afterWord<p.to?[{...p,to:afterWord},{...p,id:crypto.randomUUID(),from:afterWord,position:segment.visualParts?.length?{x:p.position?.x??75,y:Math.max(5,(p.position?.y??75)-15)}:{x:75,y:p.position?.y??75}}]:[p])};
}
export function expandVisualParts(segment:Segment):Segment[]{
 const tokens=segment.text.trim().split(/\s+/);
 if(!segment.visualParts?.length)return [segment];
 return segment.visualParts.filter(p=>p.from<tokens.length&&p.to>p.from).map(p=>({...segment,visualParts:undefined,renderPartId:p.id,
  text:tokens.slice(p.from,p.to).join(' '),words:(segment.words||tokens.map((text,i)=>({text,start:segment.start+(segment.end-segment.start)*i/tokens.length,end:segment.start+(segment.end-segment.start)*(i+1)/tokens.length}))).slice(p.from,p.to),
  position:p.position||segment.position,separateStyle:p.detachedStyle?true:segment.separateStyle,detachedStyle:p.detachedStyle||segment.detachedStyle,wordOffsets:undefined,wordStyles:undefined}));
}
export function patchVisualPart(segment:Segment,id:string,settings:CaptionSettings,style:NonNullable<Segment['detachedStyle']>['style']):Segment {
 return {...segment,visualParts:segment.visualParts?.map(p=>p.id===id?{...p,position:{x:settings.x,y:settings.y},detachedStyle:{style,settings}}:p)};
}
