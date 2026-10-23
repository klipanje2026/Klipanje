export type CropRect={x:number;y:number;width:number;height:number};
export type CropExport={crop:CropRect;start:number;end:number;speed:number;maxEdge:number;quality:number;format:'mp4'|'webm';mute:boolean};
export const fullCrop:CropRect={x:0,y:0,width:1,height:1};
export const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
export function aspectCrop(ratio:number,sourceRatio:number):CropRect{
 const width=Math.min(1,ratio/sourceRatio),height=Math.min(1,sourceRatio/ratio);
 return {x:(1-width)/2,y:(1-height)/2,width,height};
}
export function cropPixels(crop:CropRect,width:number,height:number,maxEdge:number){
 const x=clamp(Math.round(crop.x*width),0,width-2),y=clamp(Math.round(crop.y*height),0,height-2);
 const sw=clamp(Math.round(crop.width*width),2,width-x),sh=clamp(Math.round(crop.height*height),2,height-y);
 const scale=Math.min(1,maxEdge/Math.max(sw,sh));
 return {x,y,sw,sh,width:Math.max(2,Math.round(sw*scale/2)*2),height:Math.max(2,Math.round(sh*scale/2)*2)};
}
const cancelled=()=>new DOMException('Obrada je otkazana.','AbortError');
function mediaEvent(video:HTMLVideoElement,event:string,signal:AbortSignal,action:()=>void):Promise<void>{
 return new Promise((resolve,reject)=>{
  const cleanup=()=>{clearTimeout(timer);video.removeEventListener(event,ready);video.removeEventListener('error',error);signal.removeEventListener('abort',abort);};
  const ready=()=>{cleanup();resolve();},error=()=>{cleanup();reject(new Error('Video se ne može otvoriti. Pokušaj MP4 (H.264) ili WebM.'));},abort=()=>{cleanup();reject(cancelled());};
  const timer=setTimeout(()=>{cleanup();reject(new Error('Video nije odgovorio na vrijeme. Pokušaj drugi fajl.'));},20000);
  video.addEventListener(event,ready,{once:true});video.addEventListener('error',error,{once:true});signal.addEventListener('abort',abort,{once:true});
  if(signal.aborted){abort();return;}try{action();}catch(e){cleanup();reject(e);}
 });
}
async function seek(video:HTMLVideoElement,time:number,signal:AbortSignal){
 if(Math.abs(video.currentTime-time)<.001&&video.readyState>=2)return;
 await mediaEvent(video,'seeked',signal,()=>{video.currentTime=time;});
}
export async function cropThumbnails(url:string,signal:AbortSignal):Promise<string[]>{
 const video=document.createElement('video');video.muted=true;video.playsInline=true;
 try{
  await mediaEvent(video,'loadeddata',signal,()=>{video.src=url;video.load();});
  if(!Number.isFinite(video.duration)||video.duration<=0||video.duration>1800)return [];
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=72;const ctx=canvas.getContext('2d')!;const frames:string[]=[];
  for(let i=0;i<10;i++){await seek(video,Math.min(Math.max(0,video.duration-.05),video.duration*i/10),signal);if(signal.aborted)throw cancelled();ctx.fillStyle='#101418';ctx.fillRect(0,0,128,72);const scale=Math.max(128/video.videoWidth,72/video.videoHeight);ctx.drawImage(video,(128-video.videoWidth*scale)/2,(72-video.videoHeight*scale)/2,video.videoWidth*scale,video.videoHeight*scale);frames.push(canvas.toDataURL('image/jpeg',.55));}
  return frames;
 }finally{video.pause();video.removeAttribute('src');video.load();}
}

// Browser-only export: crop source pixels, trim source time, and record at playback speed.
// No project, upload, server conversion or provider call is involved.
export async function exportCroppedVideo(file:File,options:CropExport,signal:AbortSignal,progress:(value:number)=>void){
 if(file.size>500e6)throw new Error('Odaberi video do 500 MB.');
 if(typeof MediaRecorder==='undefined')throw new Error('Ovaj preglednik ne podržava izvoz videa. Pokušaj Chrome ili Edge.');
 if(signal.aborted)throw cancelled();
 if(!Object.values(options.crop).every(Number.isFinite)||![options.start,options.end,options.speed,options.maxEdge,options.quality].every(Number.isFinite)||options.speed<.1||options.speed>2||options.crop.x<0||options.crop.y<0||options.crop.width<=0||options.crop.height<=0||options.crop.x+options.crop.width>1.000001||options.crop.y+options.crop.height>1.000001)throw new Error('Postavke videa nisu ispravne.');
 const candidates=options.format==='mp4'?['video/mp4','video/mp4;codecs=avc1,mp4a.40.2']:['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'];
 const mime=candidates.find(value=>MediaRecorder.isTypeSupported(value));
 if(!mime)throw new Error(`Preglednik ne podržava ${options.format.toUpperCase()} izvoz. Odaberi drugi format.`);
 const url=URL.createObjectURL(file),video=document.createElement('video');video.playsInline=true;video.muted=true;
 let audio:AudioContext|undefined,stream:MediaStream|undefined,recorder:MediaRecorder|undefined,frame=0,timer:ReturnType<typeof setTimeout>|undefined,tick:ReturnType<typeof setInterval>|undefined;
 let cleanupEvents=()=>{};
 try{
  // Resume while the export click still carries user activation (not after media loading).
  if(!options.mute){
   audio=new AudioContext();const resumed=audio.resume();
   await new Promise<void>((resolve,reject)=>{
    const cleanup=()=>{clearTimeout(timeout);signal.removeEventListener('abort',abort);};
    const abort=()=>{cleanup();reject(cancelled());};
    const timeout=setTimeout(()=>{cleanup();reject(new Error('Preglednik nije pokrenuo zvuk. Pusti pregled videa pa ponovo pokreni izvoz.'));},10000);
    signal.addEventListener('abort',abort,{once:true});
    resumed.then(()=>{cleanup();resolve();},error=>{cleanup();reject(error);});
    if(signal.aborted)abort();
   });
  }
  await mediaEvent(video,'loadeddata',signal,()=>{video.src=url;video.load();});
  if(!Number.isFinite(video.duration)||video.duration<=0||video.duration>1800||video.videoWidth<2||video.videoHeight<2)throw new Error('Odaberi video do 30 minuta s ispravnim trajanjem.');
  const start=clamp(options.start,0,video.duration),end=clamp(options.end,start,video.duration);
  if(end-start<.1)throw new Error('Odaberi najmanje 0,1 sekundu videa.');
  const area=cropPixels(options.crop,video.videoWidth,video.videoHeight,clamp(options.maxEdge,240,3840));
  const canvas=document.createElement('canvas');canvas.width=area.width;canvas.height=area.height;const ctx=canvas.getContext('2d')!;
  video.playbackRate=options.speed;video.preservesPitch=true;await seek(video,start,signal);
  const draw=()=>ctx.drawImage(video,area.x,area.y,area.sw,area.sh,0,0,area.width,area.height);draw();
  stream=canvas.captureStream(30);
  if(audio){const source=audio.createMediaElementSource(video),destination=audio.createMediaStreamDestination();source.connect(destination);destination.stream.getAudioTracks().forEach(track=>stream!.addTrack(track));video.muted=false;}
  const bitrate=Math.round(clamp(area.width*area.height*30*.12*clamp(options.quality,.4,1),400000,18000000));
  recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:bitrate,audioBitsPerSecond:128000});
  const chunks:Blob[]=[];let bytes=0;
  const finished=new Promise<Blob>((resolve,reject)=>{
   let settled=false;
   const fail=(error:unknown)=>{if(!settled){settled=true;video.pause();reject(error);}};
   const abort=()=>fail(cancelled());
   const visibility=()=>{if(document.hidden)fail(new Error('Izvoz je prekinut jer je kartica skrivena. Ostavi je otvorenu i pokušaj ponovo.'));};
   signal.addEventListener('abort',abort,{once:true});document.addEventListener('visibilitychange',visibility);
   cleanupEvents=()=>{signal.removeEventListener('abort',abort);document.removeEventListener('visibilitychange',visibility);};
   recorder!.ondataavailable=e=>{if(settled)return;bytes+=e.data.size;if(bytes>500e6){fail(new Error('Izvoz prelazi 500 MB. Odaberi kraći dio ili nižu kvalitetu.'));return;}if(e.data.size)chunks.push(e.data);};
   recorder!.onerror=()=>fail(new Error('Izvoz nije uspio. Pokušaj drugi format ili nižu kvalitetu.'));
   recorder!.onstop=()=>{if(settled)return;settled=true;const blob=new Blob(chunks,{type:mime});if(!blob.size)reject(new Error('Izvoz je prazan. Pokušaj ponovo.'));else resolve(blob);};
   video.onerror=()=>fail(new Error('Video nije moguće pročitati do kraja.'));
   const finish=()=>{video.pause();if(recorder?.state==='recording')recorder.stop();};
   video.onended=finish;
   const update=()=>{if(settled)return;if(video.currentTime>=end){finish();return;}draw();progress(clamp((video.currentTime-start)/(end-start)*100,0,99));};
   const animate=()=>{update();if(!settled&&!video.paused)frame=requestAnimationFrame(animate);};
   tick=setInterval(update,20);
   timer=setTimeout(()=>fail(new Error('Izvoz je trajao predugo. Pokušaj kraći video.')),(end-start)/options.speed*2000+30000);
   if(signal.aborted){abort();return;}if(document.hidden){visibility();return;}
   recorder!.start(500);
   void video.play().then(()=>{if(!settled)frame=requestAnimationFrame(animate);}).catch(fail);
  });
  const blob=await finished;progress(100);return {blob,extension:options.format,width:area.width,height:area.height};
 }finally{
  cleanupEvents();clearTimeout(timer);clearInterval(tick);cancelAnimationFrame(frame);video.pause();
  if(recorder?.state==='recording')recorder.stop();stream?.getTracks().forEach(track=>track.stop());
  if(audio)await audio.close().catch(()=>undefined);video.removeAttribute('src');video.load();URL.revokeObjectURL(url);
 }
}
