import {useState} from 'react';
import type {Segment} from '../config/captions/types';
import {shiftAllCaptions} from '../lib/caption-timing';
import './CaptionTimingShift.scss';
export function CaptionTimingShift({segments,duration,onChange,onBegin,onEnd,disabled=false}:{segments:Segment[];duration:number;onChange:(segments:Segment[])=>void;onBegin?:()=>void;onEnd?:()=>void;disabled?:boolean}){
 const [step,setStep]=useState('1'),[message,setMessage]=useState('');
 const amount=Number(step),valid=Number.isFinite(amount)&&amount>0;
 const apply=(seconds:number)=>{
  const result=shiftAllCaptions(segments,seconds,duration);
  if(result.applied){onBegin?.();onChange(result.segments);onEnd?.();}
  const actual=Math.abs(result.applied).toLocaleString('bs',{maximumFractionDigits:3});
  setMessage(result.applied?`Svi titlovi pomjereni ${actual} s ${result.applied<0?'ranije':'kasnije'}.${Math.abs(result.applied-seconds)>.000001?' Pomak ograničen početkom ili krajem videa.':''}`:'Nema prostora za pomak u tom smjeru; titlovi bi izašli iz videa.');
 };
 return <details className="caption-timing-shift"><summary>Uskladi titlove sa zvukom</summary><p>Pomjeri sve titlove, naslove i njihove riječi zajedno.</p><div className="caption-shift-presets">{[-2,-1,1,2].map(value=><button type="button" key={value} disabled={disabled||!segments.length} onClick={()=>apply(value)}>{value>0?'+':''}{value} s</button>)}</div><div className="caption-shift-custom"><button type="button" disabled={disabled||!valid||!segments.length} onClick={()=>apply(-amount)}>Ranije</button><label><input type="number" min="0.01" step="0.1" value={step} aria-label="Pomak svih titlova u sekundama" onChange={event=>setStep(event.target.value)}/><span>s</span></label><button type="button" disabled={disabled||!valid||!segments.length} onClick={()=>apply(amount)}>Kasnije</button></div><small>Ranije (−) ako titlovi kasne; kasnije (+) ako dolaze prije govora.</small>{message&&<p role="status">{message}</p>}</details>;
}
