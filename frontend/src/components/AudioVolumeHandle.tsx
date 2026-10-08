import {useRef, useState, type CSSProperties, type ReactNode} from 'react';

export function AudioVolumeHandle({volume, muted, children, onChange, onBegin, onEnd, onSelect}: {
  volume:number; muted:boolean; children:ReactNode; onChange:(volume:number)=>void;
  onBegin:()=>void; onEnd:()=>void; onSelect:()=>void;
}) {
  const drag=useRef<{pointer:number;y:number;volume:number}|null>(null);
  const [active,setActive]=useState(false);
  const clamp=(value:number)=>Math.round(Math.max(0,Math.min(150,value)));
  function finish() { if(!drag.current)return; drag.current=null;setActive(false);onEnd(); }
  return <span style={{'--wave-volume':muted?0:volume/100} as CSSProperties} className={`audio-volume-handle${active?' adjusting':''}${muted?' muted':''}`} role="slider" tabIndex={0} aria-label="Glasnoća zvuka" aria-orientation="vertical" aria-valuemin={0} aria-valuemax={150} aria-valuenow={volume} aria-valuetext={`${volume}%${muted?' · isključen zvuk':''}`} title="Povuci gore za glasnije, dolje za tiše" onClick={e=>{e.stopPropagation();onSelect();}}
    onPointerDown={e=>{if(e.button!==0)return;e.preventDefault();e.stopPropagation();onSelect();onBegin();drag.current={pointer:e.pointerId,y:e.clientY,volume};setActive(true);e.currentTarget.setPointerCapture(e.pointerId);}}
    onPointerMove={e=>{e.stopPropagation();const d=drag.current;if(d&&d.pointer===e.pointerId)onChange(clamp(d.volume+d.y-e.clientY));}}
    onPointerUp={e=>{e.stopPropagation();finish();}} onPointerCancel={e=>{e.stopPropagation();finish();}} onLostPointerCapture={finish}
    onKeyDown={e=>{if(!['ArrowUp','ArrowDown','Home','End'].includes(e.key))return;e.preventDefault();e.stopPropagation();onSelect();onBegin();onChange(e.key==='Home'?0:e.key==='End'?150:clamp(volume+(e.key==='ArrowUp'?5:-5)));onEnd();}}>
    {children}<span className="audio-volume-value">{muted?'Mute · ':''}{volume}%</span>
  </span>;
}
