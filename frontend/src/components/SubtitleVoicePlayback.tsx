import {syncVoicePlayback} from '../lib/voice-playback';
import {useEffect,useRef,type RefObject} from 'react';
// One clock (the video) drives narration through play, pause, scrubbing and speed changes.
export function SubtitleVoicePlayback({videoRef,videoUrl,src,start,originalVolume,muted=false}:{videoRef:RefObject<HTMLVideoElement|null>;videoUrl:string;src:string;start:number;originalVolume:number;muted?:boolean}) {
  const audioRef=useRef<HTMLAudioElement>(null);
  useEffect(()=>{
    const video=videoRef.current,audio=audioRef.current;if(!video||!audio)return;
    let frame=0;
    const sync=()=>syncVoicePlayback(video,audio,Boolean(src),start,originalVolume);
    const tick=()=>{sync();frame=requestAnimationFrame(tick);};tick();
    const events=['play','pause','seeking','seeked','ratechange','volumechange','ended'];
    events.forEach(event=>video.addEventListener(event,sync));
    return()=>{cancelAnimationFrame(frame);events.forEach(event=>video.removeEventListener(event,sync));audio.pause();video.volume=1;};
  },[videoRef,videoUrl,src,start,originalVolume]);
  return <audio muted={muted} ref={audioRef} src={src||undefined} preload="auto" hidden/>;
}
