import {usePersonMaskScan} from '../lib/use-person-mask-scan';
import {useEffect,useRef,useState,type RefObject,type CSSProperties} from 'react';
import {preparePersonMask} from '../lib/person-mask';
import {drawVideoBackground} from '../lib/video-background';
export function VideoBackgroundLayer({id,background,mediaRefs,style}:{id:string;background:string;mediaRefs:RefObject<Map<string,HTMLMediaElement>>;style:CSSProperties}){
 const scanStatus=usePersonMaskScan(background!=='none',undefined,mediaRefs);
 const ref=useRef<HTMLCanvasElement>(null),[error,setError]=useState('');
 useEffect(()=>{let cancelled=false,frame=0;void preparePersonMask().then(()=>{if(cancelled)return;const draw=()=>{const video=mediaRefs.current.get(id) as HTMLVideoElement|undefined,canvas=ref.current;if(video&&canvas&&video.readyState>=2){const width=Math.min(1920,video.videoWidth),height=Math.round(width*video.videoHeight/video.videoWidth);if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}const ctx=canvas.getContext('2d')!;ctx.clearRect(0,0,width,height);try{drawVideoBackground(ctx,video,background,0,0,width,height);}catch{setError('Pozadina nije obrađena. Vrati originalnu pozadinu i pokušaj ponovo.');return;}}frame=requestAnimationFrame(draw);};draw();}).catch(()=>{if(!cancelled)setError('Pozadina nije obrađena. Pokušaj ponovo.');});return()=>{cancelled=true;cancelAnimationFrame(frame);};},[id,background,mediaRefs]);
 return <><canvas aria-label="Video bez originalne pozadine" ref={ref} style={{...style,position:'absolute',pointerEvents:'none'}}/>{scanStatus&&<small role="status">{scanStatus}</small>}{error&&<p role="alert">{error}</p>}</>;
}
