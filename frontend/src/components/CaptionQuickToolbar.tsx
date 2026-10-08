import {CaptionFontSizeInput} from './CaptionFontSizeInput';
import {createPortal} from 'react-dom';
import {useRef,useState,useLayoutEffect,type SetStateAction,type PointerEvent} from 'react';
import {StudioIcon} from './StudioIcon/StudioIcon';
import type {CaptionSettings} from '../config/captions/types';
import {LanguageDropdown} from './LanguageDropdown/LanguageDropdown';
import {fontOptions} from '../config/captions/fonts';
import {ColorPicker} from './ColorPicker/ColorPicker';
import './CaptionBasicsPanel.scss';
export function CaptionQuickToolbar({settings,onChange,onEdit,onStyles,onAnimation,onSettings,onClose,previewSelector='.subtitle-preview-frame',timelineSelector='.subtitle-bottom-dock:not([hidden])'}:{previewSelector?:string;timelineSelector?:string;settings:CaptionSettings;onChange:(action:SetStateAction<CaptionSettings>)=>void;onEdit:()=>void;onStyles:()=>void;onAnimation:()=>void;onSettings:()=>void;onClose:()=>void}){
 const root=useRef<HTMLDivElement>(null),drag=useRef<{x:number;y:number;left:number;top:number}|null>(null);
 const [position,setPosition]=useState<{x:number;y:number}|null>(null);
 const [anchor,setAnchor]=useState<{x:number;y:number}|null>(null);
 useLayoutEffect(()=>{
  if(position)return;
  const preview=document.querySelector<HTMLElement>(previewSelector),toolbar=root.current;
  if(!preview||!toolbar)return;
  const timeline=document.querySelector<HTMLElement>(timelineSelector);
  const place=()=>{
   const frame=preview.getBoundingClientRect(),bar=toolbar.getBoundingClientRect();
   const limit=document.fullscreenElement?window.innerHeight:(timeline?.getBoundingClientRect().top??window.innerHeight);
   const next={x:Math.max(8,Math.min(window.innerWidth-bar.width-8,frame.left+(frame.width-bar.width)/2)),y:Math.max(8,Math.min(frame.bottom+6,limit-bar.height-6,window.innerHeight-bar.height-8))};
   setAnchor(current=>current?.x===next.x&&current.y===next.y?current:next);
  };
  place();const observer=new ResizeObserver(place);observer.observe(preview);observer.observe(toolbar);if(timeline)observer.observe(timeline);
  window.addEventListener('resize',place);window.addEventListener('scroll',place,true);document.addEventListener('fullscreenchange',place);
  return()=>{observer.disconnect();window.removeEventListener('resize',place);window.removeEventListener('scroll',place,true);document.removeEventListener('fullscreenchange',place);};
 },[position,previewSelector,timelineSelector]);
 const placed=position??anchor;
 const start=(e:PointerEvent<HTMLButtonElement>)=>{const rect=root.current?.getBoundingClientRect();if(!rect)return;e.preventDefault();drag.current={x:e.clientX,y:e.clientY,left:rect.left,top:rect.top};e.currentTarget.setPointerCapture(e.pointerId);};
 const move=(e:PointerEvent<HTMLButtonElement>)=>{const d=drag.current,rect=root.current?.getBoundingClientRect();if(!d||!rect)return;setPosition({x:Math.max(8,Math.min(window.innerWidth-rect.width-8,d.left+e.clientX-d.x)),y:Math.max(8,Math.min(window.innerHeight-rect.height-8,d.top+e.clientY-d.y))});};
 const stop=()=>{drag.current=null;};
 return createPortal(<div ref={root} style={placed?{left:placed.x,top:placed.y,bottom:'auto',transform:'none'}:{visibility:'hidden'}} className="caption-quick-toolbar" role="toolbar" aria-label="Brzo uređivanje titla" onPointerDown={e=>e.stopPropagation()}>
  <button type="button" className="caption-toolbar-grip" title="Povuci da pomjeriš traku" aria-label="Pomjeri traku; koristi i strelice na tastaturi" onPointerDown={start} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop} onKeyDown={e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const r=root.current!.getBoundingClientRect();setPosition({x:Math.max(8,Math.min(window.innerWidth-r.width-8,r.left+(e.key==='ArrowLeft'?-10:e.key==='ArrowRight'?10:0))),y:Math.max(8,Math.min(window.innerHeight-r.height-8,r.top+(e.key==='ArrowUp'?-10:e.key==='ArrowDown'?10:0)))});}}><svg viewBox="0 0 16 24" aria-hidden="true"><path d="M5 6h.01M11 6h.01M5 12h.01M11 12h.01M5 18h.01M11 18h.01"/></svg></button>
  <LanguageDropdown label="Font" value={settings.fontFamily} options={fontOptions.map(f=>({...f,fontFamily:f.value}))} onChange={fontFamily=>onChange(s=>({...s,fontFamily}))}/>
  <ColorPicker value={settings.textColor} onChange={e=>onChange(s=>({...s,textColor:e.target.value}))}/>
  <CaptionFontSizeInput value={settings.fontSizePx} onChange={fontSizePx=>onChange(s=>({...s,fontSizePx}))}/>
  <button type="button" title="Uredi titl" aria-label="Uredi titl" onClick={onEdit}><StudioIcon name="text"/></button><button type="button" title="Stilovi" aria-label="Stilovi" onClick={onStyles}><StudioIcon name="spark"/></button><button type="button" title="Postavke titla" aria-label="Postavke titla" onClick={onSettings}><StudioIcon name="settings"/></button><button type="button" title="Animacija" aria-label="Animacija" onClick={onAnimation}><StudioIcon name="transitions"/></button><button type="button" className="caption-toolbar-close" title="Zatvori" aria-label="Zatvori brzu traku" onClick={onClose}><StudioIcon name="close"/></button>
 </div>,document.fullscreenElement||document.body);
}
