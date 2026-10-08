import {useContext,useEffect,useRef,type InputHTMLAttributes,type ChangeEvent} from 'react';
import type {CaptionSettings} from '../config/captions/types';
import './CaptionRange.scss';
import {CaptionDefaults} from './caption-defaults';
type Props=InputHTMLAttributes<HTMLInputElement>&{settingKey?:keyof CaptionSettings;resetValue?:number;hideReset?:boolean};
/** Shared slider with click/hold stepping and a reset limited to its own setting. */
export function CaptionRange({settingKey,resetValue=0,hideReset=false,...props}:Props){
 const defaults=useContext(CaptionDefaults),ref=useRef<HTMLInputElement>(null),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),latest=useRef(props);
 useEffect(()=>{latest.current=props;});
 const stop=()=>{clearTimeout(timer.current);timer.current=undefined;};
 useEffect(()=>{window.addEventListener('blur',stop);return()=>{stop();window.removeEventListener('blur',stop);};},[]);
 const change=(amount:number)=>{const input=ref.current;if(!input||input.disabled)return;const p=latest.current;const next=Math.max(Number(p.min??0),Math.min(Number(p.max??100),Number(input.value)+amount*Number(p.step==='any'?1:p.step??1)));input.value=String(Number(next.toFixed(6)));p.onChange?.({target:input,currentTarget:input} as ChangeEvent<HTMLInputElement>);};
 const preset=settingKey?defaults[settingKey]:undefined,original=typeof preset==='number'?preset:resetValue;
 const value=Math.max(Number(props.min??-Infinity),Math.min(Number(props.max??Infinity),original));
 const stepButton=(direction:number)=><button type="button" className="caption-range-step" disabled={props.disabled} aria-label={`${direction>0?'Povećaj':'Smanji'} ${props['aria-label']??'vrijednost'}`} onPointerDown={e=>{if(e.button!==0)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);stop();change(direction);const repeat=()=>{change(direction);timer.current=setTimeout(repeat,65);};timer.current=setTimeout(repeat,300);}} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop} onClick={e=>{e.preventDefault();if(e.detail===0)change(direction);}}>{direction>0?'+':'−'}</button>;
 return <span className="caption-range-control">{stepButton(-1)}<input {...props} ref={ref} type="range"/>{stepButton(1)}{!hideReset&&<button type="button" className="caption-range-reset" aria-label={props['aria-label']?'Vrati na izvorno: '+props['aria-label']:'Vrati na izvorno'} title="Vrati na izvorno" onClick={event=>{event.preventDefault();event.stopPropagation();const input=ref.current;if(!input)return;input.value=String(value);props.onChange?.({...event,target:input,currentTarget:input} as unknown as ChangeEvent<HTMLInputElement>);}}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/></svg></button>}</span>;
}
