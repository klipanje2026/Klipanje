export type VideoTransform = { x?: number; y?: number; scale?: number };
export function videoRect(sourceAspect: number, frameAspect: number, transform: VideoTransform) {
  const scale = Math.max(.1, Math.min(4, transform.scale ?? 1));
  const width = (sourceAspect > frameAspect ? 100 : sourceAspect / frameAspect * 100) * scale;
  const height = (sourceAspect > frameAspect ? frameAspect / sourceAspect * 100 : 100) * scale;
  return { x: (transform.x ?? 50) - width / 2, y: (transform.y ?? 50) - height / 2, width, height };
}
export function rulerTicks(duration: number, width: number,range?:{start:number;end:number}) {
  const step = [ .1,.2,.5,1,2,5,10,15,30,60,120,300,600,1800,3600 ].find(value => value * width / duration >= 75) ?? Math.ceil(duration / 10);
  const first=range?Math.max(0,Math.floor(range.start/step)):0,last=Math.floor(Math.min(duration,range?.end??duration)/step);
  return Array.from({length: Math.max(0,Math.min(1000,last-first+1))}, (_,i) => ({time:Math.min(duration,(first+i)*step),percent:Math.min(duration,(first+i)*step)/duration*100}));
}
export function anchorZoom(scroll: number, pointer: number, oldZoom: number, newZoom: number) {
  return Math.max(0, (scroll + pointer) * newZoom / oldZoom - pointer);
}

export function clampPlayhead(time: number, duration: number) {
  return Math.max(0, Math.min(Number.isFinite(duration) ? Math.max(0,duration) : 0, Number.isFinite(time) ? time : 0));
}
export function advancePlayhead(time: number, previous: number, now: number, duration: number, repeat: boolean) {
  const next=clampPlayhead(time,duration)+Math.max(0,now-previous)/1000;
  return repeat && duration>0 ? next%duration : clampPlayhead(next,duration);
}
export function clipAtPlayhead(clip: {start:number;inPoint:number;outPoint:number}, time:number, duration:number) {
  const visible=Math.min(clampPlayhead(time,duration),Math.max(0,duration-.001));
  return visible>=clip.start && visible<clip.start+clip.outPoint-clip.inPoint;
}
