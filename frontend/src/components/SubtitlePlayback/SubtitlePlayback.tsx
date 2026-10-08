import {StudioIcon} from '../StudioIcon/StudioIcon';
import {useMediaFrameRate,adjacentFrameTime} from '../../lib/media-frame-step';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import './SubtitlePlayback.scss';
import { installPlaybackShortcut } from '../../lib/playback-shortcut';

export function SubtitlePlayback({ videoRef, source, disabled, file,loop,loopId,muted=false,onMute }: {
  loopId?:string;loop?:{start:number;end:number};muted?:boolean;onMute?:()=>void;file?:File|null;videoRef: RefObject<HTMLVideoElement | null>; source: string; disabled: boolean;
}) {
  const fps=useMediaFrameRate(file);
  const [playing, setPlaying] = useState(false);
  const wantsPlayback = useRef(false);

  const play = useCallback(async () => {
    const video = videoRef.current;
    if (!video || disabled || !source) return;
    wantsPlayback.current = true;
    try {
      if(loop&&(video.currentTime<loop.start||video.currentTime>=loop.end))video.currentTime=loop.start;
      else if (video.ended) video.currentTime = loop?.start??0;
      await video.play();
    } catch { /* LoadingVideo owns loading/recovery messages; aborted play is transient. */ }
  }, [videoRef, source, disabled,loop?.start,loop?.end]);
  const pause = () => { wantsPlayback.current=false; videoRef.current?.pause(); };
  const controls = useRef({play,pause,source,disabled,fps});
  controls.current={play,pause,source,disabled,fps};
  useEffect(() => {
    const sync = () => {const video=videoRef.current;setPlaying(Boolean(video && !video.paused && !video.ended));};
    const onMedia=(event:Event)=>{if(event.target!==videoRef.current)return;const video=videoRef.current;if(event.type==='play')wantsPlayback.current=true;if(event.type==='pause'&&!video?.ended)wantsPlayback.current=false;sync();};
    sync();
    const events=['play','playing','pause','ended','loadeddata','emptied'];
    events.forEach(name=>document.addEventListener(name,onMedia,true));
    const removeShortcut = installPlaybackShortcut(window, () => {
      const video=videoRef.current;if (!video) return;if (video.paused||video.ended) void controls.current.play(); else controls.current.pause();
    }, () => Boolean(videoRef.current && controls.current.source && !controls.current.disabled),direction=>{const video=videoRef.current;if(!video||!Number.isFinite(video.duration))return;controls.current.pause();video.currentTime=adjacentFrameTime(video.currentTime,direction,controls.current.fps,video.duration);});
    return () => {
      events.forEach(name=>document.removeEventListener(name,onMedia,true));
      removeShortcut();
    };
  }, [videoRef]);
  useEffect(()=>{
    if(!loop||loop.end<=loop.start||!source)return;
    let frame=0,disposed=false;
    const clamp=()=>{
      const video=videoRef.current;if(!video||video.readyState<1||video.seeking)return;
      const end=Math.min(loop.end,Number.isFinite(video.duration)?video.duration:loop.end);
      if(video.currentTime<loop.start||video.currentTime>=end-.005){
        const resume=wantsPlayback.current;
        video.currentTime=loop.start;
        if(resume&&video.paused)void controls.current.play();
      }
    };
    const tick=()=>{const video=videoRef.current;if(video&&!video.paused)clamp();if(!disposed)frame=requestAnimationFrame(tick);};
    const event=(e:Event)=>{if(e.target!==videoRef.current)return;clamp();};
    const events=['play','seeked','timeupdate','ended','loadedmetadata'];
    events.forEach(name=>document.addEventListener(name,event,true));
    clamp();frame=requestAnimationFrame(tick);
    return()=>{disposed=true;cancelAnimationFrame(frame);events.forEach(name=>document.removeEventListener(name,event,true));};
  },[videoRef,source,loop?.start,loop?.end]);
  // A newly selected caption starts its preview once; pausing does not retrigger it.
  useEffect(()=>{
    if(!loopId||!source||disabled)return;
    void controls.current.play();
  },[loopId,source,disabled]);
  return <div className="subtitle-playback" role="group" aria-label="Kontrole reprodukcije">
    <button type="button" disabled={disabled || !source} aria-pressed={playing} onClick={() => void play()} aria-label="Pusti video" title="Play | Space">
      <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 3v14l11-7z"/></svg>
    </button>
    <button type="button" disabled={disabled || !source} aria-pressed={!playing} onClick={pause} aria-label="Pauziraj video" title="Pause | Space">
      <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 3h3v14H5zm7 0h3v14h-3z"/></svg>
    </button>
    {onMute&&<button type="button" disabled={disabled||!source} onClick={onMute} aria-pressed={muted} aria-label={muted?'Uključi zvuk pregleda':'Isključi zvuk pregleda'} title={muted?'Uključi zvuk':'Mute'}><StudioIcon name={muted?'mute':'sound'}/></button>}
  </div>;
}
