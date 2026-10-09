import {useEffect,useRef} from 'react';
import {videoRect,type VideoTransform} from './video-layout';
import {drawSceneEffects,type SceneEffects} from './scene-effects';
export type StillMotion={motion?:'none'|'zoom-in'|'zoom-out'|'pan'|'shake';imageTransition?:'cut'|'crossfade'|'fade'|'slide'|'slide-left'|'slide-right'|'slide-up'|'slide-down';imageTransitionDuration?:number};
export type StillClip=VideoTransform&StillMotion&SceneEffects&{assetId:string;start:number;inPoint:number;outPoint:number;layer:number};
export function drawStillScene(ctx:CanvasRenderingContext2D,images:Map<string,HTMLImageElement>,clip:StillClip,time:number,aspect:number,previous?:StillClip){
 const width=ctx.canvas.width,height=ctx.canvas.height,length=clip.outPoint-clip.inPoint,elapsed=time-clip.start,p=Math.max(0,Math.min(1,elapsed/Math.min(length/2,clip.imageTransitionDuration||.5)));
 function draw(c:StillClip,t:number,alpha=1,slide=0,slideY=0){const image=images.get(c.assetId);if(!image)return;const fraction=Math.max(0,Math.min(1,(t-c.start)/(c.outPoint-c.inPoint)));let scale=c.scale||1,x=c.x??50,y=c.y??50;if(c.motion==='zoom-in')scale*=1+.15*fraction;if(c.motion==='zoom-out')scale*=1.15-.15*fraction;if(c.motion==='pan'){scale*=1.12;x+=(fraction-.5)*10;}if(c.motion==='shake'){scale*=1.06;x+=Math.sin(t*33)*.8;y+=Math.sin(t*41)*.7;}const rect=videoRect(image.naturalWidth/image.naturalHeight,aspect,{...c,x,y,scale});ctx.save();ctx.globalAlpha=alpha;const paint=()=>ctx.drawImage(image,(rect.x/100+slide)*width,(rect.y/100+slideY)*height,rect.width/100*width,rect.height/100*height);if(c.filter||c.transition)drawSceneEffects(ctx,c,c.inPoint+t-c.start,t-c.start,c.outPoint-c.inPoint,rect.x/100*width,rect.y/100*height,rect.width/100*width,rect.height/100*height,paint);else paint();ctx.restore();}
 if(p<1&&clip.imageTransition&&clip.imageTransition!=='cut'){
  const slide=clip.imageTransition.startsWith('slide');
  if(previous&&(clip.imageTransition==='crossfade'||slide))draw(previous,previous.start+previous.outPoint-previous.inPoint);
  const x=clip.imageTransition==='slide-left'?p-1:['slide','slide-right'].includes(clip.imageTransition)?1-p:0;
  const y=clip.imageTransition==='slide-up'?1-p:clip.imageTransition==='slide-down'?p-1:0;
  draw(clip,time,slide?1:p,x,y);
 }else draw(clip,time);
}
export function StillSceneLayer({images,clip,time,aspect,previous,onPointerDown,onPointerMove,onPointerUp}:{images:Map<string,HTMLImageElement>;clip:StillClip;time:number;aspect:number;previous?:StillClip;onPointerDown?:React.PointerEventHandler<HTMLCanvasElement>;onPointerMove?:React.PointerEventHandler<HTMLCanvasElement>;onPointerUp?:React.PointerEventHandler<HTMLCanvasElement>}){const ref=useRef<HTMLCanvasElement>(null);useEffect(()=>{const canvas=ref.current,ctx=canvas?.getContext('2d');if(!canvas||!ctx)return;ctx.clearRect(0,0,canvas.width,canvas.height);drawStillScene(ctx,images,clip,time,aspect,previous);},[images,clip,time,aspect,previous]);return <canvas ref={ref} width={Math.round(960*aspect)} height={960} className="local-still-scene" style={{zIndex:clip.layer}} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}/>;}
