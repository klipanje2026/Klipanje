import {portraits} from '../config/portraits';
import type {DecodedFrame} from './frame-source';
const cached=new Map<number,Promise<DecodedFrame|undefined>>();
/** The existing gallery portrait supplies the same glass/refraction input as video. */
export function studioCardSource(index:number){
 if(!cached.has(index))cached.set(index,new Promise(resolve=>{
  const portrait=portraits[((index%portraits.length)+portraits.length)%portraits.length],image=new Image();
  image.onload=()=>{
   const canvas=document.createElement('canvas'),w=180,h=320;canvas.width=w;canvas.height=h;
   const ctx=canvas.getContext('2d')!,pw=portrait.panel===null?image.naturalWidth:image.naturalWidth/3,ph=image.naturalHeight,scale=Math.max(w/pw,h/ph),cw=w/scale,ch=h/scale;
   ctx.drawImage(image,(portrait.panel??0)*pw+(pw-cw)/2,(ph-ch)/2,cw,ch,0,0,w,h);
   resolve(Object.assign(canvas,{videoWidth:w,videoHeight:h,currentTime:0,currentSrc:portrait.src,readyState:4}));
  };image.onerror=()=>resolve(undefined);image.src=portrait.src;
 }));return cached.get(index)!;
}
