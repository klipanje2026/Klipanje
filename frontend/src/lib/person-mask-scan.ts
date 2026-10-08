import type {FrameSource} from './frame-source';
/** A sub-pixel feather in mask space removes stair steps without blurring the video. */
export function softenPersonMask(mask:HTMLCanvasElement){
 const copy=document.createElement('canvas');copy.width=mask.width;copy.height=mask.height;copy.getContext('2d')!.drawImage(mask,0,0);
 const ctx=mask.getContext('2d')!;ctx.clearRect(0,0,mask.width,mask.height);ctx.save();ctx.filter='blur(0.55px)';ctx.drawImage(copy,0,0);ctx.restore();
}
type Sample={alpha:Uint8Array;width:number;height:number;person:boolean};
type Scan={samples:Map<number,Sample>;bytes:number;status:string;cancel:()=>void;users:number};
const scans=new Map<string,Scan>();
const limit=64*1024*1024;
let used=0;
const decoded=new WeakMap<FrameSource,{key:string;canvas:HTMLCanvasElement}>();
export function preparedPersonMask(video:FrameSource){
 const frame=Math.round(video.currentTime*30),scan=scans.get(video.currentSrc),sample=scan?.samples.get(frame);
 if(!sample)return undefined;
 const key=`${video.currentSrc}:${frame}`,cached=decoded.get(video);if(cached?.key===key)return cached.canvas;
 const canvas=document.createElement('canvas');canvas.width=sample.width;canvas.height=sample.height;canvas.dataset.person=String(sample.person);
 const ctx=canvas.getContext('2d')!,pixels=ctx.createImageData(sample.width,sample.height);
 for(let i=0;i<sample.alpha.length;i++)pixels.data[i*4+3]=sample.alpha[i];
 ctx.putImageData(pixels,0,0);softenPersonMask(canvas);decoded.set(video,{key,canvas});return canvas;
}
function mediaEvent(video:HTMLVideoElement,event:string,signal:AbortSignal){
 return new Promise<void>((resolve,reject)=>{
  const finish=(error?:Error)=>{clearTimeout(timer);video.removeEventListener(event,ready);video.removeEventListener('error',failed);signal.removeEventListener('abort',aborted);if(error)reject(error);else resolve();};
  const ready=()=>finish(),failed=()=>finish(new Error('Video nije dostupan za skeniranje.')),aborted=()=>finish(new DOMException('Prekinuto','AbortError'));
  const timer=setTimeout(failed,15000);video.addEventListener(event,ready,{once:true});video.addEventListener('error',failed,{once:true});signal.addEventListener('abort',aborted,{once:true});if(signal.aborted)aborted();
 });
}
/** One separate decoder per active source; never seek or pause the user's player. */
export function scanPersonMasks(source:HTMLVideoElement,onStatus:(value:string)=>void){
 const url=source.currentSrc;if(!url||!Number.isFinite(source.duration)||source.duration<=0)return ()=>{};
 let scan=scans.get(url);
 if(!scan){
  // Reclaim completed sources no longer attached to an editor before allocating another video.
  for(const [key,old] of scans){if(!old.users){old.cancel();used-=old.bytes;scans.delete(key);}}
  const controller=new AbortController(),worker=new Worker('/person-mask-worker.js');
  const video=document.createElement('video');video.crossOrigin='anonymous';video.muted=true;video.preload='auto';
  scan={samples:new Map(),bytes:0,status:'Pripremam maske u pozadini…',users:0,cancel:()=>{controller.abort();worker.terminate();video.removeAttribute('src');video.load();}};
  const state=scan;scans.set(url,state);
  void(async()=>{
   try{
    const loaded=mediaEvent(video,'loadeddata',controller.signal);video.src=url;await loaded;
    const frames=Math.ceil(video.duration*30);
    for(let frame=0;frame<frames;frame++){
     controller.signal.throwIfAborted();
     if(used>=limit){state.status='Pripremljen dio maski · ostatak se računa pri prikazu';break;}
     controller.signal.throwIfAborted();
     const time=Math.min(video.duration-.001,frame/30);
     if(Math.abs(video.currentTime-time)>.0001){const sought=mediaEvent(video,'seeked',controller.signal);video.currentTime=time;await sought;}
     const bitmap=await createImageBitmap(video,{resizeWidth:Math.max(1,Math.round(512*video.videoWidth/Math.max(video.videoWidth,video.videoHeight))),resizeHeight:Math.max(1,Math.round(512*video.videoHeight/Math.max(video.videoWidth,video.videoHeight)))});
     if(controller.signal.aborted){bitmap.close();controller.signal.throwIfAborted();}
     const sample=await new Promise<Sample>((resolve,reject)=>{
      const abort=()=>{clearTimeout(timer);reject(new DOMException('Prekinuto','AbortError'));};
      const timer=setTimeout(()=>{controller.signal.removeEventListener('abort',abort);reject(new Error('Skeniranje je isteklo.'));},30000);
      controller.signal.addEventListener('abort',abort,{once:true});
      worker.onmessage=e=>{clearTimeout(timer);controller.signal.removeEventListener('abort',abort);if(e.data.error)reject(new Error(e.data.error));else resolve(e.data);};
      worker.onerror=()=>{clearTimeout(timer);controller.signal.removeEventListener('abort',abort);reject(new Error('Pozadinska obrada nije dostupna.'));};
      worker.postMessage({bitmap,base:location.origin},[bitmap]);
     });
     controller.signal.throwIfAborted();
     if(used+sample.alpha.byteLength>limit){state.status='Pripremljen dio maski · ostatak se računa pri prikazu';break;}
     state.samples.set(frame,sample);state.bytes+=sample.alpha.byteLength;used+=sample.alpha.byteLength;
     state.status=frame===frames-1?'Maske su pripremljene':`Priprema maski · ${Math.round((frame+1)/frames*100)}%`;
     await new Promise(r=>setTimeout(r,25));
    }
   }catch{if(!controller.signal.aborted)state.status='Maske se računaju pri prikazu';}
   finally{worker.terminate();video.removeAttribute('src');video.load();}
  })();
 }
 scan.users++;
 const state=scan;onStatus(state.status);const timer=setInterval(()=>onStatus(state.status),700);
 // Keep the scan and its samples across seeks, pauses and editor remounts.
 return ()=>{clearInterval(timer);state.users=Math.max(0,state.users-1);};
}
