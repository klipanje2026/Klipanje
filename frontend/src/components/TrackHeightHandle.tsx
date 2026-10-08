import {useRef} from 'react';
export function TrackHeightHandle({edge,height,onChange}:{edge:'top'|'bottom';height:number;onChange:(height:number)=>void}) {
 const drag=useRef<{y:number;height:number}|null>(null);
 const clamp=(value:number)=>Math.max(40,Math.min(140,value));
 return <div className={`track-height-handle ${edge}`} role="separator" aria-label={`Visina svih rezova — ${edge==='top'?'gornji':'donji'} rub`} aria-orientation="horizontal" aria-valuemin={40} aria-valuemax={140} aria-valuenow={height} tabIndex={0} title="Povuci za visinu svih rezova" onKeyDown={e=>{if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();e.stopPropagation();onChange(clamp(height+(e.key==='ArrowUp'?-8:8)));}}} onPointerDown={e=>{e.preventDefault();e.stopPropagation();drag.current={y:e.clientY,height};e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{e.stopPropagation();const d=drag.current;if(d)onChange(clamp(d.height+(e.clientY-d.y)*(edge==='top'?-1:1)));}} onPointerUp={e=>{e.stopPropagation();drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}/>;
}
