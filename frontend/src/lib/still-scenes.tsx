import {drawComposition,type ImageComposition} from './image-composition';
import {useEffect,useRef} from 'react';
import {videoRect,type VideoTransform} from './video-layout';
import {drawSceneEffects,type SceneEffects} from './scene-effects';
export type StillTransition='cut'|'crossfade'|'fade'|'slide'|'slide-left'|'slide-right'|'slide-up'|'slide-down';
export type StillMotion={composition?:ImageComposition;motion?:'none'|'zoom-in'|'zoom-out'|'pan'|'shake'|'surprise';surpriseStrength?:number;surpriseDuration?:number;shakeStrength?:number;imageTransition?:StillTransition;imageTransitionDuration?:number;imageExit?:StillTransition;imageExitDuration?:number;imageAnimationsLinked?:boolean};
/** One cartoon reaction: fast push-in, a short recoil, then settle. */
export function surpriseMotion(elapsed:number,length:number,strength=.6,duration=.6){
 const amount=Number.isFinite(strength)?Math.max(0,Math.min(1,strength)):.6;
 const seconds=Math.min(Math.max(.01,length),Number.isFinite(duration)?Math.max(.2,Math.min(2,duration)):.6);
 const p=Math.max(0,Math.min(1,elapsed/seconds));
 if(p<=0||p>=1)return {scale:1,x:0,y:0};
 const attack=.18;
 const zoom=p<attack?1-Math.pow(1-p/attack,3):Math.pow(1-(p-attack)/(1-attack),2);
 const recoil=p<attack?0:Math.sin((p-attack)*Math.PI*8)*Math.pow(1-p,3);
 return {scale:1+.32*amount*zoom,x:.5*amount*recoil,y:-.25*amount*recoil};
}
export type StillClip=VideoTransform&StillMotion&SceneEffects&{assetId:string;start:number;inPoint:number;outPoint:number;layer:number};
export function drawStillScene(ctx:CanvasRenderingContext2D,images:Map<string,HTMLImageElement>,clip:StillClip,time:number,aspect:number,previous?:StillClip){
 if(clip.composition){ctx.save();ctx.translate(ctx.canvas.width*(clip.x??50)/100,ctx.canvas.height*(clip.y??50)/100);ctx.scale(clip.scale||1,clip.scale||1);ctx.translate(-ctx.canvas.width/2,-ctx.canvas.height/2);drawComposition(ctx,images,clip.composition,clip.inPoint+time-clip.start);ctx.restore();return;}
 const width=ctx.canvas.width,height=ctx.canvas.height,length=clip.outPoint-clip.inPoint,elapsed=time-clip.start,p=Math.max(0,Math.min(1,elapsed/Math.min(length/2,clip.imageTransitionDuration||.5)));
 function draw(c:StillClip,t:number,alpha=1,slide=0,slideY=0){const image=images.get(c.assetId);if(!image)return;const fraction=Math.max(0,Math.min(1,(t-c.start)/(c.outPoint-c.inPoint)));let scale=c.scale||1,x=c.x??50,y=c.y??50;if(c.motion==='zoom-in')scale*=1+.15*fraction;if(c.motion==='zoom-out')scale=1+(Math.max(1.15,scale)-1)*(1-fraction);if(c.motion==='pan'){scale*=1.12;x+=(fraction-.5)*10;}if(c.motion==='shake'){const strength=typeof c.shakeStrength==='number'&&Number.isFinite(c.shakeStrength)?Math.max(0,Math.min(1,c.shakeStrength)):.25;scale*=1+.06*strength;x+=Math.sin(t*33)*.8*strength;y+=Math.sin(t*41)*.7*strength;}if(c.motion==='surprise'){const reaction=surpriseMotion(t-c.start,c.outPoint-c.inPoint,c.surpriseStrength,c.surpriseDuration);scale*=reaction.scale;x+=reaction.x;y+=reaction.y;}const sourceAspect=image.naturalWidth/image.naturalHeight;const cover=Math.max(sourceAspect/aspect,aspect/sourceAspect);const rect=videoRect(sourceAspect,aspect,{...c,x,y,scale});rect.width*=cover;rect.height*=cover;rect.x=x-rect.width/2;rect.y=y-rect.height/2;ctx.save();ctx.globalAlpha*=alpha;const paint=()=>ctx.drawImage(image,(rect.x/100+slide)*width,(rect.y/100+slideY)*height,rect.width/100*width,rect.height/100*height);if(c.filter||c.transition)drawSceneEffects(ctx,c,c.inPoint+t-c.start,t-c.start,c.outPoint-c.inPoint,rect.x/100*width,rect.y/100*height,rect.width/100*width,rect.height/100*height,paint);else paint();ctx.restore();}
 const exit=clip.imageExit||'cut',remaining=Math.max(0,clip.start+length-time),out=exit==='cut'?1:Math.max(0,Math.min(1,remaining/Math.max(.01,Math.min(length/2,clip.imageExitDuration||.5))));
 ctx.save();
 if(out<1){const slide=exit.startsWith('slide');ctx.globalAlpha*=slide?1:out;ctx.translate((exit==='slide-left'?-(1-out):['slide','slide-right'].includes(exit)?1-out:0)*width,(exit==='slide-up'?-(1-out):exit==='slide-down'?1-out:0)*height);}
 if(p<1&&clip.imageTransition&&clip.imageTransition!=='cut'){
  const slide=clip.imageTransition.startsWith('slide');
  if(previous&&(clip.imageTransition==='crossfade'||slide))draw(previous,previous.start+previous.outPoint-previous.inPoint);
  const x=clip.imageTransition==='slide-left'?p-1:['slide','slide-right'].includes(clip.imageTransition)?1-p:0;
  const y=clip.imageTransition==='slide-up'?1-p:clip.imageTransition==='slide-down'?p-1:0;
  draw(clip,time,slide?1:p,x,y);
 }else draw(clip,time);
 ctx.restore();
}
export function StillSceneLayer({images,clip,time,aspect,previous,onPointerDown,onPointerMove,onPointerUp}:{images:Map<string,HTMLImageElement>;clip:StillClip;time:number;aspect:number;previous?:StillClip;onPointerDown?:React.PointerEventHandler<HTMLCanvasElement>;onPointerMove?:React.PointerEventHandler<HTMLCanvasElement>;onPointerUp?:React.PointerEventHandler<HTMLCanvasElement>}){const ref=useRef<HTMLCanvasElement>(null);useEffect(()=>{const canvas=ref.current,ctx=canvas?.getContext('2d');if(!canvas||!ctx)return;ctx.clearRect(0,0,canvas.width,canvas.height);drawStillScene(ctx,images,clip,time,aspect,previous);},[images,clip,time,aspect,previous]);return <canvas ref={ref} width={Math.round(960*aspect)} height={960} className="local-still-scene" style={{zIndex:clip.layer}} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}/>;}
