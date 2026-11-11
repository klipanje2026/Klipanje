import {preparePersonMask} from '../lib/person-mask';
import {usePersonMaskScan} from '../lib/use-person-mask-scan';
import {useEffect,useRef,type RefObject,type CSSProperties} from 'react';
import {drawVideoScene,type VideoSceneClip} from '../lib/video-scene';

export function VideoSceneLayer({previewHeight=720,id,mediaRefs,options,sourceTime,elapsed,length,background,aspect,style}:{previewHeight?:number;id:string;mediaRefs:RefObject<Map<string,HTMLMediaElement>>;options:VideoSceneClip;sourceTime:number;elapsed:number;length:number;background:string;aspect:number;style:CSSProperties}){
 usePersonMaskScan(background!=='none',undefined,mediaRefs);
 const ref=useRef<HTMLCanvasElement>(null),lastPaint=useRef(0);
 useEffect(()=>{
  let frame=0,lastTime=-1,cancelled=false;
  const draw=()=>{
   const video=mediaRefs.current.get(id) as HTMLVideoElement|undefined,canvas=ref.current;
   if(video&&canvas&&video.readyState>=2&&video.videoWidth&&video.currentTime!==lastTime&&(previewHeight>360||video.paused||performance.now()-lastPaint.current>=1000/24)){
    lastPaint.current=performance.now();
    lastTime=video.currentTime;
    const height=previewHeight,width=Math.max(1,Math.round(height*aspect));
    if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
    const ctx=canvas.getContext('2d');
    if(ctx){ctx.clearRect(0,0,width,height);drawVideoScene(ctx,video,{...options,background},elapsed,length,aspect,sourceTime);}
   }
   frame=requestAnimationFrame(draw);
  };
  if(background==='none')draw();else void preparePersonMask().then(()=>{if(!cancelled)draw();});
  return()=>{cancelled=true;cancelAnimationFrame(frame);};
 },[id,mediaRefs,options,sourceTime,elapsed,length,background,aspect,previewHeight]);
 return <canvas ref={ref} aria-label="Video s efektima kadra" style={{...style,position:'absolute',pointerEvents:'none'}}/>;
}
