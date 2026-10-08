import {useEffect,useRef,type RefObject} from 'react';
import {soundSamples,type CaptionSoundEvent} from './caption-sounds';
let shared:AudioContext|undefined;
function audioContext(){if(!shared||shared.state==='closed')shared=new AudioContext();return shared;}
export function previewCaptionSound(kind:CaptionSoundEvent['kind'],volume=.25){
 const context=audioContext();void context.resume().then(()=>playSound(context,{kind,volume,start:0},context.currentTime)).catch(()=>{});
}
function playSound(context:AudioContext,event:CaptionSoundEvent,when:number){
 const data=soundSamples(event.kind,context.sampleRate),buffer=context.createBuffer(1,data.length,context.sampleRate);buffer.getChannelData(0).set(data);
 const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffer;gain.gain.value=event.volume;source.connect(gain).connect(context.destination);source.onended=()=>{source.disconnect();gain.disconnect();};source.start(when);return source;
}
export function useCaptionSounds(events:CaptionSoundEvent[],videoRef?:RefObject<HTMLVideoElement|null>,mediaRefs?:RefObject<Map<string,HTMLMediaElement>>,timelineTime?:number,playing?:boolean){
 const latest=useRef({events,timelineTime,playing});latest.current={events,timelineTime,playing};
 useEffect(()=>{
  let raf=0,last=-1,runningBefore=false;const scheduled=new Set<string>(),sources=new Set<AudioBufferSourceNode>();
  const unlock=()=>{if(latest.current.events.length)void audioContext().resume().catch(()=>{});};
  document.addEventListener('pointerdown',unlock,true);document.addEventListener('keydown',unlock,true);
  const stop=()=>{for(const source of sources){try{source.stop();}catch{/* completed */}}sources.clear();scheduled.clear();};
  const tick=()=>{
   const video=videoRef?.current,time=video?.currentTime??latest.current.timelineTime??0;
   const running=video?!video.paused&&!video.seeking:!!latest.current.playing;
   if(!running){if(runningBefore)stop();runningBefore=false;last=time;}
   else{
    if(time<last-.03||time-last>.5)stop();
    const from=runningBefore?last:last>=0&&Math.abs(time-last)<.3?last-.001:time-.05;
    if(shared?.state==='running')for(const [index,event] of latest.current.events.entries()){
     const key=`${index}:${event.start}:${event.kind}`;
     if(!scheduled.has(key)&&event.start>=from&&event.start<=time+.1){scheduled.add(key);const source=playSound(shared,event,shared.currentTime+Math.max(0,event.start-time)/(video?.playbackRate||1));sources.add(source);source.addEventListener('ended',()=>sources.delete(source));}
    }
    last=time;runningBefore=true;
   }raf=requestAnimationFrame(tick);
  };raf=requestAnimationFrame(tick);
  return()=>{cancelAnimationFrame(raf);stop();document.removeEventListener('pointerdown',unlock,true);document.removeEventListener('keydown',unlock,true);};
 },[videoRef,mediaRefs]);
}
