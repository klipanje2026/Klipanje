import {drawStillScene,type StillClip} from './still-scenes';
import {drawVideoBackground} from './video-background';
import type {FrameSource} from './frame-source';

export type VideoSceneClip=StillClip&{background?:string};
export function needsVideoScene(clip:VideoSceneClip){
 return !!(clip.sunlight||(clip.filter?.id==='blink'||clip.filter?.id==='snap-awake'||clip.filter?.id==='dizzy')||(clip.motion&&clip.motion!=='none')||(clip.imageTransition&&clip.imageTransition!=='cut')||(clip.imageExit&&clip.imageExit!=='cut'));
}
const noImages=new Map<string,HTMLImageElement>();
/** Video supplies a decoded frame to exactly the same animation renderer as photos. */
export function drawVideoScene(ctx:CanvasRenderingContext2D,frame:FrameSource,clip:VideoSceneClip,elapsed:number,length:number,aspect:number,sourceTime=frame.currentTime){
 const inPoint=sourceTime-elapsed;
 const timed={...clip,inPoint,outPoint:inPoint+length};
 drawStillScene(ctx,noImages,timed,clip.start+elapsed,aspect,undefined,{
  aspect:frame.videoWidth/frame.videoHeight,
  paint:(context,x,y,w,h)=>drawVideoBackground(context,frame,clip.background||'none',x,y,w,h),
 });
}
