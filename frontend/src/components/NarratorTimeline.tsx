import {useEffect,useRef,useState} from 'react';
import {AudioWaveform} from './AudioWaveform';

/** An independent voice clip shares the caption ruler and persisted narration offset. */
export function NarratorTimeline({src,start,duration,active,onMove,onSeek}:{src:string;start:number;duration:number;active:boolean;onMove:(start:number)=>void;onSeek:(time:number)=>void}){
 const [audio,setAudio]=useState<Blob|null>(null),[length,setLength]=useState(0);
 const track=useRef<HTMLDivElement>(null),drag=useRef<{x:number;start:number;width:number}|null>(null);
 useEffect(()=>{let live=true;setAudio(null);setLength(0);const controller=new AbortController();
  const media=new Audio();media.preload='metadata';media.src=src;
  media.onloadedmetadata=()=>{if(live&&Number.isFinite(media.duration))setLength(media.duration);};
  void fetch(src,{signal:controller.signal}).then(r=>{if(!r.ok)throw new Error('Audio unavailable');return r.blob();}).then(blob=>{if(live)setAudio(blob);}).catch(()=>{});
  return()=>{live=false;controller.abort();media.removeAttribute('src');media.load();};
 },[src]);
 const total=Math.max(.1,duration),clamp=(value:number)=>Math.max(0,Math.min(Math.max(0,total-.05),value));
 return <div ref={track} className={`subtitle-narrator-track${active?'':' is-inactive'}`} onPointerDown={e=>e.stopPropagation()}>
  <span className="subtitle-narrator-track-label">Narator{active?'':' · neaktivan'}</span>
  <div role="slider" tabIndex={0} aria-label="Početak naracije" aria-valuemin={0} aria-valuemax={total} aria-valuenow={start} aria-valuetext={`${start.toFixed(1)} sekundi`} className="subtitle-narrator-clip"
   style={{left:`${start/total*100}%`,width:`${Math.max(.2,Math.min(length||1,Math.max(0,total-start))/total*100)}%`}}
   onKeyDown={e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();onMove(clamp(start+(e.key==='ArrowLeft'?-1:1)*(e.shiftKey?1:.1)));}}}
   onPointerDown={e=>{if(e.button!==0)return;e.preventDefault();e.stopPropagation();drag.current={x:e.clientX,start,width:track.current!.getBoundingClientRect().width};e.currentTarget.setPointerCapture(e.pointerId);}}
   onPointerMove={e=>{const d=drag.current;if(d)onMove(clamp(d.start+(e.clientX-d.x)/Math.max(1,d.width)*total));}}
   onPointerUp={e=>{if(drag.current&&Math.abs(e.clientX-drag.current.x)<3)onSeek(start);drag.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}}
   onPointerCancel={()=>{drag.current=null;}}>
   <span>Naracija · {start.toFixed(1)}s</span><AudioWaveform file={audio} end={length?Math.min(1,(total-start)/length):1} normalize/>
  </div>
 </div>;
}
