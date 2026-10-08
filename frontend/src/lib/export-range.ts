type TimedClip={start:number;inPoint:number;outPoint:number};
/** Remove only the empty lead-in; preserve gaps and relative timing inside the edit. */
export function exportRange(clips:TimedClip[],duration:number) {
 const starts=clips.filter(c=>Number.isFinite(c.start)&&c.outPoint>c.inPoint).map(c=>c.start);
 const start=starts.length?Math.max(0,Math.min(...starts)):0;
 return {start:Math.min(start,duration),duration:Math.max(0,duration-start)};
}
