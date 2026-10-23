export type HeartExit={imageExit?:string;imageExitDuration?:number;heartX?:number;heartY?:number;start:number;inPoint:number;outPoint:number};
export function heartExitState(clip:HeartExit,time:number){
 const length=clip.outPoint-clip.inPoint,duration=Math.min(length,Math.max(.1,clip.imageExitDuration??1.5));
 const progress=Math.max(0,Math.min(1,(time-(clip.start+length-duration))/duration));
 return {progress,x:Math.max(0,Math.min(100,clip.heartX??50))/100,y:Math.max(0,Math.min(100,clip.heartY??50))/100};
}
/** Opaque black outside a shrinking heart; identical in preview and export. */
export function drawHeartExit(ctx:CanvasRenderingContext2D,clip:HeartExit,time:number){
 if(clip.imageExit!=='heart')return;
 const {progress,x,y}=heartExitState(clip,time);if(progress<=0)return;
 const w=ctx.canvas.width,h=ctx.canvas.height,cx=x*w,cy=y*h;
 const radius=5*Math.hypot(w,h)*(1-progress)**3;
 ctx.save();ctx.filter='none';ctx.fillStyle='#000';ctx.beginPath();ctx.rect(0,0,w,h);
 if(radius>.001){
  const point=(a:number,b:number)=>[cx+a*radius,cy+b*radius] as const;
  ctx.moveTo(...point(0,-.25));
  ctx.bezierCurveTo(...point(-.3,-.65),...point(-.8,-.3),...point(-.5,.05));
  ctx.bezierCurveTo(...point(-.35,.25),...point(-.1,.45),...point(0,.6));
  ctx.bezierCurveTo(...point(.1,.45),...point(.35,.25),...point(.5,.05));
  ctx.bezierCurveTo(...point(.8,-.3),...point(.3,-.65),...point(0,-.25));ctx.closePath();
 }
 ctx.fill('evenodd');ctx.restore();
}
