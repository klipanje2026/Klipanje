export type ImageComposition={items:{assetId:string;at:number}[];layout:'grid'|'strips'|'overlap';gap:number;border:number;borderStyle:'solid'|'dashed'|'double';color:string;animation:'fade'|'slide'|'none'};
export function compositionBoxes(count:number,layout:ImageComposition['layout']){
 return Array.from({length:count},(_,i)=>layout==='overlap'?{x:6+i*9,y:5+i*10,w:65,h:62}:layout==='strips'?{x:i*100/count,y:0,w:100/count,h:100}:count===2?{x:i*50,y:0,w:50,h:100}:{x:(i%2)*50,y:Math.floor(i/2)*50,w:50,h:50});
}
export function drawComposition(ctx:CanvasRenderingContext2D,images:Map<string,HTMLImageElement>,value:ImageComposition,elapsed:number){
 const W=ctx.canvas.width,H=ctx.canvas.height,unit=Math.min(W,H)/100,boxes=compositionBoxes(value.items.length,value.layout);
 value.items.forEach((item,i)=>{
  const image=images.get(item.assetId);if(!image||elapsed<item.at)return;
  const p=Math.min(1,(elapsed-item.at)/.4),box=boxes[i],gap=value.gap*unit;
  const x=box.x/100*W+gap/2,y=box.y/100*H+gap/2,w=Math.max(1,box.w/100*W-gap),h=Math.max(1,box.h/100*H-gap);
  ctx.save();if(value.animation==='fade')ctx.globalAlpha*=p;
  if(value.animation==='slide')ctx.translate(0,(1-p)*h*.25);
  ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();
  const scale=Math.max(w/image.naturalWidth,h/image.naturalHeight);
  ctx.drawImage(image,x+(w-image.naturalWidth*scale)/2,y+(h-image.naturalHeight*scale)/2,image.naturalWidth*scale,image.naturalHeight*scale);
  if(value.border>0){const b=value.border*unit;ctx.strokeStyle=value.color;ctx.lineWidth=b;ctx.setLineDash(value.borderStyle==='dashed'?[b*3,b*2]:[]);ctx.strokeRect(x+b/2,y+b/2,w-b,h-b);if(value.borderStyle==='double'){ctx.lineWidth=b/3;ctx.strokeRect(x+b*1.7,y+b*1.7,Math.max(0,w-b*3.4),Math.max(0,h-b*3.4));}}
  ctx.restore();
 });
}
