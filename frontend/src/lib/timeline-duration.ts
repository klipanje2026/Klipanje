export function localTimelineDuration(clipEnds:number[],captionEnds:number[],overlayEnds:number[],requested:number){
 const content=Math.max(0,...clipEnds,...captionEnds,...overlayEnds);
 const duration=Number.isFinite(requested)&&requested>0?requested:Math.max(.1,content);
 return {minimum:content,duration:content||requested?duration:10};
}
export function timelineClock(seconds:number){
 const ticks=Math.round(Math.max(0,Number.isFinite(seconds)?seconds:0)*10);
 const hours=Math.floor(ticks/36000),minutes=Math.floor(ticks/600)%60,secs=Math.floor(ticks/10)%60;
 return `${hours?String(hours).padStart(2,'0')+':':''}${String(minutes).padStart(2,'0')}:${String(secs).padStart(2,'0')}.${ticks%10}`;
}

export function extendTimelineRequest(previousEnd:number,nextEnd:number,requested:number){return requested>0&&nextEnd>previousEnd+.0001?Math.max(requested,nextEnd):requested;}
export function timelineZoomMaximum(duration:number,width:number){return Math.max(800,Math.ceil(duration*120/Math.max(1,width)*100));}
