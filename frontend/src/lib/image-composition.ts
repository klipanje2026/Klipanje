export type ImageComposition={items:{assetId:string;at:number}[];layout:'grid'|'strips'|'overlap';gap:number;border:number;borderStyle:'solid'|'dashed'|'double'|'wood'|'paper';overlap?:number;color:string;animation:'fade'|'slide'|'none'};
export function compositionBoxes(count:number,layout:ImageComposition['layout'],overlap=6){
 const amount=Math.max(0,Math.min(20,overlap))/2;
 return Array.from({length:count},(_,i)=>{
  const box=layout==='strips'?{x:i*100/count,y:0,w:100/count,h:100}:count===2?{x:i*50,y:0,w:50,h:100}:count===3&&i===2?{x:0,y:50,w:100,h:50}:{x:(i%2)*50,y:Math.floor(i/2)*50,w:50,h:50};
  if(layout!=='overlap')return box;
  const left=Math.max(0,box.x-amount),top=Math.max(0,box.y-amount);
  return {x:left,y:top,w:Math.min(100,box.x+box.w+amount)-left,h:Math.min(100,box.y+box.h+amount)-top};
 });
}
function textureFrame(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,b:number,wood:boolean){
 ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.rect(x+b,y+b,Math.max(0,w-2*b),Math.max(0,h-2*b));ctx.clip('evenodd');
 const gradient=ctx.createLinearGradient(x,y,x+w,y+h);gradient.addColorStop(0,wood?'#b78048':'#eee3cc');gradient.addColorStop(.5,wood?'#684021':'#cabea4');gradient.addColorStop(1,wood?'#bb8851':'#f2e9d6');ctx.fillStyle=gradient;ctx.fillRect(x,y,w,h);
 ctx.lineWidth=Math.max(.5,b/15);ctx.strokeStyle=wood?'rgba(45,22,8,.3)':'rgba(100,85,65,.18)';
 for(let i=0;i<90;i++){const yy=y+i*h/90;ctx.beginPath();ctx.moveTo(x,yy);ctx.bezierCurveTo(x+w*.3,yy+Math.sin(i*2)*b,x+w*.7,yy-Math.cos(i)*b,x+w,yy);ctx.stroke();}
 if(wood){for(let i=0;i<70;i++){const xx=x+i*w/70;ctx.beginPath();ctx.moveTo(xx,y);ctx.bezierCurveTo(xx+b*Math.sin(i),y+h*.3,xx-b*Math.cos(i),y+h*.7,xx,y+h);ctx.stroke();}}
 ctx.restore();
}
export function drawComposition(ctx:CanvasRenderingContext2D,images:Map<string,HTMLImageElement>,value:ImageComposition,elapsed:number){
 const W=ctx.canvas.width,H=ctx.canvas.height,unit=Math.min(W,H)/100,boxes=compositionBoxes(value.items.length,value.layout,value.overlap);
 value.items.forEach((item,i)=>{
  const image=images.get(item.assetId);if(!image||elapsed<item.at)return;
  const p=Math.min(1,(elapsed-item.at)/.4),box=boxes[i],gap=value.layout==='overlap'?0:value.gap*unit;
  const x=box.x/100*W+gap/2,y=box.y/100*H+gap/2,w=Math.max(1,box.w/100*W-gap),h=Math.max(1,box.h/100*H-gap);
  ctx.save();if(value.animation==='fade')ctx.globalAlpha*=p;
  if(value.animation==='slide')ctx.translate(0,(1-p)*h*.25);
  ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();
  const scale=Math.max(w/image.naturalWidth,h/image.naturalHeight);
  ctx.drawImage(image,x+(w-image.naturalWidth*scale)/2,y+(h-image.naturalHeight*scale)/2,image.naturalWidth*scale,image.naturalHeight*scale);
  if(value.border>0&&(value.borderStyle==='wood'||value.borderStyle==='paper'))textureFrame(ctx,x,y,w,h,Math.min(value.border*unit,w/2,h/2),value.borderStyle==='wood');
  else if(value.border>0){const b=value.border*unit;ctx.strokeStyle=value.color;ctx.lineWidth=b;ctx.setLineDash(value.borderStyle==='dashed'?[b*3,b*2]:[]);ctx.strokeRect(x+b/2,y+b/2,w-b,h-b);if(value.borderStyle==='double'){ctx.lineWidth=b/3;ctx.strokeRect(x+b*1.7,y+b*1.7,Math.max(0,w-b*3.4),Math.max(0,h-b*3.4));}}
  ctx.restore();
 });
}
