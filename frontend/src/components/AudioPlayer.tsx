import {forwardRef,useRef,useState} from 'react';
import {StudioIcon} from './StudioIcon/StudioIcon';
import './AudioPlayer.scss';
const timeLabel=(time:number)=>Number.isFinite(time)?`${Math.floor(time/60)}:${String(Math.floor(time%60)).padStart(2,'0')}`:'0:00';
export const AudioPlayer=forwardRef<HTMLAudioElement,{src:string;autoPlay?:boolean;onPlay?:()=>void}>(function AudioPlayer({src,autoPlay=false,onPlay},ref){
  const audio=useRef<HTMLAudioElement|null>(null);
  const [playing,setPlaying]=useState(false),[time,setTime]=useState(0),[duration,setDuration]=useState(0),[muted,setMuted]=useState(false),[error,setError]=useState(false);
  return <div className="edita-audio-player">
    <audio key={src} ref={node=>{audio.current=node;if(typeof ref==='function')ref(node);else if(ref)ref.current=node;}} src={src} autoPlay={autoPlay} preload="metadata" muted={muted} onLoadStart={()=>{setTime(0);setDuration(0);setPlaying(false);setError(false);}} onLoadedMetadata={event=>setDuration(event.currentTarget.duration)} onDurationChange={event=>setDuration(event.currentTarget.duration)} onTimeUpdate={event=>setTime(event.currentTarget.currentTime)} onPlay={()=>{setPlaying(true);onPlay?.();}} onPause={()=>setPlaying(false)} onEnded={()=>setPlaying(false)} onError={()=>setError(true)}/>
    <button type="button" aria-label={playing?'Pauziraj zvuk':'Pusti zvuk'} disabled={error} onClick={()=>{if(!audio.current)return;if(playing)audio.current.pause();else void audio.current.play().catch(()=>setError(true));}}><StudioIcon name={playing?'pause':'play'}/></button>
    <div className="edita-audio-progress"><input aria-label="Pozicija zvuka" type="range" min="0" max={Number.isFinite(duration)?duration:0} step="0.01" value={time} disabled={!Number.isFinite(duration)||duration<=0} onChange={event=>{if(audio.current)audio.current.currentTime=Number(event.target.value);setTime(Number(event.target.value));}}/><div><time>{timeLabel(time)}</time><time>{error?'Zvuk nije dostupan':timeLabel(duration)}</time></div></div>
    <button type="button" aria-label={muted?'Uključi zvuk':'Isključi zvuk'} aria-pressed={muted} onClick={()=>setMuted(value=>!value)}><StudioIcon name={muted?'mute':'sound'}/></button>
  </div>;
});
