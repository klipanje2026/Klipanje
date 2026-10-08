import type {CaptionSettings} from '../config/captions/types';
const clamp=(n:number)=>Math.max(0,Math.min(1,n));

export function drawScriptStroke(ctx:CanvasRenderingContext2D,total:number,size:number,age:number,settings:CaptionSettings){
 ctx.save();
  ctx.shadowColor=settings.highlightColor;ctx.shadowBlur=size*.2;ctx.strokeStyle=settings.highlightColor;ctx.lineWidth=Math.max(1,size*.025);ctx.lineCap='round';
  // Sample both Bezier arcs, then reveal by travelled path length, including the return stroke.
  const width=total*(settings.scriptWidth??110)/100;
  const arcs=settings.scriptLineMode==='right'?[[-width*.05,size*.67,width*.48,size*.52,width*.48,size*.95,width*.28,size*.89]]:[[-width*.45,size*.67,width*.6,size*.45,width*.65,size*.93,-width*.1,size*.98],[-width*.1,size*.98,-width*.65,size*1.05,-width*.6,size*1.35,width*.12,size*1.55]];
  const points:{x:number;y:number;length:number}[]=[];let length=0;
  for(const arc of arcs)for(let j=0;j<=64;j++){const q=j/64,r=1-q,px=r*r*r*arc[0]+3*r*r*q*arc[2]+3*r*q*q*arc[4]+q*q*q*arc[6],py=r*r*r*arc[1]+3*r*r*q*arc[3]+3*r*q*q*arc[5]+q*q*q*arc[7];const prev=points.at(-1);if(prev)length+=Math.hypot(px-prev.x,py-prev.y);points.push({x:px,y:py,length});}
  const limit=length*clamp(age/Math.max(.1,settings.scriptDrawDuration??.65));ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);
  for(let j=1;j<points.length;j++){const prev=points[j-1],point=points[j];if(point.length>limit){const q=(limit-prev.length)/Math.max(.001,point.length-prev.length);ctx.lineTo(prev.x+(point.x-prev.x)*q,prev.y+(point.y-prev.y)*q);break;}ctx.lineTo(point.x,point.y);}ctx.stroke();

 ctx.restore();
}
