import {exportRange} from './export-range';
import {collectTextureFills,prepareTextureFill} from './caption-texture-fill';
import {prepareCollectionResources,beginCollectionExport} from './collection-captions';
import {mixCaptionSounds,type CaptionSoundEvent} from './caption-sounds';
import type {DecodedFrame} from './frame-source';
import type {Input,CanvasSink,AudioBufferSink,WrappedAudioBuffer} from 'mediabunny';
export type ExportClip={id:string;file:File;start:number;inPoint:number;outPoint:number;video:boolean;volume:number};
type Runtime={clip:ExportClip;input:Input;sink?:CanvasSink;frame?:DecodedFrame;audio?:AsyncGenerator<WrappedAudioBuffer,void,unknown>;pending?:WrappedAudioBuffer;done?:boolean};

export function exportVideoBitrate(width:number,height:number,fps:number){
 const estimate=width*height*fps*.16;
 return Number.isFinite(estimate)?Math.max(8_000_000,Math.round(estimate)):8_000_000;
}
/** Explicit timestamps and encoder backpressure: rendering can never drop frames to keep up with playback. */
export async function offlineExport(options:{preserveLeadingGap?:boolean;textureFills?:unknown;goldTextures?:boolean;serifTextures?:boolean;sounds?:CaptionSoundEvent[];clips:ExportClip[];duration:number;width?:number;height?:number;aspect?:number;sourceTiming?:boolean;fps?:number;maxEdge?:number;quality?:'full'|'balanced'|'small';draw:(ctx:CanvasRenderingContext2D,time:number,frames:Map<string,DecodedFrame>)=>void;progress:(n:number)=>void}){
 const range=exportRange(options.clips,options.duration);
 if(range.start>0&&!options.preserveLeadingGap){
  const draw=options.draw;
  options={...options,duration:range.duration,clips:options.clips.map(clip=>({...clip,start:clip.start-range.start})),
   sounds:options.sounds?.filter(sound=>sound.start>=range.start).map(sound=>({...sound,start:sound.start-range.start})),
   draw:(ctx,time,frames)=>draw(ctx,time+range.start,frames)};
 }
 const m=await import('mediabunny');
 const fills=collectTextureFills(options.textureFills);
 await prepareCollectionResources(options.textureFills);
 await Promise.all(fills.map(s=>prepareTextureFill(s,0)));
 if(options.goldTextures||JSON.stringify(options.textureFills??{}).includes('goldReference')){const {prepareGoldTextures}=await import('./text-surface');await prepareGoldTextures();}
 if(options.serifTextures){const {prepareSerifTextures}=await import('./text-surface');await prepareSerifTextures();}
 if(!await m.canEncodeAudio('aac')){const {registerAacEncoder}=await import('@mediabunny/aac-encoder');registerAacEncoder();}
 const runtimes:Runtime[]=[];let output:InstanceType<typeof m.Output>|undefined;
 try{
  let fps=0,sourceWidth=0,sourceHeight=0;
  for(const clip of options.clips){
   const input=new m.Input({source:new m.BlobSource(clip.file),formats:m.ALL_FORMATS});const runtime:Runtime={clip,input};runtimes.push(runtime);
   if(clip.video){const track=await input.getPrimaryVideoTrack();if(!track||!await track.canDecode())throw new Error('Format videa nije podržan za pouzdan izvoz. Original i izmjene ostaju sačuvani.');
    const width=await track.getDisplayWidth(),height=await track.getDisplayHeight();sourceWidth=Math.max(sourceWidth,width);sourceHeight=Math.max(sourceHeight,height);
    const stats=await track.computePacketStats(120);fps=Math.max(fps,stats.averagePacketRate||30);
    runtime.sink=new m.CanvasSink(track,{poolSize:2});runtime.frame=Object.assign(document.createElement('canvas'),{videoWidth:width,videoHeight:height,currentTime:0,currentSrc:clip.id,readyState:4});runtime.frame.width=width;runtime.frame.height=height;
   }
   if(clip.volume>0){const track=await input.getPrimaryAudioTrack();if(track){if(!await track.canDecode())throw new Error('Zvuk ovog formata nije moguće izvesti.');const sink:AudioBufferSink=new m.AudioBufferSink(track);runtime.audio=sink.buffers(clip.inPoint,clip.outPoint);}}
  }
  fps=Math.max(1,Math.min(240,options.fps||fps||30));
  const sourceTiming=options.sourceTiming&&!options.fps;
  const canvas=document.createElement('canvas'),aspect=options.aspect||sourceWidth/sourceHeight;
  canvas.width=options.width||Math.max(2,Math.round(Math.min(sourceWidth,sourceHeight*aspect)/2)*2);
  canvas.height=options.height||Math.max(2,Math.round(canvas.width/aspect/2)*2);
  if(options.maxEdge){const scale=Math.min(1,options.maxEdge/Math.max(canvas.width,canvas.height));canvas.width=Math.max(2,Math.round(canvas.width*scale/2)*2);canvas.height=Math.max(2,Math.round(canvas.height*scale/2)*2);}
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Izvoz nije moguće pripremiti.');
  if(!await m.canEncodeVideo('avc',{width:canvas.width,height:canvas.height}))throw new Error('Ovaj preglednik ne podržava pouzdan MP4 izvoz. Otvori projekat u novijem Chrome ili Edge pregledniku.');
  const target=new m.BufferTarget();output=new m.Output({format:new m.Mp4OutputFormat({fastStart:'in-memory'}),target});
  const video=new m.CanvasSource(canvas,{codec:'avc',bitrate:Math.round(exportVideoBitrate(canvas.width,canvas.height,fps)*(options.quality==='small'?.35:options.quality==='balanced'?.65:1))});output.addVideoTrack(video,sourceTiming?{}:{frameRate:fps});
  const hasAudio=runtimes.some(r=>r.audio)||!!options.sounds?.length;const audio=hasAudio?new m.AudioBufferSource({codec:'aac',bitrate:192000}):undefined;if(audio)output.addAudioTrack(audio);
  await output.start();let audioTime=0,lastPaint=performance.now();
  async function mixUntil(end:number){
   if(!audio)return;
   const rate=48000;const first=Math.round(audioTime*rate),last=Math.round(end*rate);if(last<=first)return;
   const mixed=new AudioBuffer({length:last-first,numberOfChannels:2,sampleRate:rate});
   for(const r of runtimes){if(!r.audio||r.done)continue;
    while(true){
     if(!r.pending){const item=await r.audio.next();if(item.done){r.done=true;break;}r.pending=item.value;}
     const block=r.pending,b=block.buffer;const globalStart=r.clip.start+block.timestamp-r.clip.inPoint,globalEnd=globalStart+b.duration;
     if(globalEnd<=audioTime){r.pending=undefined;continue;}if(globalStart>=end)break;
     const from=Math.max(first,Math.ceil(Math.max(globalStart,r.clip.start)*rate)),to=Math.min(last,Math.ceil(Math.min(globalEnd,r.clip.start+r.clip.outPoint-r.clip.inPoint)*rate));
     for(let channel=0;channel<2;channel++){const dest=mixed.getChannelData(channel),src=b.getChannelData(Math.min(channel,b.numberOfChannels-1));for(let i=from;i<to;i++){const p=(i/rate-globalStart)*b.sampleRate,index=Math.max(0,Math.floor(p)),fraction=p-index;dest[i-first]+=(src[index]||0)*(1-fraction)*r.clip.volume+(src[Math.min(index+1,src.length-1)]||0)*fraction*r.clip.volume;}}
     if(globalEnd>=end)break;r.pending=undefined;
    }
   }
   if(options.sounds?.length)mixCaptionSounds(mixed,audioTime,options.sounds);
   await audio.add(mixed);audioTime=end;
  }
  async function emit(time:number,duration:number,frames:Map<string,DecodedFrame>){
   await Promise.all(fills.map(s=>prepareTextureFill(s,time)));
   const finishCollectionFrame=beginCollectionExport();
   try{options.draw(ctx!,time,frames);}finally{finishCollectionFrame();}
   await video.add(time,duration);
   if(time+duration-audioTime>=.5)await mixUntil(time+duration);
   if(performance.now()-lastPaint>50){options.progress(Math.min(99,Math.round((time+duration)/options.duration*100)));await new Promise<void>(r=>setTimeout(r,0));lastPaint=performance.now();}
  }
  const primary=runtimes.find(r=>r.sink)!;
  function update(r:Runtime,source:HTMLCanvasElement|OffscreenCanvas,time:number){const frame=r.frame!;frame.getContext('2d')!.drawImage(source,0,0,frame.width,frame.height);frame.currentTime=time;return frame;}
  if(sourceTiming&&runtimes.filter(r=>r.sink).length===1){
   let emitted=0;
   for await(const sample of primary.sink!.canvases(primary.clip.inPoint,primary.clip.outPoint)){
    const sourceTime=Math.max(sample.timestamp,primary.clip.inPoint);
    const time=sourceTime-primary.clip.inPoint+primary.clip.start;if(time>=options.duration)break;
    const duration=Math.min(sample.timestamp+sample.duration,primary.clip.outPoint)-sourceTime;
    if(duration<=0)continue;
    await emit(time,Math.min(duration,options.duration-time),new Map([[primary.clip.id,update(primary,sample.canvas,sourceTime)]]));emitted++;
   }
   if(!emitted)throw new Error('Video ne sadrži čitljive kadrove.');
  }else{
   for(let index=0;index<Math.ceil(options.duration*fps);index++){
    const time=index/fps,frames=new Map<string,DecodedFrame>();
    for(const r of runtimes){if(!r.sink||time<r.clip.start||time>=r.clip.start+r.clip.outPoint-r.clip.inPoint)continue;const sourceTime=r.clip.inPoint+time-r.clip.start,sample=await r.sink.getCanvas(sourceTime);if(sample)frames.set(r.clip.id,update(r,sample.canvas,sourceTime));}
    await emit(time,Math.min(1/fps,options.duration-time),frames);
   }
  }
  await mixUntil(options.duration);video.close();audio?.close();await output.finalize();options.progress(100);
  if(!target.buffer)throw new Error('Izvoz nije napravio datoteku.');return new Blob([target.buffer],{type:'video/mp4'});
 }catch(error){await output?.cancel().catch(()=>{});throw error;}finally{for(const r of runtimes){await r.audio?.return().catch(()=>{});r.input.dispose();}}
}
