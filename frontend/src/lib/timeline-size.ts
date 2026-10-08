export function timelineMaximum(availableHeight:number):number {
 return Math.max(64,Math.floor(Math.min(availableHeight*.55,availableHeight-240)));
}
export function clampTimelineHeight(height:number,minimum:number,maximum:number):number {
 return Math.max(Math.min(minimum,maximum),Math.min(maximum,Number.isFinite(height)?height:minimum));
}
