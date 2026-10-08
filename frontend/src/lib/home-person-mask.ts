import {portraits} from '../config/portraits';
import type {DecodedFrame} from './frame-source';
const frames=new Map<number,DecodedFrame>();
const masks=new Map<string,Promise<HTMLCanvasElement|false>>();
/** Match the three-column homepage photo crop; compute each static person mask only once. */
export function homePersonMask(index:number){
 let pending=masks.get(String(index));
 if(!pending){
  pending=(async()=>{
   const portrait=portraits[index%portraits.length];
   const photo=new Image();photo.src=portrait.src;await photo.decode();
   const frame=document.createElement('canvas') as DecodedFrame;frame.width=600;frame.height=1067;
   const scale=portrait.panel===null?Math.max(600/photo.naturalWidth,1067/photo.naturalHeight):1800/photo.naturalWidth;
   const width=photo.naturalWidth*scale,height=photo.naturalHeight*scale;
   frame.getContext('2d')!.drawImage(photo,portrait.panel===null?(600-width)/2:-portrait.panel*600,(1067-height)/2,width,height);
   Object.assign(frame,{videoWidth:600,videoHeight:1067,currentTime:0,currentSrc:`home-${index}`,readyState:2});
   frames.set(index,frame);
   const {preparePersonMask,personMask}=await import('./person-mask');await preparePersonMask();
   return personMask(frame);
  })();
  masks.set(String(index),pending);
  void pending.catch(()=>masks.delete(String(index)));
 }
 return pending;
}

export async function homePersonFrame(index:number){await homePersonMask(index);return frames.get(index);}
