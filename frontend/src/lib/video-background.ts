import type {FrameSource} from './frame-source';
import {personMask} from './person-mask';
export const backgrounds=[{id:'none',name:'Original',colors:[]},{id:'transparent',name:'Bez pozadine',colors:[]},{id:'white',name:'Bijeli studio',colors:['#f8fafc','#dce4ee']},{id:'ocean',name:'Okean',colors:['#12364c','#307e99']},{id:'sunset',name:'Zalazak',colors:['#e8a77c','#885286']},{id:'graphite',name:'Grafit',colors:['#15171c','#373c49']}] as const;
const surfaces=new WeakMap<FrameSource,HTMLCanvasElement>();
export function drawVideoBackground(context:CanvasRenderingContext2D,video:FrameSource,background:string,x:number,y:number,width:number,height:number) {
 const preset=backgrounds.find(item=>item.id===background);
 if(!preset||preset.id==='none'){context.drawImage(video,x,y,width,height);return;}
 const mask=personMask(video);if(!mask)return;
 let surface=surfaces.get(video);if(!surface){surface=document.createElement('canvas');surfaces.set(video,surface);}
 const w=Math.max(1,Math.round(Math.abs(width))),h=Math.max(1,Math.round(Math.abs(height)));
 if(surface.width!==w||surface.height!==h){surface.width=w;surface.height=h;}
 const ctx=surface.getContext('2d')!;ctx.clearRect(0,0,w,h);ctx.drawImage(video,0,0,w,h);
 ctx.globalCompositeOperation='destination-in';ctx.drawImage(mask,0,0,w,h);ctx.globalCompositeOperation='source-over';
 context.save();if(preset.colors.length){const gradient=context.createLinearGradient(x,y,x+width,y+height);preset.colors.forEach((color,index)=>gradient.addColorStop(index/(preset.colors.length-1),color));context.fillStyle=gradient;context.fillRect(x,y,width,height);}context.drawImage(surface,x,y,width,height);context.restore();
}
