import {useEffect,useId,useRef,useState} from 'react';

export function CaptionFontSizeInput({value,onChange,fallbackValue=58}:{fallbackValue?:number;value?:number;onChange:(value:number|undefined)=>void}){
 const [open,setOpen]=useState(false),root=useRef<HTMLDivElement>(null),id=useId();
 useEffect(()=>{if(!open)return;const close=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false);};document.addEventListener('pointerdown',close,true);return()=>document.removeEventListener('pointerdown',close,true);},[open]);
 const step=(delta:number)=>onChange(Math.max(1,Math.min(900,Math.round(value??fallbackValue)+delta)));
 return <div className="caption-font-size-combo" ref={root} onKeyDown={e=>{if(e.key==='Escape')setOpen(false);}}>
  <div className="caption-size-field"><input className="caption-pixel-input" aria-label="Veličina fonta u pikselima" title="Pikseli na videu širine 1080 px. Auto zadržava veličinu stila." onFocus={()=>setOpen(true)} onClick={()=>setOpen(true)} aria-expanded={open} aria-controls={id} onKeyDown={e=>{if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();step(e.key==='ArrowUp'?1:-1);}}} type="number" min="1" max="900" placeholder="Auto" value={value??''} onChange={e=>onChange(e.target.value?Math.max(1,Math.min(900,Number(e.target.value))):undefined)}/>
  <div className="caption-size-steppers"><button type="button" aria-label="Povećaj font za 1 px" onClick={()=>step(1)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 14 5-5 5 5"/></svg></button><button type="button" aria-label="Smanji font za 1 px" onClick={()=>step(-1)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg></button></div>
  </div><span className="caption-size-unit">px</span>
  {open&&<div className="caption-size-options" id={id} role="group" aria-label="Predložene veličine">{[undefined,24,32,40,48,56,64,72,84,96,108,120,144,180,240,320].map(size=><button type="button" key={size??'auto'} aria-pressed={value===size} onClick={()=>{onChange(size);setOpen(false);}}>{size===undefined?'Auto':`${size} px`}</button>)}</div>}
 </div>;
}
